import Phaser from 'phaser';
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
import { InputSystem } from '../systems/InputSystem';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { createPlayerHudState } from '../ui/hudState';
import type { DebugSnapshot, HudModel } from '../ui/HudModel';
import { Arena } from '../world/Arena';

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
  private outcomeHandled = false;

  constructor() {
    super(SceneKeys.Arena);
  }

  create(): void {
    createPlaceholderTextures(this);

    this.outcomeHandled = false;
    this.arena = new Arena(this);
    this.players = this.createPlayers();

    this.physics.add.collider(this.players, this.arena.walls);
    this.physics.add.collider(this.players[0], this.players[1]);

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
    this.physics.add.collider(this.players, this.encounterSystem.group);

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
    this.coopCamera = new CoopCamera(this, this.cameras.main, bounds);
    this.coopCamera.update(this.players);

    this.hudModel = {
      objective: this.objectiveFor(this.encounterSystem.aliveCount),
      players: this.players.map((player) =>
        createPlayerHudState(player.id),
      ),
      boss: null,
      debug: { players: [], enemies: 0, projectiles: 0, fps: 0 },
      outcome: null,
    };

    this.scene.launch(SceneKeys.Hud, { model: this.hudModel });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  update(_time: number, delta: number): void {
    this.inputSystem.update();

    for (const player of this.players) {
      const input = this.inputSystem.getState(player.id);

      player.update(input.movement, delta);

      if (input.fireball) {
        const spawn = player.tryFire();

        if (spawn) {
          this.projectileSystem.spawn(spawn);
        }
      }
    }

    const enemyShots = this.encounterSystem.update(delta, this.players);

    for (const shot of enemyShots) {
      this.projectileSystem.spawn(shot);
    }

    this.projectileSystem.update(delta);
    this.handleDebugDamage();
    this.coopCamera.update(this.players);
    this.syncHudState();
    this.syncObjective();
    this.checkDefeat();
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

    if (
      !this.projectileSystem.has(projectile) ||
      projectile.team !== 'enemies'
    ) {
      return;
    }

    player.takeDamage(projectile.damage);
    this.projectileSystem.remove(projectile);
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
        this.players
          .find((player) => player.id === entry.playerId)
          ?.takeDamage(DEBUG.damageAmount);
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
    }
  }

  private syncObjective(): void {
    if (this.hudModel.outcome !== null) {
      return;
    }

    this.hudModel.objective = this.objectiveFor(
      this.encounterSystem.aliveCount,
    );
  }

  private objectiveFor(remaining: number): string {
    return remaining > 0
      ? `Defeat the grunts — ${remaining} remaining.`
      : 'The first wave is defeated.';
  }

  private checkDefeat(): void {
    if (this.outcomeHandled || this.players.some((player) => player.isAlive)) {
      return;
    }

    this.outcomeHandled = true;
    this.hudModel.outcome = 'defeat';
    this.hudModel.objective = 'Both players have fallen.';
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
        blocked: player.body.blocked,
      })),
      enemies: this.encounterSystem.aliveCount,
      projectiles: this.projectileSystem.count,
      fps: this.game.loop.actualFps,
    };
  }

  private handleShutdown(): void {
    this.scene.stop(SceneKeys.Hud);
    this.inputSystem.destroy();
    this.removeDebugDamageKeys();
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
