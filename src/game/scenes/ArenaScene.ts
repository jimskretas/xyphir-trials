import Phaser from 'phaser';
import { ARENA, CAMERA, PLAYER } from '../config/gameplayConfig';
import { PLAYER_CONTROLS } from '../config/controls';
import { COLORS, toCssColor } from '../config/theme';
import { Player } from '../entities/Player';
import { createPlaceholderTextures } from '../resources/placeholderTextures';
import { InputSystem } from '../systems/InputSystem';
import { DebugOverlay } from '../ui/DebugOverlay';
import { Arena } from '../world/Arena';

export class ArenaScene extends Phaser.Scene {
  private arena!: Arena;
  private players: Player[] = [];
  private inputSystem!: InputSystem;
  private debugOverlay!: DebugOverlay;
  private cameraTarget!: Phaser.GameObjects.Zone;
  private readonly midpoint = new Phaser.Math.Vector2();

  constructor() {
    super('ArenaScene');
  }

  create(): void {
    createPlaceholderTextures(this);

    this.arena = new Arena(this);
    this.players = this.createPlayers();

    this.physics.add.collider(this.players, this.arena.walls);
    this.physics.add.collider(this.players[0], this.players[1]);

    this.inputSystem = new InputSystem(this);
    this.setupCamera();
    this.debugOverlay = new DebugOverlay(this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  update(_time: number, _delta: number): void {
    this.inputSystem.update();

    for (const player of this.players) {
      player.update(this.inputSystem.getState(player.id).movement);
    }

    this.updateCameraTarget();

    this.debugOverlay.update({
      players: this.players.map((player) => ({
        label: PLAYER_CONTROLS[player.id].label,
        position: { x: player.x, y: player.y },
        velocity: player.body.velocity,
        direction: player.movementDirection,
        facingDegrees: player.facingDegrees,
        blocked: player.body.blocked,
      })),
      fps: this.game.loop.actualFps,
    });
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

  private computeMidpoint(): void {
    let x = 0;
    let y = 0;

    for (const player of this.players) {
      x += player.x;
      y += player.y;
    }

    this.midpoint.set(x / this.players.length, y / this.players.length);
  }

  private updateCameraTarget(): void {
    this.computeMidpoint();
    this.cameraTarget.setPosition(this.midpoint.x, this.midpoint.y);
  }

  private setupCamera(): void {
    const camera = this.cameras.main;
    const { bounds } = this.arena;

    this.physics.world.setBounds(
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
    );

    this.computeMidpoint();
    this.cameraTarget = this.add.zone(
      this.midpoint.x,
      this.midpoint.y,
      1,
      1,
    );

    camera.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
    camera.setBackgroundColor(toCssColor(COLORS.background));
    camera.startFollow(
      this.cameraTarget,
      false,
      CAMERA.followLerp,
      CAMERA.followLerp,
    );
    camera.setDeadzone(CAMERA.deadzoneWidth, CAMERA.deadzoneHeight);
  }

  private handleShutdown(): void {
    this.inputSystem.destroy();
    this.debugOverlay.destroy();
    this.cameraTarget.destroy();
    this.arena.destroy();

    for (const player of this.players) {
      player.destroy();
    }

    this.players = [];
  }
}
