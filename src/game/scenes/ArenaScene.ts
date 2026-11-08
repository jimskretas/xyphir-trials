import Phaser from 'phaser';
import { ARENA, CAMERA } from '../config/gameplayConfig';
import { COLORS, toCssColor } from '../config/theme';
import { Player } from '../entities/Player';
import { createPlaceholderTextures } from '../resources/placeholderTextures';
import { InputSystem } from '../systems/InputSystem';
import { DebugOverlay } from '../ui/DebugOverlay';
import { Arena } from '../world/Arena';

export class ArenaScene extends Phaser.Scene {
  private arena!: Arena;
  private player!: Player;
  private inputSystem!: InputSystem;
  private debugOverlay!: DebugOverlay;

  constructor() {
    super('ArenaScene');
  }

  create(): void {
    createPlaceholderTextures(this);

    this.arena = new Arena(this);
    this.player = new Player(this, ARENA.width / 2, ARENA.height / 2);

    this.physics.add.collider(this.player, this.arena.walls);

    this.inputSystem = new InputSystem(this);
    this.setupCamera();
    this.debugOverlay = new DebugOverlay(this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  update(_time: number, delta: number): void {
    const movement = this.inputSystem.getMovement();
    const aimTarget = this.inputSystem.getPointerWorld(this.cameras.main);

    this.player.update(movement, aimTarget, delta);

    this.debugOverlay.update({
      position: { x: this.player.x, y: this.player.y },
      velocity: this.player.body.velocity,
      direction: this.player.movementDirection,
      facingDegrees: this.player.facingDegrees,
      blocked: this.player.body.blocked,
      fps: this.game.loop.actualFps,
    });
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

    camera.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
    camera.setBackgroundColor(toCssColor(COLORS.background));
    camera.startFollow(
      this.player,
      false,
      CAMERA.followLerp,
      CAMERA.followLerp,
    );
    camera.setDeadzone(CAMERA.deadzoneWidth, CAMERA.deadzoneHeight);
  }

  private handleShutdown(): void {
    this.inputSystem.destroy();
    this.debugOverlay.destroy();
    this.arena.destroy();
    this.player.destroy();
  }
}
