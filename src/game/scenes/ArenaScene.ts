import Phaser from 'phaser';
import { ARENA, PLAYER } from '../config/gameplayConfig';
import { PLAYER_CONTROLS } from '../config/controls';
import { SceneKeys } from '../config/sceneKeys';
import { Player } from '../entities/Player';
import { createPlaceholderTextures } from '../resources/placeholderTextures';
import { CoopCamera } from '../systems/CoopCamera';
import { InputSystem } from '../systems/InputSystem';
import { createPlayerHudState } from '../ui/hudState';
import type { DebugSnapshot, HudModel } from '../ui/HudModel';
import { Arena } from '../world/Arena';

const OBJECTIVE_TEXT = 'Survive the trials.';

export class ArenaScene extends Phaser.Scene {
  private arena!: Arena;
  private players: Player[] = [];
  private inputSystem!: InputSystem;
  private coopCamera!: CoopCamera;
  private hudModel!: HudModel;

  constructor() {
    super(SceneKeys.Arena);
  }

  create(): void {
    createPlaceholderTextures(this);

    this.arena = new Arena(this);
    this.players = this.createPlayers();

    this.physics.add.collider(this.players, this.arena.walls);
    this.physics.add.collider(this.players[0], this.players[1]);

    const { bounds } = this.arena;
    this.physics.world.setBounds(
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
    );

    this.inputSystem = new InputSystem(this);
    this.coopCamera = new CoopCamera(this, this.cameras.main, bounds);
    this.coopCamera.update(this.players);

    this.hudModel = {
      objective: OBJECTIVE_TEXT,
      players: this.players.map((player) =>
        createPlayerHudState(player.id),
      ),
      boss: null,
      debug: { players: [], fps: 0 },
      outcome: null,
    };

    this.scene.launch(SceneKeys.Hud, { model: this.hudModel });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  update(_time: number, _delta: number): void {
    this.inputSystem.update();

    for (const player of this.players) {
      player.update(this.inputSystem.getState(player.id).movement);
    }

    this.coopCamera.update(this.players);
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

  private createDebugSnapshot(): DebugSnapshot {
    return {
      players: this.players.map((player) => ({
        label: PLAYER_CONTROLS[player.id].label,
        position: { x: player.x, y: player.y },
        velocity: player.body.velocity,
        direction: player.movementDirection,
        facingDegrees: player.facingDegrees,
        blocked: player.body.blocked,
      })),
      fps: this.game.loop.actualFps,
    };
  }

  private handleShutdown(): void {
    this.scene.stop(SceneKeys.Hud);
    this.inputSystem.destroy();
    this.coopCamera.destroy();
    this.arena.destroy();

    for (const player of this.players) {
      player.destroy();
    }

    this.players = [];
  }
}
