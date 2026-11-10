import Phaser from 'phaser';
import { BOSS, SHIELD } from '../config/combatConfig';
import { PLAYER_CONTROLS } from '../config/controls';
import type { PlayerId } from '../config/controls';
import { SceneKeys } from '../config/sceneKeys';
import { COLORS } from '../config/theme';
import { createPlaceholderTextures } from '../resources/placeholderTextures';
import { TextureKeys } from '../resources/textureKeys';
import { CoopCamera } from '../systems/CoopCamera';
import { InputSystem } from '../systems/InputSystem';
import type { PlayerInputState } from '../systems/InputSystem';
import { sfx } from '../systems/SfxSystem';
import { createPlayerHudState } from '../ui/hudState';
import type { DebugSnapshot, HudModel } from '../ui/HudModel';
import { Arena } from '../world/Arena';
import { getRoomSession } from '../../net/session';
import type { RoomSession } from '../../net/RoomSession';
import type {
  NetEnemyState,
  NetPlayerState,
  NetProjectileState,
  NetSnapshot,
  NetTelegraphState,
  NetTurretState,
  NetWallState,
  NetWaveState,
} from '../../net/types';

const INPUT_INTERVAL_MS = 66;
const INTERPOLATION_DELAY_MS = 90;
const SNAPSHOT_HISTORY_MS = 1500;

export interface GuestArenaSceneData {
  runId: number;
}

interface TimedSnapshot {
  receivedAt: number;
  snapshot: NetSnapshot;
}

interface RenderedPoint {
  x: number;
  y: number;
}

const TELEGRAPH_COLOR = 0xf472b6;

export class GuestArenaScene extends Phaser.Scene {
  private session: RoomSession | null = null;
  private arena!: Arena;
  private coopCamera!: CoopCamera;
  private hudModel!: HudModel;
  private inputSystem!: InputSystem;
  private inputTimer: Phaser.Time.TimerEvent | null = null;
  private inputSeq = 0;
  private pending = this.createEmptyInput();
  private snapshots: TimedSnapshot[] = [];
  private latest: NetSnapshot | null = null;
  private readonly playerSprites = new Map<PlayerId, Phaser.GameObjects.Image>();
  private readonly playerShields = new Map<PlayerId, Phaser.GameObjects.Graphics>();
  private readonly enemySprites = new Map<string, Phaser.GameObjects.Image>();
  private readonly projectileSprites = new Map<number, Phaser.GameObjects.Image>();
  private readonly turretSprites = new Map<PlayerId, Phaser.GameObjects.Image>();
  private readonly wallSprites = new Map<PlayerId, Phaser.GameObjects.Rectangle>();
  private readonly waveSprites = new Map<PlayerId, Phaser.GameObjects.Graphics>();
  private readonly renderedPlayers = new Map<PlayerId, RenderedPoint>();
  private telegraph!: Phaser.GameObjects.Graphics;

  constructor() {
    super(SceneKeys.GuestArena);
  }

  create(_data: GuestArenaSceneData): void {
    createPlaceholderTextures(this);

    this.session = getRoomSession();
    this.snapshots = [];
    this.latest = null;
    this.inputSeq = 0;
    this.pending = this.createEmptyInput();
    this.renderedPlayers.clear();

    if (!this.session || this.session.role !== 'guest') {
      this.scene.start(SceneKeys.Lobby, {
        notice: 'The room connection was lost.',
      });
      return;
    }

    this.arena = new Arena(this);
    const { bounds } = this.arena;

    this.coopCamera = new CoopCamera(this, this.cameras.main, bounds);
    this.telegraph = this.add.graphics().setDepth(5);

    this.hudModel = {
      objective: 'Waiting for the host…',
      players: [createPlayerHudState('p1'), createPlayerHudState('p2')],
      boss: null,
      debug: { players: [], enemies: 0, projectiles: 0, reflections: 0, fps: 0 },
      outcome: null,
      resultHint: 'R  REQUEST RESTART          ESC  LEAVE ROOM',
    };

    this.scene.launch(SceneKeys.Hud, { model: this.hudModel });

    this.inputSystem = new InputSystem(this, PLAYER_CONTROLS.p2, 'p2');
    this.attachSessionCallbacks();
    this.setupResultInput();

    this.inputTimer = this.time.addEvent({
      delay: INPUT_INTERVAL_MS,
      loop: true,
      callback: this.sendInput,
      callbackScope: this,
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  update(): void {
    this.inputSystem.update();
    this.accumulateInput(this.inputSystem.getState());
    this.renderSnapshot();
    this.syncHud();
  }

  private attachSessionCallbacks(): void {
    const session = this.session;

    if (!session) {
      return;
    }

    session.onSnapshot = (snapshot) => {
      this.handleSnapshot(snapshot);
    };

    session.onSfx = (name) => {
      sfx.play(name);
    };

    session.onRestart = (runId) => {
      this.scene.restart({ runId });
    };

    session.onHostLeft = () => {
      this.returnToLobby('The host left the room.');
    };
  }

  private handleSnapshot(snapshot: NetSnapshot): void {
    const now = performance.now();

    this.latest = snapshot;
    this.snapshots.push({ receivedAt: now, snapshot });

    const cutoff = now - SNAPSHOT_HISTORY_MS;

    while (this.snapshots.length > 2 && this.snapshots[0].receivedAt < cutoff) {
      this.snapshots.shift();
    }
  }

  private renderSnapshot(): void {
    const pair = this.pickPair();

    if (!pair) {
      return;
    }

    const { before, after, t } = pair;

    this.renderPlayers(before.snapshot.players, after.snapshot.players, t);
    this.renderEnemies(before.snapshot.enemies, after.snapshot.enemies, t);
    this.renderProjectiles(
      before.snapshot.projectiles,
      after.snapshot.projectiles,
      t,
    );
    this.renderTurrets(before.snapshot.turrets, after.snapshot.turrets, t);
    this.renderWalls(before.snapshot.walls, after.snapshot.walls, t);
    this.renderWaves(before.snapshot.waves, after.snapshot.waves, t);
    this.renderTelegraph(after.snapshot.telegraph);

    const focus = [...this.renderedPlayers.values()];

    if (focus.length > 0) {
      this.coopCamera.update(focus);
    }
  }

  private pickPair(): { before: TimedSnapshot; after: TimedSnapshot; t: number } | null {
    const snapshots = this.snapshots;

    if (snapshots.length === 0) {
      return null;
    }

    const renderTime = performance.now() - INTERPOLATION_DELAY_MS;

    if (snapshots.length === 1) {
      return {
        before: snapshots[0],
        after: snapshots[0],
        t: 0,
      };
    }

    let afterIndex = snapshots.findIndex(
      (entry) => entry.receivedAt >= renderTime,
    );

    if (afterIndex === -1) {
      afterIndex = snapshots.length - 1;
    }

    if (afterIndex === 0) {
      return {
        before: snapshots[0],
        after: snapshots[0],
        t: 0,
      };
    }

    const after = snapshots[afterIndex];
    const before = snapshots[afterIndex - 1];
    const span = after.receivedAt - before.receivedAt;
    const t = span > 0 ? Phaser.Math.Clamp((renderTime - before.receivedAt) / span, 0, 1) : 1;

    return { before, after, t };
  }

  private renderPlayers(
    before: readonly NetPlayerState[],
    after: readonly NetPlayerState[],
    t: number,
  ): void {
    const seen = new Set<PlayerId>();

    for (const state of after) {
      seen.add(state.id);

      let sprite = this.playerSprites.get(state.id);

      if (!sprite) {
        sprite = this.add
          .image(state.x, state.y, this.playerTexture(state.id))
          .setDepth(10);
        this.playerSprites.set(state.id, sprite);

        const shield = this.add.graphics().setDepth(11);
        this.playerShields.set(state.id, shield);
      }

      const previous = before.find((candidate) => candidate.id === state.id);
      const x = previous ? Phaser.Math.Linear(previous.x, state.x, t) : state.x;
      const y = previous ? Phaser.Math.Linear(previous.y, state.y, t) : state.y;
      const rotation = previous
        ? this.lerpAngle(previous.rotation, state.rotation, t)
        : state.rotation;

      sprite.setPosition(x, y).setRotation(rotation).setAlpha(state.alpha);
      this.applyTint(sprite, state.tint);
      this.renderedPlayers.set(state.id, { x, y });
      this.drawShield(state, x, y, rotation);
    }

    for (const [id, sprite] of this.playerSprites) {
      if (!seen.has(id)) {
        sprite.destroy();
        this.playerSprites.delete(id);
        this.playerShields.get(id)?.destroy();
        this.playerShields.delete(id);
        this.renderedPlayers.delete(id);
      }
    }
  }

  private drawShield(
    state: NetPlayerState,
    x: number,
    y: number,
    rotation: number,
  ): void {
    const graphics = this.playerShields.get(state.id);

    if (!graphics) {
      return;
    }

    graphics.clear();

    if (!state.alive || !state.shieldActive) {
      return;
    }

    const color = state.id === 'p1' ? 0x2dd4bf : 0xf59e0b;
    const halfArc = Phaser.Math.DegToRad(SHIELD.arcDegrees) / 2;
    const startAngle = rotation - halfArc;
    const endAngle = rotation + halfArc;
    const radius = SHIELD.visualRadius;

    graphics.fillStyle(color, 0.12);
    graphics.beginPath();
    graphics.arc(x, y, radius, startAngle, endAngle, false);
    graphics.lineTo(x, y);
    graphics.closePath();
    graphics.fillPath();

    graphics.lineStyle(4, color, 0.85);
    graphics.beginPath();
    graphics.arc(x, y, radius, startAngle, endAngle, false);
    graphics.strokePath();
  }

  private renderEnemies(
    before: readonly NetEnemyState[],
    after: readonly NetEnemyState[],
    t: number,
  ): void {
    const seen = new Set<string>();

    for (const state of after) {
      seen.add(state.id);

      let sprite = this.enemySprites.get(state.id);

      if (!sprite) {
        sprite = this.add
          .image(
            state.x,
            state.y,
            state.kind === 'boss' ? TextureKeys.Boss : TextureKeys.Grunt,
          )
          .setDepth(state.kind === 'boss' ? 9 : 8);
        this.enemySprites.set(state.id, sprite);
      }

      const previous = before.find((candidate) => candidate.id === state.id);
      const x = previous ? Phaser.Math.Linear(previous.x, state.x, t) : state.x;
      const y = previous ? Phaser.Math.Linear(previous.y, state.y, t) : state.y;
      const rotation = previous
        ? this.lerpAngle(previous.rotation, state.rotation, t)
        : state.rotation;

      sprite
        .setPosition(x, y)
        .setRotation(rotation)
        .setAlpha(state.alpha)
        .setScale(state.scaleX, state.scaleY);
      this.applyTint(sprite, state.tint);
    }

    for (const [id, sprite] of this.enemySprites) {
      if (!seen.has(id)) {
        sprite.destroy();
        this.enemySprites.delete(id);
      }
    }
  }

  private renderProjectiles(
    before: readonly NetProjectileState[],
    after: readonly NetProjectileState[],
    t: number,
  ): void {
    const seen = new Set<number>();

    for (const state of after) {
      seen.add(state.id);

      let sprite = this.projectileSprites.get(state.id);

      if (!sprite) {
        if (!this.textures.exists(state.texture)) {
          continue;
        }

        sprite = this.add
          .image(state.x, state.y, state.texture)
          .setDepth(20);
        this.projectileSprites.set(state.id, sprite);
      }

      const previous = before.find((candidate) => candidate.id === state.id);
      const x = previous ? Phaser.Math.Linear(previous.x, state.x, t) : state.x;
      const y = previous ? Phaser.Math.Linear(previous.y, state.y, t) : state.y;
      const rotation = previous
        ? this.lerpAngle(previous.rotation, state.rotation, t)
        : state.rotation;

      sprite
        .setPosition(x, y)
        .setRotation(rotation)
        .setScale(state.scaleX, state.scaleY);
      this.applyTint(sprite, state.tint);
    }

    for (const [id, sprite] of this.projectileSprites) {
      if (!seen.has(id)) {
        sprite.destroy();
        this.projectileSprites.delete(id);
      }
    }
  }

  private renderTurrets(
    before: readonly NetTurretState[],
    after: readonly NetTurretState[],
    t: number,
  ): void {
    const seen = new Set<PlayerId>();

    for (const state of after) {
      seen.add(state.ownerId);

      let sprite = this.turretSprites.get(state.ownerId);

      if (!sprite) {
        sprite = this.add
          .image(state.x, state.y, TextureKeys.Turret)
          .setDepth(9);
        this.turretSprites.set(state.ownerId, sprite);
      }

      const previous = before.find(
        (candidate) => candidate.ownerId === state.ownerId,
      );
      const x = previous ? Phaser.Math.Linear(previous.x, state.x, t) : state.x;
      const y = previous ? Phaser.Math.Linear(previous.y, state.y, t) : state.y;
      const rotation = previous
        ? this.lerpAngle(previous.rotation, state.rotation, t)
        : state.rotation;

      sprite.setPosition(x, y).setRotation(rotation).setAlpha(state.alpha);
    }

    for (const [id, sprite] of this.turretSprites) {
      if (!seen.has(id)) {
        sprite.destroy();
        this.turretSprites.delete(id);
      }
    }
  }

  private renderWalls(
    before: readonly NetWallState[],
    after: readonly NetWallState[],
    t: number,
  ): void {
    const seen = new Set<PlayerId>();

    for (const state of after) {
      seen.add(state.ownerId);

      let sprite = this.wallSprites.get(state.ownerId);

      if (!sprite) {
        const color =
          state.ownerId === 'p1' ? COLORS.playerOne : COLORS.playerTwo;

        sprite = this.add
          .rectangle(
            state.x,
            state.y,
            state.length,
            state.thickness,
            color,
            0.28,
          )
          .setStrokeStyle(2, color, 0.9)
          .setDepth(7);
        this.wallSprites.set(state.ownerId, sprite);
      }

      const previous = before.find(
        (candidate) => candidate.ownerId === state.ownerId,
      );
      const x = previous ? Phaser.Math.Linear(previous.x, state.x, t) : state.x;
      const y = previous ? Phaser.Math.Linear(previous.y, state.y, t) : state.y;
      const rotation = previous
        ? this.lerpAngle(previous.rotation, state.rotation, t)
        : state.rotation;

      sprite.setPosition(x, y).setRotation(rotation).setAlpha(state.alpha);
    }

    for (const [id, sprite] of this.wallSprites) {
      if (!seen.has(id)) {
        sprite.destroy();
        this.wallSprites.delete(id);
      }
    }
  }

  private renderWaves(
    before: readonly NetWaveState[],
    after: readonly NetWaveState[],
    t: number,
  ): void {
    const seen = new Set<PlayerId>();

    for (const state of after) {
      seen.add(state.ownerId);

      let graphics = this.waveSprites.get(state.ownerId);

      if (!graphics) {
        graphics = this.add.graphics().setDepth(6);
        this.waveSprites.set(state.ownerId, graphics);
      }

      const previous = before.find(
        (candidate) => candidate.ownerId === state.ownerId,
      );
      const x = previous ? Phaser.Math.Linear(previous.x, state.x, t) : state.x;
      const y = previous ? Phaser.Math.Linear(previous.y, state.y, t) : state.y;
      const color =
        state.ownerId === 'p1' ? COLORS.playerOne : COLORS.playerTwo;
      const alpha = Math.max(0, Math.min(1, state.alpha));

      graphics.clear();
      graphics.setPosition(x, y);
      graphics.fillStyle(color, 0.07 + alpha * 0.1);
      graphics.fillCircle(0, 0, state.radius);
      graphics.lineStyle(2, color, alpha);
      graphics.strokeCircle(0, 0, state.radius);
      graphics.lineStyle(1, color, alpha * 0.5);
      graphics.strokeCircle(0, 0, state.radius * 0.62);
    }

    for (const [id, graphics] of this.waveSprites) {
      if (!seen.has(id)) {
        graphics.destroy();
        this.waveSprites.delete(id);
      }
    }
  }

  private renderTelegraph(state: NetTelegraphState | null): void {
    this.telegraph.clear();

    if (!state) {
      return;
    }

    this.telegraph.fillStyle(
      TELEGRAPH_COLOR,
      0.06 + state.progress * 0.12,
    );
    this.telegraph.fillCircle(state.x, state.y, state.radius);
    this.telegraph.lineStyle(3, TELEGRAPH_COLOR, 0.9 - state.progress * 0.4);
    this.telegraph.strokeCircle(state.x, state.y, state.radius);
    this.telegraph.lineStyle(1, TELEGRAPH_COLOR, 0.5);
    this.telegraph.strokeCircle(state.x, state.y, state.radius * 0.6);
  }

  private syncHud(): void {
    const snapshot = this.latest;

    if (!snapshot) {
      return;
    }

    this.hudModel.objective = snapshot.objective;
    this.hudModel.outcome = snapshot.outcome;
    this.hudModel.boss = snapshot.boss
      ? {
          name: BOSS.name,
          health: snapshot.boss.health,
          maxHealth: snapshot.boss.maxHealth,
        }
      : null;
    this.hudModel.debug = this.createDebugSnapshot(snapshot);

    for (const netState of snapshot.players) {
      const state = this.hudModel.players.find(
        (candidate) => candidate.id === netState.id,
      );

      if (!state) {
        continue;
      }

      state.health = netState.health;
      state.maxHealth = netState.maxHealth;
      state.downed = !netState.alive;
      state.autoAttack = netState.autoAttack;

      if (state.fireball) {
        state.fireball.ready = netState.fireball.ready;
        state.fireball.active = netState.fireball.active;
        state.fireball.ratio = netState.fireball.ratio;
      }

      if (state.shield) {
        state.shield.ready = netState.shield.ready;
        state.shield.active = netState.shield.active;
        state.shield.ratio = netState.shield.ratio;
      }

      if (state.dash) {
        state.dash.ready = netState.dash.ready;
        state.dash.active = netState.dash.active;
        state.dash.ratio = netState.dash.ratio;
      }

      for (let index = 0; index < state.skills.length; index += 1) {
        const hudSkill = state.skills[index];
        const netSkill = netState.skills[index];

        if (!hudSkill || !netSkill) {
          continue;
        }

        hudSkill.ready = netSkill.ready;
        hudSkill.active = netSkill.active;
        hudSkill.ratio = netSkill.ratio;
      }
    }
  }

  private createDebugSnapshot(snapshot: NetSnapshot): DebugSnapshot {
    return {
      players: [],
      enemies: snapshot.debugEnemies,
      projectiles: snapshot.debugProjectiles,
      reflections: snapshot.reflections,
      fps: this.game.loop.actualFps,
    };
  }

  private accumulateInput(input: PlayerInputState): void {
    if (input.fireball) {
      this.pending.fireball = true;
    }

    if (input.shield) {
      this.pending.shield = true;
    }

    if (input.dash) {
      this.pending.dash = true;
    }

    if (input.autoAttackToggle) {
      this.pending.autoAttackToggle = true;
    }

    for (
      let index = 0;
      index < input.skillCasts.length &&
      index < this.pending.skillCasts.length;
      index += 1
    ) {
      if (input.skillCasts[index]) {
        this.pending.skillCasts[index] = true;
      }
    }
  }

  private sendInput(): void {
    const session = this.session;

    if (!session) {
      return;
    }

    const movement = this.inputSystem.getState().movement;

    session.sendInput({
      seq: this.inputSeq,
      movementX: movement.x,
      movementY: movement.y,
      fireball: this.pending.fireball,
      shield: this.pending.shield,
      dash: this.pending.dash,
      autoAttackToggle: this.pending.autoAttackToggle,
      skillCasts: [...this.pending.skillCasts],
    });

    this.inputSeq += 1;
    this.clearEdges(this.pending);
  }

  private createEmptyInput(): PlayerInputState {
    return {
      movement: new Phaser.Math.Vector2(),
      fireball: false,
      shield: false,
      dash: false,
      autoAttackToggle: false,
      skillCasts: PLAYER_CONTROLS.p2.skills.map(() => false),
    };
  }

  private clearEdges(input: PlayerInputState): void {
    input.fireball = false;
    input.shield = false;
    input.dash = false;
    input.autoAttackToggle = false;
    input.skillCasts.fill(false);
  }

  private setupResultInput(): void {
    const keyboard = this.input.keyboard;

    keyboard?.on('keydown-R', this.handleRestartInput, this);
    keyboard?.on('keydown-ESC', this.handleLeaveInput, this);
  }

  private handleRestartInput(): void {
    if (!this.latest?.outcome) {
      return;
    }

    this.session?.requestRestart();
  }

  private handleLeaveInput(): void {
    this.returnToLobby('You left the room.');
  }

  private removeResultInput(): void {
    const keyboard = this.input.keyboard;

    keyboard?.off('keydown-R', this.handleRestartInput, this);
    keyboard?.off('keydown-ESC', this.handleLeaveInput, this);
  }

  private returnToLobby(message: string): void {
    const session = this.session;

    this.session = null;

    if (session) {
      session.detachCallbacks();
      void session.leave().catch(() => undefined);
    }

    this.scene.start(SceneKeys.Lobby, { notice: message });
  }

  private applyTint(
    image: Phaser.GameObjects.Image,
    tint: number | null,
  ): void {
    if (tint === null) {
      image.clearTint();
      return;
    }

    image.setTint(tint);
  }

  private lerpAngle(from: number, to: number, t: number): number {
    return from + Phaser.Math.Angle.Wrap(to - from) * t;
  }

  private playerTexture(id: PlayerId): string {
    return id === 'p1' ? TextureKeys.PlayerOne : TextureKeys.PlayerTwo;
  }

  private handleShutdown(): void {
    this.inputTimer?.remove();
    this.inputTimer = null;
    this.session?.detachCallbacks();
    this.scene.stop(SceneKeys.Hud);
    this.inputSystem.destroy();
    this.removeResultInput();
    this.coopCamera.destroy();
    this.arena.destroy();
    this.telegraph.destroy();

    for (const sprite of this.playerSprites.values()) {
      sprite.destroy();
    }

    for (const graphics of this.playerShields.values()) {
      graphics.destroy();
    }

    for (const sprite of this.enemySprites.values()) {
      sprite.destroy();
    }

    for (const sprite of this.projectileSprites.values()) {
      sprite.destroy();
    }

    for (const sprite of this.turretSprites.values()) {
      sprite.destroy();
    }

    for (const sprite of this.wallSprites.values()) {
      sprite.destroy();
    }

    for (const graphics of this.waveSprites.values()) {
      graphics.destroy();
    }

    this.playerSprites.clear();
    this.playerShields.clear();
    this.enemySprites.clear();
    this.projectileSprites.clear();
    this.turretSprites.clear();
    this.wallSprites.clear();
    this.waveSprites.clear();
    this.renderedPlayers.clear();
  }
}
