import Phaser from 'phaser';
import type { PlayerId } from '../config/controls';
import { TextureKeys } from '../resources/textureKeys';
import type { ProjectilePreset, ProjectileSpawn } from '../types/combat';
import type { EnemyBase } from './EnemyBase';

export interface TurretStats {
  ownerId: PlayerId;
  durationMs: number;
  range: number;
  fireIntervalMs: number;
  damage: number;
  projectile: ProjectilePreset;
  radius: number;
}

export class Turret extends Phaser.GameObjects.Image {
  private remainingMs: number;
  private fireCooldownMs = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly stats: TurretStats,
  ) {
    super(scene, x, y, TextureKeys.Turret);

    this.remainingMs = stats.durationMs;
    this.setDepth(9);
    scene.add.existing(this);
  }

  update(
    deltaMs: number,
    enemies: readonly EnemyBase[],
  ): ProjectileSpawn[] {
    this.remainingMs = Math.max(0, this.remainingMs - deltaMs);
    this.fireCooldownMs = Math.max(0, this.fireCooldownMs - deltaMs);

    if (this.remainingMs <= 0) {
      return [];
    }

    if (this.remainingMs < 2000) {
      this.setAlpha(0.4 + 0.6 * (this.remainingMs / 2000));
    }

    const target = this.findNearestEnemy(enemies);

    if (!target) {
      return [];
    }

    const angle = Phaser.Math.Angle.Between(
      this.x,
      this.y,
      target.x,
      target.y,
    );

    this.setRotation(angle);

    if (this.fireCooldownMs > 0) {
      return [];
    }

    this.fireCooldownMs = this.stats.fireIntervalMs;

    const muzzleOffset = this.stats.radius + 4;

    return [
      {
        x: this.x + Math.cos(angle) * muzzleOffset,
        y: this.y + Math.sin(angle) * muzzleOffset,
        angle,
        team: 'players',
        ownerId: this.stats.ownerId,
        sourceId: `turret-${this.stats.ownerId}`,
        preset: this.stats.projectile,
        damage: this.stats.damage,
      },
    ];
  }

  get isExpired(): boolean {
    return this.remainingMs <= 0;
  }

  get ownerId(): PlayerId {
    return this.stats.ownerId;
  }

  get activeRatio(): number {
    return this.stats.durationMs > 0
      ? this.remainingMs / this.stats.durationMs
      : 0;
  }

  private findNearestEnemy(
    enemies: readonly EnemyBase[],
  ): EnemyBase | null {
    let nearest: EnemyBase | null = null;
    let nearestDistanceSq = this.stats.range * this.stats.range;

    for (const enemy of enemies) {
      if (!enemy.isAlive) {
        continue;
      }

      const distanceSq = Phaser.Math.Distance.Squared(
        this.x,
        this.y,
        enemy.x,
        enemy.y,
      );

      if (distanceSq <= nearestDistanceSq) {
        nearest = enemy;
        nearestDistanceSq = distanceSq;
      }
    }

    return nearest;
  }
}
