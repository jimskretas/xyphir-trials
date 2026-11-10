import Phaser from 'phaser';
import type { PlayerId } from '../config/controls';
import { COLORS } from '../config/theme';
import type { Projectile } from './Projectile';

const WALL_COLORS: Record<PlayerId, number> = {
  p1: COLORS.playerOne,
  p2: COLORS.playerTwo,
};

const FADE_MS = 1200;

export interface WallStats {
  ownerId: PlayerId;
  durationMs: number;
  length: number;
  thickness: number;
}

/**
 * Oriented barrier that blocks projectiles from both teams. It has no physics
 * body because Arcade bodies are axis-aligned; blocking is done by testing
 * each projectile against the wall's local rectangle.
 */
export class Wall extends Phaser.GameObjects.Rectangle {
  readonly ownerId: PlayerId;

  private readonly durationMs: number;
  private readonly halfLength: number;
  private readonly halfThickness: number;
  private remainingMs: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    rotation: number,
    stats: WallStats,
  ) {
    const color = WALL_COLORS[stats.ownerId];

    super(scene, x, y, stats.length, stats.thickness, color, 0.28);

    this.ownerId = stats.ownerId;
    this.durationMs = stats.durationMs;
    this.remainingMs = stats.durationMs;
    this.halfLength = stats.length / 2;
    this.halfThickness = stats.thickness / 2;

    this.setRotation(rotation);
    this.setStrokeStyle(2, color, 0.9);
    this.setDepth(7);

    scene.add.existing(this);
  }

  update(deltaMs: number): void {
    this.remainingMs = Math.max(0, this.remainingMs - deltaMs);

    if (this.remainingMs < FADE_MS) {
      this.setAlpha(0.35 + 0.65 * (this.remainingMs / FADE_MS));
    }
  }

  blocksProjectile(projectile: Projectile): boolean {
    return this.blocksPoint(projectile.x, projectile.y, projectile.preset.radius);
  }

  private blocksPoint(x: number, y: number, padding: number): boolean {
    const dx = x - this.x;
    const dy = y - this.y;
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    const localX = dx * cos + dy * sin;
    const localY = -dx * sin + dy * cos;

    return (
      Math.abs(localX) <= this.halfLength + padding &&
      Math.abs(localY) <= this.halfThickness + padding
    );
  }

  get isExpired(): boolean {
    return this.remainingMs <= 0;
  }

  get activeRatio(): number {
    return this.durationMs > 0 ? this.remainingMs / this.durationMs : 0;
  }
}
