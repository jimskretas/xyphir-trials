import Phaser from 'phaser';
import { Cooldown } from '../components/Cooldown';
import { HealthComponent } from '../components/HealthComponent';
import type { PlayerId } from '../config/controls';
import { COLORS } from '../config/theme';
import type { ProjectilePreset, ProjectileSpawn } from '../types/combat';
import type { EnemyTarget } from './EnemyBase';

const FADE_MS = 800;
const BAR_WIDTH = 48;
const BAR_HEIGHT = 5;

export const CLONE_TINT = 0xa5b4fc;

export interface CloneStats {
  ownerId: PlayerId;
  durationMs: number;
  maxHealth: number;
  fireIntervalMs: number;
  projectileOffset: number;
  radius: number;
  projectile: ProjectilePreset;
}

export interface CloneRenderState {
  ownerId: PlayerId;
  x: number;
  y: number;
  rotation: number;
  alpha: number;
  health: number;
  maxHealth: number;
}

export class Clone
  extends Phaser.Physics.Arcade.Sprite
  implements EnemyTarget
{
  declare body: Phaser.Physics.Arcade.Body;

  readonly cloneId: string;
  readonly health: HealthComponent;

  private readonly stats: CloneStats;
  private readonly fireCooldown: Cooldown;
  private readonly healthBar: Phaser.GameObjects.Graphics;
  private readonly color: number;
  private remainingMs: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    stats: CloneStats,
  ) {
    super(scene, x, y, texture);

    this.cloneId = `clone-${stats.ownerId}`;
    this.stats = stats;
    this.health = new HealthComponent(stats.maxHealth);
    this.fireCooldown = new Cooldown(stats.fireIntervalMs);
    this.remainingMs = stats.durationMs;
    this.color = stats.ownerId === 'p1' ? COLORS.playerOne : COLORS.playerTwo;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const bodyOffset = this.width / 2 - stats.radius;

    this.setCircle(stats.radius, bodyOffset, bodyOffset);
    this.setDepth(9);
    this.setTint(CLONE_TINT);
    this.healthBar = scene.add.graphics().setDepth(12);
    this.drawHealthBar();
  }

  update(deltaMs: number, owner: EnemyTarget | null): ProjectileSpawn[] {
    this.health.update(deltaMs);
    this.fireCooldown.update(deltaMs);
    this.remainingMs = Math.max(0, this.remainingMs - deltaMs);

    const fade =
      this.remainingMs < FADE_MS ? this.remainingMs / FADE_MS : 1;

    this.setAlpha(0.7 * fade);
    this.healthBar.setAlpha(fade);
    this.drawHealthBar();

    if (!owner || !owner.isAlive || !this.isAlive || this.isExpired) {
      return [];
    }

    const angle = Phaser.Math.Angle.Between(
      this.x,
      this.y,
      owner.x,
      owner.y,
    );

    this.setRotation(angle);

    if (!this.fireCooldown.tryUse()) {
      return [];
    }

    return [
      {
        x: this.x + Math.cos(angle) * this.stats.projectileOffset,
        y: this.y + Math.sin(angle) * this.stats.projectileOffset,
        angle,
        team: 'enemies',
        ownerId: this.cloneId,
        sourceId: this.cloneId,
        preset: this.stats.projectile,
        damage: this.stats.projectile.damage,
      },
    ];
  }

  takeDamage(amount: number): boolean {
    const applied = this.health.damage(amount);

    if (applied <= 0) {
      return false;
    }

    if (!this.health.isAlive) {
      this.body.enable = false;
      this.setActive(false);
      this.setVisible(false);
      this.healthBar.setVisible(false);
      return true;
    }

    this.drawHealthBar();
    return true;
  }

  get isAlive(): boolean {
    return this.health.isAlive;
  }

  get isExpired(): boolean {
    return this.remainingMs <= 0;
  }

  get activeRatio(): number {
    const durationMs = this.stats.durationMs;
    return durationMs > 0 ? this.remainingMs / durationMs : 0;
  }

  get renderState(): CloneRenderState {
    return {
      ownerId: this.stats.ownerId,
      x: this.x,
      y: this.y,
      rotation: this.rotation,
      alpha: this.alpha,
      health: this.health.current,
      maxHealth: this.health.maxHealth,
    };
  }

  override destroy(fromScene?: boolean): void {
    this.healthBar.destroy();
    super.destroy(fromScene);
  }

  private drawHealthBar(): void {
    const barX = this.x - BAR_WIDTH / 2;
    const barY = this.y - this.height / 2 - 12;

    this.healthBar.clear();
    this.healthBar.fillStyle(0x0b1220, 0.85);
    this.healthBar.fillRect(barX, barY, BAR_WIDTH, BAR_HEIGHT);
    this.healthBar.fillStyle(this.color, 0.9);
    this.healthBar.fillRect(
      barX,
      barY,
      Math.max(0, BAR_WIDTH * this.health.ratio),
      BAR_HEIGHT,
    );
    this.healthBar.lineStyle(1, this.color, 0.7);
    this.healthBar.strokeRect(barX, barY, BAR_WIDTH, BAR_HEIGHT);
  }
}
