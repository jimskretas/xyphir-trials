import Phaser from 'phaser';
import { Cooldown } from './Cooldown';

export class ShieldComponent {
  readonly cooldown: Cooldown;

  private activeRemainingMs = 0;
  private flashRemainingMs = 0;

  constructor(
    private readonly durationMs: number,
    cooldownMs: number,
    readonly arcRadians: number,
  ) {
    this.cooldown = new Cooldown(cooldownMs);
  }

  update(deltaMs: number): void {
    this.cooldown.update(deltaMs);
    this.activeRemainingMs = Math.max(0, this.activeRemainingMs - deltaMs);
    this.flashRemainingMs = Math.max(0, this.flashRemainingMs - deltaMs);
  }

  tryActivate(): boolean {
    if (this.isActive || !this.cooldown.isReady) {
      return false;
    }

    this.cooldown.tryUse();
    this.activeRemainingMs = this.durationMs;
    return true;
  }

  blocks(
    sourceX: number,
    sourceY: number,
    hostX: number,
    hostY: number,
    facingRadians: number,
  ): boolean {
    if (!this.isActive) {
      return false;
    }

    const sourceAngle = Phaser.Math.Angle.Between(
      hostX,
      hostY,
      sourceX,
      sourceY,
    );

    return (
      Math.abs(Phaser.Math.Angle.Wrap(sourceAngle - facingRadians)) <=
      this.arcRadians / 2
    );
  }

  flash(durationMs: number): void {
    this.flashRemainingMs = durationMs;
  }

  cancel(): void {
    this.activeRemainingMs = 0;
    this.flashRemainingMs = 0;
  }

  get isActive(): boolean {
    return this.activeRemainingMs > 0;
  }

  get isFlashing(): boolean {
    return this.flashRemainingMs > 0;
  }

  get activeRatio(): number {
    return this.durationMs > 0
      ? this.activeRemainingMs / this.durationMs
      : 0;
  }
}
