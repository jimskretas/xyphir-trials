import Phaser from 'phaser';
import { HealthComponent } from '../components/HealthComponent';
import type { Player } from './Player';
import type { ProjectileSpawn } from '../types/combat';

export interface EnemyStats {
  maxHealth: number;
  speed: number;
  radius: number;
}

const HIT_FLASH_MS = 100;

export abstract class EnemyBase extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;

  readonly health: HealthComponent;

  private hitTimer: Phaser.Time.TimerEvent | null = null;
  private readonly stats: EnemyStats;

  constructor(
    scene: Phaser.Scene,
    readonly id: string,
    x: number,
    y: number,
    texture: string,
    stats: EnemyStats,
  ) {
    super(scene, x, y, texture);

    this.stats = stats;
    this.health = new HealthComponent(stats.maxHealth);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const bodyOffset = this.width / 2 - stats.radius;
    this.body.setCircle(stats.radius, bodyOffset, bodyOffset);

    this.setDepth(8);
  }

  update(deltaMs: number, players: readonly Player[]): ProjectileSpawn[] {
    this.health.update(deltaMs);

    if (!this.health.isAlive) {
      return [];
    }

    const target = this.findNearestPlayer(players);
    return this.updateBehavior(deltaMs, target);
  }

  takeDamage(amount: number): boolean {
    const applied = this.health.damage(amount);

    if (applied <= 0) {
      return false;
    }

    this.flashHit();

    if (!this.health.isAlive) {
      this.setActive(false);
      this.body.enable = false;
    }

    return true;
  }

  get isAlive(): boolean {
    return this.health.isAlive;
  }

  get speed(): number {
    return this.stats.speed;
  }

  override destroy(fromScene?: boolean): void {
    this.hitTimer?.remove();
    this.hitTimer = null;
    super.destroy(fromScene);
  }

  protected abstract updateBehavior(
    deltaMs: number,
    target: Player | null,
  ): ProjectileSpawn[];

  protected stopMoving(): void {
    this.setVelocity(0, 0);
  }

  protected moveToward(target: Player): void {
    const direction = this.getSteeringDirection(target, 1);
    this.setVelocity(direction.x * this.speed, direction.y * this.speed);
  }

  protected moveAwayFrom(target: Player): void {
    const direction = this.getSteeringDirection(target, -1);
    this.setVelocity(direction.x * this.speed, direction.y * this.speed);
  }

  private getSteeringDirection(
    target: Player,
    sign: number,
  ): Phaser.Math.Vector2 {
    const direction = new Phaser.Math.Vector2(
      (target.x - this.x) * sign,
      (target.y - this.y) * sign,
    ).normalize();

    if (this.body.blocked.left || this.body.blocked.right) {
      direction.set(0, Math.sign(target.y - this.y) || 1);
    } else if (this.body.blocked.up || this.body.blocked.down) {
      direction.set(Math.sign(target.x - this.x) || 1, 0);
    }

    return direction.normalize();
  }

  private findNearestPlayer(players: readonly Player[]): Player | null {
    let nearest: Player | null = null;
    let nearestDistanceSq = Number.POSITIVE_INFINITY;

    for (const player of players) {
      if (!player.isAlive) {
        continue;
      }

      const distanceSq = Phaser.Math.Distance.Squared(
        this.x,
        this.y,
        player.x,
        player.y,
      );

      if (distanceSq < nearestDistanceSq) {
        nearest = player;
        nearestDistanceSq = distanceSq;
      }
    }

    return nearest;
  }

  private flashHit(): void {
    this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);

    this.hitTimer?.remove();
    this.hitTimer = this.scene.time.delayedCall(HIT_FLASH_MS, () => {
      this.hitTimer = null;
      this.clearTint();
    });
  }
}
