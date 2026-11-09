import Phaser from 'phaser';
import { Cooldown } from './Cooldown';

export interface DashHost {
  body: Phaser.Physics.Arcade.Body;
}

export class DashComponent {
  readonly cooldown: Cooldown;

  private readonly direction = new Phaser.Math.Vector2(1, 0);
  private remainingMs = 0;

  constructor(
    private readonly host: DashHost,
    private readonly durationMs: number,
    private readonly speed: number,
    cooldownMs: number,
  ) {
    this.cooldown = new Cooldown(cooldownMs);
  }

  update(deltaMs: number): void {
    this.cooldown.update(deltaMs);

    if (this.remainingMs <= 0) {
      return;
    }

    this.remainingMs = Math.max(0, this.remainingMs - deltaMs);

    if (this.remainingMs <= 0) {
      this.host.body.setVelocity(0, 0);
      return;
    }

    this.host.body.setVelocity(
      this.direction.x * this.speed,
      this.direction.y * this.speed,
    );
  }

  tryStart(direction: Phaser.Math.Vector2): boolean {
    if (this.isDashing || !this.cooldown.isReady) {
      return false;
    }

    if (direction.lengthSq() === 0) {
      return false;
    }

    this.direction.copy(direction).normalize();
    this.cooldown.tryUse();
    this.remainingMs = this.durationMs;
    this.host.body.setVelocity(
      this.direction.x * this.speed,
      this.direction.y * this.speed,
    );

    return true;
  }

  cancel(): void {
    this.remainingMs = 0;
    this.host.body.setVelocity(0, 0);
  }

  get isDashing(): boolean {
    return this.remainingMs > 0;
  }

  get activeRatio(): number {
    return this.durationMs > 0 ? this.remainingMs / this.durationMs : 0;
  }
}
