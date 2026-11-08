import Phaser from 'phaser';
import { ARENA, DEBUG, PLAYER } from '../config/gameplayConfig';
import { PLAYER_CONTROLS } from '../config/controls';
import type { PlayerId } from '../config/controls';
import { SceneKeys } from '../config/sceneKeys';
import { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { createPlaceholderTextures } from '../resources/placeholderTextures';
import { CoopCamera } from '../systems/CoopCamera';
import { InputSystem } from '../systems/InputSystem';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { createPlayerHudState } from '../ui/hudState';
import type { DebugSnapshot, HudModel } from '../ui/HudModel';
import { Arena } from '../world/Arena';

const OBJECTIVE_TEXT = 'Survive the trials.';

interface DebugDamageKey {
  key: Phaser.Input.Keyboard.Key;
  playerId: PlayerId;
}

export class ArenaScene extends Phaser.Scene {
  private arena!: Arena;
  private players: Player[] = [];
  private inputSystem!: InputSystem;
  private projectileSystem!: ProjectileSystem;
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
      objective: OBJECTIVE_TEXT,
      players: this.players.map((player) =>
        createPlayerHudState(player.id),
      ),
      boss: null,
      debug: { players: [], projectiles: 0, fps: 0 },
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

    this.projectileSystem.update(delta);
    this.handleDebugDamage();
    this.coopCamera.update(this.players);
    this.syncHudState();
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
      projectiles: this.projectileSystem.count,
      fps: this.game.loop.actualFps,
    };
  }

  private handleShutdown(): void {
    this.scene.stop(SceneKeys.Hud);
    this.inputSystem.destroy();
    this.removeDebugDamageKeys();
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
