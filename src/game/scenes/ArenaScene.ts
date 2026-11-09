import Phaser from 'phaser';
import { BOSS, SHIELD } from '../config/combatConfig';
import { ARENA, DEBUG, PLAYER } from '../config/gameplayConfig';
import { PLAYER_CONTROLS } from '../config/controls';
import type { PlayerId } from '../config/controls';
import { SceneKeys } from '../config/sceneKeys';
import { EnemyBase } from '../entities/EnemyBase';
import { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { createPlaceholderTextures } from '../resources/placeholderTextures';
import { CoopCamera } from '../systems/CoopCamera';
import { EncounterSystem } from '../systems/EncounterSystem';
import type { EncounterPhase } from '../systems/EncounterSystem';
import { InputSystem } from '../systems/InputSystem';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { sfx } from '../systems/SfxSystem';
import { createPlayerHudState } from '../ui/hudState';
import type { DebugSnapshot, HudModel, Outcome } from '../ui/HudModel';
import { Arena } from '../world/Arena';

const OUTCOME_DELAY_MS = 900;

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
  private arena!: Arena;
  private players: Player[] = [];
  private inputSystem!: InputSystem;
  private projectileSystem!: ProjectileSystem;
  private encounterSystem!: EncounterSystem;
  private coopCamera!: CoopCamera;
  private hudModel!: HudModel;
  private debugDamageKeys: DebugDamageKey[] = [];
  private outcomeScheduled = false;
  private outcomeHandled = false;
  private outcomeTimer: Phaser.Time.TimerEvent | null = null;
  private reflections = 0;

  constructor() {
    super(SceneKeys.Arena);
  }

  create(): void {
    createPlaceholderTextures(this);

    this.physics.resume();
    this.outcomeScheduled = false;
    this.outcomeHandled = false;
    this.outcomeTimer = null;
    this.reflections = 0;
    this.arena = new Arena(this);
    this.players = this.createPlayers();

    this.physics.add.collider(this.players, this.arena.walls);
    this.physics.add.collider(
      this.players[0],
      this.players[1],
      undefined,
      this.shouldPlayersCollide,
      this,
    );

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

    this.encounterSystem = new EncounterSystem(this);
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

    this.inputSystem = new InputSystem(this);
    this.setupDebugDamageKeys();
    this.setupResultInput();
    this.coopCamera = new CoopCamera(this, this.cameras.main, bounds);
    this.coopCamera.update(this.players);

    this.hudModel = {
      objective: this.objectiveForPhase(this.encounterSystem.phase),
      players: this.players.map((player) =>
        createPlayerHudState(player.id),
      ),
      boss: null,
      debug: { players: [], enemies: 0, projectiles: 0, reflections: 0, fps: 0 },
      outcome: null,
    };

    this.scene.launch(SceneKeys.Hud, { model: this.hudModel });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  update(_time: number, delta: number): void {
    if (this.outcomeHandled) {
      return;
    }

    this.inputSystem.update();

    for (const player of this.players) {
      const input = this.inputSystem.getState(player.id);

      player.update(input.movement, delta);

      if (input.fireball) {
        const spawn = player.tryFire();

        if (spawn) {
          this.projectileSystem.spawn(spawn);
          sfx.play('fireball');
        }
      }

      if (input.shield && player.tryShield()) {
        sfx.play('shield');
      }

      if (input.dash && player.tryDash(input.movement)) {
        sfx.play('dash');
      }
    }

    const enemyShots = this.outcomeScheduled
      ? []
      : this.encounterSystem.update(delta, this.players);

    for (const shot of enemyShots) {
      this.projectileSystem.spawn(shot);
    }

    this.projectileSystem.update(delta);
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
    sfx.play(enemy.isAlive ? 'enemyHit' : 'enemyDeath');
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
      sfx.play('playerHit');
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
    sfx.play('reflect');
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
        key: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.H),
        playerId: 'p1',
      },
      {
        key: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_THREE),
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
          sfx.play('playerHit');
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
      state.downed = !player.isAlive;

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
        : 'Both players have fallen.';

    this.projectileSystem.clearTeam('enemies');

    this.outcomeTimer?.remove();
    this.outcomeTimer = this.time.delayedCall(OUTCOME_DELAY_MS, () => {
      this.outcomeTimer = null;
      this.outcomeHandled = true;
      this.hudModel.outcome = outcome;
      this.physics.pause();
      sfx.play(outcome);
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
    keyboard?.on('keydown-ESC', this.handleTitleInput, this);
  }

  private handleRestartInput(): void {
    if (!this.outcomeHandled) {
      return;
    }

    this.scene.restart();
  }

  private handleTitleInput(): void {
    if (!this.outcomeHandled) {
      return;
    }

    this.scene.start(SceneKeys.Start);
  }

  private removeResultInput(): void {
    const keyboard = this.input.keyboard;

    keyboard?.off('keydown-R', this.handleRestartInput, this);
    keyboard?.off('keydown-ESC', this.handleTitleInput, this);
  }

  private handleShutdown(): void {
    this.outcomeTimer?.remove();
    this.outcomeTimer = null;
    this.physics.resume();

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
