import Phaser from 'phaser';
import { BOSS, SHIELD } from '../config/combatConfig';
import { ARENA, DEBUG, PLAYER } from '../config/gameplayConfig';
import { PLAYER_CONTROLS } from '../config/controls';
import type { PlayerId } from '../config/controls';
import { SceneKeys } from '../config/sceneKeys';
import { TURRET_SKILL, WALL_SKILL, WAVE_SKILL } from '../config/skills';
import { Boss } from '../entities/Boss';
import { EnemyBase } from '../entities/EnemyBase';
import { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { createPlaceholderTextures } from '../resources/placeholderTextures';
import type { Skill } from '../skills/Skill';
import { TurretSkill } from '../skills/TurretSkill';
import { WallSkill } from '../skills/WallSkill';
import { WaveSkill } from '../skills/WaveSkill';
import { CoopCamera } from '../systems/CoopCamera';
import { EncounterSystem } from '../systems/EncounterSystem';
import type { EncounterPhase } from '../systems/EncounterSystem';
import { InputSystem } from '../systems/InputSystem';
import type { PlayerInputState } from '../systems/InputSystem';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { sfx } from '../systems/SfxSystem';
import type { SfxName } from '../systems/SfxSystem';
import { createPlayerHudState } from '../ui/hudState';
import type { DebugSnapshot, HudModel, Outcome } from '../ui/HudModel';
import { Arena } from '../world/Arena';
import { getRoomSession } from '../../net/session';
import type { RoomSession } from '../../net/RoomSession';
import type {
  NetEnemyState,
  NetInputFrame,
  NetPlayerState,
  NetProjectileState,
  NetSnapshot,
  NetTurretState,
  NetWallState,
  NetWaveState,
} from '../../net/types';

const OUTCOME_DELAY_MS = 900;
const SNAPSHOT_INTERVAL_MS = 50;

export interface ArenaSceneData {
  mode: 'solo' | 'host';
  runId: number;
}

type ArcadeCollisionObject =
  | Phaser.Types.Physics.Arcade.GameObjectWithBody
  | Phaser.Physics.Arcade.Body
  | Phaser.Physics.Arcade.StaticBody
  | Phaser.Tilemaps.Tile;

interface DebugDamageKey {
  key: Phaser.Input.Keyboard.Key;
  playerId: PlayerId;
}

export class ArenaScene extends Phaser.Scene {
  private mode: ArenaSceneData['mode'] = 'solo';
  private runId = 0;
  private session: RoomSession | null = null;
  private arena!: Arena;
  private players: Player[] = [];
  private inputSystem!: InputSystem;
  private remoteInput!: PlayerInputState;
  private projectileSystem!: ProjectileSystem;
  private encounterSystem!: EncounterSystem;
  private coopCamera!: CoopCamera;
  private hudModel!: HudModel;
  private playerSkills = new Map<PlayerId, Skill[]>();
  private debugDamageKeys: DebugDamageKey[] = [];
  private outcomeScheduled = false;
  private outcomeHandled = false;
  private outcomeTimer: Phaser.Time.TimerEvent | null = null;
  private snapshotTimer: Phaser.Time.TimerEvent | null = null;
  private reflections = 0;

  constructor() {
    super(SceneKeys.Arena);
  }

  create(data: ArenaSceneData = { mode: 'solo', runId: 0 }): void {
    createPlaceholderTextures(this);

    this.mode = data.mode;
    this.runId = data.runId;
    this.session = this.mode === 'host' ? getRoomSession() : null;

    if (this.session && this.session.role !== 'host') {
      this.session = null;
      this.mode = 'solo';
    }

    this.physics.resume();
    this.outcomeScheduled = false;
    this.outcomeHandled = false;
    this.outcomeTimer = null;
    this.snapshotTimer = null;
    this.reflections = 0;
    this.remoteInput = this.createEmptyInput();
    this.arena = new Arena(this);
    this.players = this.createPlayers();
    this.playerSkills = new Map<PlayerId, Skill[]>();

    for (const player of this.players) {
      this.playerSkills.set(player.id, [
        new TurretSkill(this, TURRET_SKILL),
        new WallSkill(this, WALL_SKILL),
        new WaveSkill(this, WAVE_SKILL, (_hits, kills) => {
          this.playSfx(kills > 0 ? 'enemyDeath' : 'enemyHit');
        }),
      ]);
    }

    this.physics.add.collider(this.players, this.arena.walls);

    if (this.players.length > 1) {
      this.physics.add.collider(
        this.players[0],
        this.players[1],
        undefined,
        this.shouldPlayersCollide,
        this,
      );
    }

    this.projectileSystem = new ProjectileSystem(this);
    this.physics.add.collider(
      this.projectileSystem.group,
      this.arena.walls,
      (object) => {
        if (object instanceof Projectile) {
          this.projectileSystem.remove(object);
        }
      },
    );

    this.encounterSystem = new EncounterSystem(this, (name) => {
      this.playSfx(name);
    });
    this.encounterSystem.spawnOpeningWave();

    this.physics.add.collider(this.encounterSystem.group, this.arena.walls);
    this.physics.add.collider(
      this.encounterSystem.group,
      this.encounterSystem.group,
    );
    this.physics.add.collider(
      this.players,
      this.encounterSystem.group,
      undefined,
      this.shouldPlayerCollideWithEnemy,
      this,
    );

    this.physics.add.overlap(
      this.projectileSystem.group,
      this.encounterSystem.group,
      this.handleProjectileEnemyOverlap,
      undefined,
      this,
    );
    this.physics.add.overlap(
      this.projectileSystem.group,
      this.players,
      this.handleProjectilePlayerOverlap,
      undefined,
      this,
    );

    const { bounds } = this.arena;
    this.physics.world.setBounds(
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
    );

    const localPlayerId = this.session?.localPlayerId ?? 'p1';
    this.inputSystem = new InputSystem(
      this,
      PLAYER_CONTROLS[localPlayerId],
      localPlayerId,
    );
    this.setupDebugDamageKeys();
    this.setupResultInput();
    this.attachSessionCallbacks();
    this.coopCamera = new CoopCamera(this, this.cameras.main, bounds);
    this.coopCamera.update(this.players);

    this.hudModel = {
      objective: this.objectiveForPhase(this.encounterSystem.phase),
      players: this.players.map((player) => createPlayerHudState(player.id)),
      boss: null,
      debug: { players: [], enemies: 0, projectiles: 0, reflections: 0, fps: 0 },
      outcome: null,
      resultHint: this.createResultHint(),
    };

    this.scene.launch(SceneKeys.Hud, { model: this.hudModel });

    if (this.session) {
      this.snapshotTimer = this.time.addEvent({
        delay: SNAPSHOT_INTERVAL_MS,
        loop: true,
        callback: this.sendSnapshot,
        callbackScope: this,
      });
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  update(_time: number, delta: number): void {
    if (this.outcomeHandled) {
      return;
    }

    this.inputSystem.update();

    const localPlayer = this.players.find(
      (player) => player.id === this.inputSystem.playerId,
    );

    if (localPlayer) {
      this.applyPlayerInput(
        localPlayer,
        this.inputSystem.getState(),
        delta,
        true,
      );
    }

    const remotePlayer = this.players.find(
      (player) => player.id === 'p2',
    );

    if (remotePlayer && this.session) {
      this.applyPlayerInput(remotePlayer, this.remoteInput, delta, false);
      this.clearInputEdges(this.remoteInput);
    }

    const enemyShots = this.outcomeScheduled
      ? []
      : this.encounterSystem.update(delta, this.players);

    for (const shot of enemyShots) {
      this.projectileSystem.spawn(shot);
    }

    this.projectileSystem.update(delta);
    this.handleWallBlocks();
    this.handleDebugDamage();
    this.coopCamera.update(this.players);
    this.syncHudState();
    this.syncBossHud();
    this.syncObjective();
    this.checkOutcome();
    this.hudModel.debug = this.createDebugSnapshot();
  }

  private createPlayers(): Player[] {
    const centerX = ARENA.width / 2;
    const centerY = ARENA.height / 2;

    if (this.mode === 'solo') {
      return [
        new Player(this, 'p1', centerX - PLAYER.spawnSpacing, centerY, 0),
      ];
    }

    return [
      new Player(this, 'p1', centerX - PLAYER.spawnSpacing, centerY, 0),
      new Player(
        this,
        'p2',
        centerX + PLAYER.spawnSpacing,
        centerY,
        Math.PI,
      ),
    ];
  }

  private applyPlayerInput(
    player: Player,
    input: PlayerInputState,
    delta: number,
    _isLocal: boolean,
  ): void {
    const enemies = this.encounterSystem.enemies;

    player.update(input.movement, delta);

    if (input.autoAttackToggle && player.toggleAutoAttack()) {
      this.playSfx('toggle');
    }

    if (input.fireball) {
      this.firePlayer(player);
    }

    if (player.autoAttackEnabled) {
      this.firePlayer(player);
    }

    if (input.shield && player.tryShield()) {
      this.playSfx('shield');
    }

    if (input.dash && player.tryDash(input.movement)) {
      this.playSfx('dash');
    }

    const skills = this.playerSkills.get(player.id);

    if (!skills || this.outcomeScheduled) {
      return;
    }

    for (let index = 0; index < skills.length; index += 1) {
      const skill = skills[index];
      const shots = skill.update(delta, { enemies });

      for (const shot of shots) {
        this.projectileSystem.spawn(shot);
      }

      if (input.skillCasts[index] === true && skill.tryCast({ player })) {
        this.playSfx('skill');
      }
    }
  }

  private firePlayer(player: Player): void {
    const spawn = player.tryFire();

    if (!spawn) {
      return;
    }

    this.projectileSystem.spawn(spawn);
    this.playSfx('fireball');
  }

  private playSfx(name: SfxName): void {
    sfx.play(name);
    this.session?.sendSfx(name);
  }

  private receiveRemoteInput(frame: NetInputFrame): void {
    this.remoteInput.movement.set(
      this.clampAxis(frame.movementX),
      this.clampAxis(frame.movementY),
    );

    if (frame.fireball) {
      this.remoteInput.fireball = true;
    }

    if (frame.shield) {
      this.remoteInput.shield = true;
    }

    if (frame.dash) {
      this.remoteInput.dash = true;
    }

    if (frame.autoAttackToggle) {
      this.remoteInput.autoAttackToggle = true;
    }

    if (Array.isArray(frame.skillCasts)) {
      for (
        let index = 0;
        index < frame.skillCasts.length &&
        index < this.remoteInput.skillCasts.length;
        index += 1
      ) {
        if (frame.skillCasts[index] === true) {
          this.remoteInput.skillCasts[index] = true;
        }
      }
    }
  }

  private clampAxis(value: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 0;
    }

    return Phaser.Math.Clamp(value, -1, 1);
  }

  private createEmptyInput(): PlayerInputState {
    return {
      movement: new Phaser.Math.Vector2(),
      fireball: false,
      shield: false,
      dash: false,
      autoAttackToggle: false,
      skillCasts: PLAYER_CONTROLS.p1.skills.map(() => false),
    };
  }

  private clearInputEdges(input: PlayerInputState): void {
    input.fireball = false;
    input.shield = false;
    input.dash = false;
    input.autoAttackToggle = false;
    input.skillCasts.fill(false);
  }

  private attachSessionCallbacks(): void {
    const session = this.session;

    if (!session) {
      return;
    }

    session.onInput = (frame) => {
      this.receiveRemoteInput(frame);
    };

    session.onRestartRequest = () => {
      this.handleRestartRequest();
    };

    session.onGuestLeft = () => {
      this.handleGuestLeft();
    };
  }

  private sendSnapshot(): void {
    const session = this.session;

    if (!session || !session.hasGuest) {
      return;
    }

    session.sendSnapshot(this.buildSnapshot());
  }

  private buildSnapshot(): NetSnapshot {
    const boss = this.encounterSystem.activeBoss;

    return {
      type: 'snapshot',
      runId: this.session?.runId ?? this.runId,
      serverTime: this.time.now,
      players: this.players.map((player) => this.netPlayerState(player)),
      enemies: this.netEnemyStates(),
      projectiles: this.netProjectileStates(),
      turrets: this.netTurretStates(),
      walls: this.netWallStates(),
      waves: this.netWaveStates(),
      boss: boss
        ? {
            health: boss.health.current,
            maxHealth: boss.health.maxHealth,
          }
        : null,
      telegraph: this.encounterSystem.telegraphState,
      objective: this.hudModel.objective,
      outcome: this.hudModel.outcome,
      reflections: this.reflections,
      debugEnemies: this.encounterSystem.aliveCount,
      debugProjectiles: this.projectileSystem.count,
    };
  }

  private netPlayerState(player: Player): NetPlayerState {
    const skills = this.playerSkills.get(player.id) ?? [];

    return {
      id: player.id,
      x: player.x,
      y: player.y,
      rotation: player.rotation,
      alpha: player.alpha,
      tint: player.isTinted ? player.tintTopLeft : null,
      health: player.health.current,
      maxHealth: player.health.maxHealth,
      alive: player.isAlive,
      dashing: player.isDashing,
      autoAttack: player.autoAttackEnabled,
      shieldActive: player.shield.isActive,
      fireball: {
        ready: player.fireball.cooldown.isReady,
        active: false,
        ratio: player.fireball.cooldown.readyRatio,
      },
      shield: {
        ready: player.shield.cooldown.isReady,
        active: player.shield.isActive,
        ratio: player.shield.isActive
          ? player.shield.activeRatio
          : player.shield.cooldown.readyRatio,
      },
      dash: {
        ready: player.dash.cooldown.isReady,
        active: player.dash.isDashing,
        ratio: player.dash.isDashing
          ? player.dash.activeRatio
          : player.dash.cooldown.readyRatio,
      },
      skills: skills.map((skill) => ({
        ready: skill.isReady,
        active: skill.isActive,
        ratio: skill.statusRatio,
      })),
    };
  }

  private netEnemyStates(): NetEnemyState[] {
    return this.encounterSystem.enemies.map((enemy) => ({
      id: enemy.id,
      kind: enemy instanceof Boss ? 'boss' : 'grunt',
      x: enemy.x,
      y: enemy.y,
      rotation: enemy.rotation,
      alpha: enemy.alpha,
      scaleX: enemy.scaleX,
      scaleY: enemy.scaleY,
      tint: enemy.isTinted ? enemy.tintTopLeft : null,
    }));
  }

  private netProjectileStates(): NetProjectileState[] {
    return this.projectileSystem.liveProjectiles.map((projectile) => ({
      id: projectile.netId,
      x: projectile.x,
      y: projectile.y,
      rotation: projectile.rotation,
      texture: projectile.preset.texture,
      scaleX: projectile.scaleX,
      scaleY: projectile.scaleY,
      tint: projectile.isTinted ? projectile.tintTopLeft : null,
    }));
  }

  private netTurretStates(): NetTurretState[] {
    const turrets: NetTurretState[] = [];

    for (const skills of this.playerSkills.values()) {
      for (const skill of skills) {
        if (skill instanceof TurretSkill && skill.renderState) {
          turrets.push(skill.renderState);
        }
      }
    }

    return turrets;
  }

  private netWallStates(): NetWallState[] {
    const walls: NetWallState[] = [];

    for (const skills of this.playerSkills.values()) {
      for (const skill of skills) {
        if (skill instanceof WallSkill && skill.renderState) {
          walls.push(skill.renderState);
        }
      }
    }

    return walls;
  }

  private netWaveStates(): NetWaveState[] {
    const waves: NetWaveState[] = [];

    for (const skills of this.playerSkills.values()) {
      for (const skill of skills) {
        if (skill instanceof WaveSkill && skill.renderState) {
          waves.push(skill.renderState);
        }
      }
    }

    return waves;
  }

  private handleRestartRequest(): void {
    if (!this.outcomeHandled) {
      return;
    }

    this.restartRun();
  }

  private restartRun(): void {
    const session = this.session;

    if (session) {
      session.restartRun();

      this.scene.restart({
        mode: 'host',
        runId: session.runId,
      });
      return;
    }

    this.scene.restart({ mode: 'solo', runId: 0 });
  }

  private handleGuestLeft(): void {
    const session = this.session;

    if (!session) {
      return;
    }

    session.resetForLobby();
    session.detachCallbacks();
    this.session = null;
    this.scene.start(SceneKeys.Lobby, {
      notice: 'Your partner left the room. The room is still open.',
    });
  }

  private createResultHint(): string {
    if (!this.session) {
      return 'R  RESTART          ESC  TITLE';
    }

    return 'R  RESTART FOR BOTH          ESC  LEAVE ROOM';
  }

  private handleWallBlocks(): void {
    const projectiles = this.projectileSystem.liveProjectiles;

    if (projectiles.length === 0) {
      return;
    }

    for (const skills of this.playerSkills.values()) {
      for (const skill of skills) {
        if (!skill.isActive) {
          continue;
        }

        for (const projectile of projectiles) {
          if (!projectile.active) {
            continue;
          }

          if (skill.blocksProjectile(projectile)) {
            this.projectileSystem.remove(projectile);
          }
        }
      }
    }
  }

  private handleProjectileEnemyOverlap(
    object1: ArcadeCollisionObject,
    object2: ArcadeCollisionObject,
  ): void {
    const projectile = this.asProjectile(object1, object2);
    const enemy = this.asEnemy(object1, object2);

    if (!projectile || !enemy) {
      return;
    }

    if (
      !this.projectileSystem.has(projectile) ||
      projectile.team !== 'players' ||
      !enemy.isAlive
    ) {
      return;
    }

    enemy.takeDamage(projectile.damage);
    this.playSfx(enemy.isAlive ? 'enemyHit' : 'enemyDeath');
    this.projectileSystem.remove(projectile);
  }

  private handleProjectilePlayerOverlap(
    object1: ArcadeCollisionObject,
    object2: ArcadeCollisionObject,
  ): void {
    const projectile = this.asProjectile(object1, object2);
    const player = this.asPlayer(object1, object2);

    if (!projectile || !player) {
      return;
    }

    if (!this.projectileSystem.has(projectile)) {
      return;
    }

    if (player.isDashing) {
      return;
    }

    if (this.tryShieldReflect(projectile, player)) {
      return;
    }

    if (projectile.team !== 'enemies' || !player.isAlive) {
      return;
    }

    if (player.takeDamage(projectile.damage)) {
      this.playSfx('playerHit');
    }

    this.projectileSystem.remove(projectile);
  }

  private tryShieldReflect(projectile: Projectile, player: Player): boolean {
    if (!player.isAlive || !player.shield.isActive) {
      return false;
    }

    const facingAngle = player.facingVector.angle();

    if (
      !projectile.isMovingToward(player.x, player.y) ||
      !player.shield.blocks(
        projectile.x,
        projectile.y,
        player.x,
        player.y,
        facingAngle,
      )
    ) {
      return false;
    }

    if (projectile.isReflectionLocked) {
      return true;
    }

    if (!projectile.isReflectable) {
      this.projectileSystem.remove(projectile);
      return true;
    }

    projectile.reflect({
      team: 'players',
      ownerId: player.id,
      angle: facingAngle,
      offset: SHIELD.reflectOffset,
      lockMs: SHIELD.reflectLockMs,
    });

    player.flashShield();
    this.reflections += 1;
    this.playSfx('reflect');
    this.cameras.main.shake(90, 0.004);
    return true;
  }

  private asProjectile(
    object1: ArcadeCollisionObject,
    object2: ArcadeCollisionObject,
  ): Projectile | null {
    if (object1 instanceof Projectile) {
      return object1;
    }

    return object2 instanceof Projectile ? object2 : null;
  }

  private asEnemy(
    object1: ArcadeCollisionObject,
    object2: ArcadeCollisionObject,
  ): EnemyBase | null {
    if (object1 instanceof EnemyBase) {
      return object1;
    }

    return object2 instanceof EnemyBase ? object2 : null;
  }

  private asPlayer(
    object1: ArcadeCollisionObject,
    object2: ArcadeCollisionObject,
  ): Player | null {
    if (object1 instanceof Player) {
      return object1;
    }

    return object2 instanceof Player ? object2 : null;
  }

  private shouldPlayersCollide(
    object1: ArcadeCollisionObject,
    object2: ArcadeCollisionObject,
  ): boolean {
    return !(
      (object1 instanceof Player && object1.isDashing) ||
      (object2 instanceof Player && object2.isDashing)
    );
  }

  private shouldPlayerCollideWithEnemy(
    object1: ArcadeCollisionObject,
    object2: ArcadeCollisionObject,
  ): boolean {
    const player = this.asPlayer(object1, object2);
    return !player || !player.isDashing;
  }

  private setupDebugDamageKeys(): void {
    if (!DEBUG.enabled) {
      return;
    }
    const keyboard = this.input.keyboard;

    if (!keyboard) {
      return;
    }

    this.debugDamageKeys = [
      {
        key: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
        playerId: 'p1',
      },
      {
        key: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
        playerId: 'p2',
      },
    ];
  }

  private handleDebugDamage(): void {
    if (!DEBUG.enabled) {
      return;
    }

    for (const entry of this.debugDamageKeys) {
      if (Phaser.Input.Keyboard.JustDown(entry.key)) {
        const player = this.players.find(
          (candidate) => candidate.id === entry.playerId,
        );

        if (player?.takeDamage(DEBUG.damageAmount)) {
          this.playSfx('playerHit');
        }
      }
    }
  }

  private syncHudState(): void {
    for (const player of this.players) {
      const state = this.hudModel.players.find(
        (candidate) => candidate.id === player.id,
      );

      if (!state) {
        continue;
      }

      state.health = player.health.current;
      state.maxHealth = player.health.maxHealth;
      state.downed = !player.isAlive;
      state.autoAttack = player.autoAttackEnabled;

      if (state.fireball) {
        state.fireball.ready = player.fireball.cooldown.isReady;
        state.fireball.ratio = player.fireball.cooldown.readyRatio;
      }

      if (state.shield) {
        state.shield.active = player.shield.isActive;
        state.shield.ready = player.shield.cooldown.isReady;
        state.shield.ratio = player.shield.isActive
          ? player.shield.activeRatio
          : player.shield.cooldown.readyRatio;
      }

      if (state.dash) {
        state.dash.active = player.dash.isDashing;
        state.dash.ready = player.dash.cooldown.isReady;
        state.dash.ratio = player.dash.isDashing
          ? player.dash.activeRatio
          : player.dash.cooldown.readyRatio;
      }

      const skills = this.playerSkills.get(player.id) ?? [];

      for (let index = 0; index < state.skills.length; index += 1) {
        const hudSkill = state.skills[index];
        const skill = skills[index];

        if (!hudSkill || !skill) {
          continue;
        }

        hudSkill.active = skill.isActive;
        hudSkill.ready = skill.isReady;
        hudSkill.ratio = skill.statusRatio;
      }
    }
  }

  private syncBossHud(): void {
    const boss = this.encounterSystem.activeBoss;

    if (!boss) {
      this.hudModel.boss = null;
      return;
    }

    const state = this.hudModel.boss;

    if (state) {
      state.health = boss.health.current;
      return;
    }

    this.hudModel.boss = {
      name: BOSS.name,
      health: boss.health.current,
      maxHealth: boss.health.maxHealth,
    };
  }

  private syncObjective(): void {
    if (this.hudModel.outcome !== null || this.outcomeScheduled) {
      return;
    }

    this.hudModel.objective = this.objectiveForPhase(this.encounterSystem.phase);
  }

  private objectiveForPhase(phase: EncounterPhase): string {
    switch (phase) {
      case 'grunts': {
        const remaining = this.encounterSystem.aliveCount;

        return remaining > 0
          ? `Defeat the grunts — ${remaining} remaining.`
          : 'The first wave is defeated.';
      }
      case 'bossTelegraph':
        return 'Something stirs at the far end of the arena…';
      case 'boss':
        return `Defeat ${BOSS.name}.`;
      case 'cleared':
        return `The ${BOSS.name} has fallen.`;
    }
  }

  private checkOutcome(): void {
    if (this.outcomeScheduled) {
      return;
    }

    if (this.encounterSystem.bossDefeated) {
      this.scheduleOutcome('victory');
      return;
    }

    if (!this.players.some((player) => player.isAlive)) {
      this.scheduleOutcome('defeat');
    }
  }

  private scheduleOutcome(outcome: Outcome): void {
    this.outcomeScheduled = true;
    this.hudModel.objective =
      outcome === 'victory'
        ? `The ${BOSS.name} has fallen.`
        : this.players.length > 1
          ? 'All players have fallen.'
          : 'You have fallen.';

    this.projectileSystem.clearTeam('enemies');

    this.outcomeTimer?.remove();
    this.outcomeTimer = this.time.delayedCall(OUTCOME_DELAY_MS, () => {
      this.outcomeTimer = null;
      this.outcomeHandled = true;
      this.hudModel.outcome = outcome;
      this.physics.pause();
      this.playSfx(outcome);
    });
  }

  private createDebugSnapshot(): DebugSnapshot {
    return {
      players: this.players.map((player) => ({
        label: PLAYER_CONTROLS[player.id].label,
        position: { x: player.x, y: player.y },
        velocity: player.body.velocity,
        direction: player.movementDirection,
        facingDegrees: player.facingDegrees,
        health: player.health.current,
        maxHealth: player.health.maxHealth,
        downed: !player.isAlive,
        dashing: player.isDashing,
        autoAttack: player.autoAttackEnabled,
        skillActive:
          this.playerSkills
            .get(player.id)
            ?.some((skill) => skill.isActive) ?? false,
        blocked: player.body.blocked,
      })),
      enemies: this.encounterSystem.aliveCount,
      projectiles: this.projectileSystem.count,
      reflections: this.reflections,
      fps: this.game.loop.actualFps,
    };
  }

  private setupResultInput(): void {
    const keyboard = this.input.keyboard;

    keyboard?.on('keydown-R', this.handleRestartInput, this);
    keyboard?.on('keydown-ESC', this.handleLeaveInput, this);
  }

  private handleRestartInput(): void {
    if (!this.outcomeHandled) {
      return;
    }

    this.restartRun();
  }

  private handleLeaveInput(): void {
    const session = this.session;

    this.session = null;

    if (session) {
      session.detachCallbacks();
      void session.leave().catch(() => undefined);
    }

    this.scene.start(SceneKeys.Lobby, {
      notice: session ? 'You left the room.' : 'Returned to the lobby.',
    });
  }

  private removeResultInput(): void {
    const keyboard = this.input.keyboard;

    keyboard?.off('keydown-R', this.handleRestartInput, this);
    keyboard?.off('keydown-ESC', this.handleLeaveInput, this);
  }

  private handleShutdown(): void {
    this.outcomeTimer?.remove();
    this.outcomeTimer = null;
    this.snapshotTimer?.remove();
    this.snapshotTimer = null;

    this.session?.detachCallbacks();

    this.scene.stop(SceneKeys.Hud);
    this.inputSystem.destroy();
    this.removeDebugDamageKeys();
    this.removeResultInput();
    this.encounterSystem.destroyAll();
    this.projectileSystem.destroyAll();
    this.coopCamera.destroy();
    this.arena.destroy();

    for (const player of this.players) {
      player.destroy();
    }

    this.players = [];
  }

  private removeDebugDamageKeys(): void {
    const keyboard = this.input.keyboard;

    for (const entry of this.debugDamageKeys) {
      keyboard?.removeKey(entry.key, true);
    }

    this.debugDamageKeys = [];
  }
}
