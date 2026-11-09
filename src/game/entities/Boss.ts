import Phaser from 'phaser';
import { BOSS } from '../config/combatConfig';
import { TextureKeys } from '../resources/textureKeys';
import type { ProjectileSpawn } from '../types/combat';
import { EnemyBase } from './EnemyBase';
import type { Player } from './Player';

type BossPattern = 'burst' | 'nova';

const TELEGRAPH_TINT = 0xf472b6;

export class Boss extends EnemyBase {
  private attackTimerMs: number = BOSS.attackIntervalMs;
  private telegraphRemainingMs = 0;
  private pendingPattern: BossPattern = 'burst';
  private nextPattern: BossPattern = 'burst';
  private burstRemaining = 0;
  private burstTimerMs = 0;
  private pulseMs = 0;

  constructor(scene: Phaser.Scene, id: string, x: number, y: number) {
    super(scene, id, x, y, TextureKeys.Boss, {
      maxHealth: BOSS.maxHealth,
      speed: BOSS.speed,
      radius: BOSS.radius,
    });

    this.setDepth(9);
  }

  protected updateBehavior(
    deltaMs: number,
    target: Player | null,
  ): ProjectileSpawn[] {
    const shots: ProjectileSpawn[] = [];

    this.pulseMs += deltaMs;

    if (!target) {
      this.stopMoving();
      this.clearCharge();
      return shots;
    }

    if (this.telegraphRemainingMs > 0) {
      this.telegraphRemainingMs -= deltaMs;
      this.stopMoving();
      this.updateChargeVisual();

      if (this.telegraphRemainingMs <= 0) {
        this.launchPattern(target, shots);
      }

      return shots;
    }

    if (this.burstRemaining > 0) {
      this.stopMoving();
      this.burstTimerMs -= deltaMs;

      if (this.burstTimerMs <= 0) {
        this.emitBurstShot(target, shots);
        this.burstRemaining -= 1;
        this.burstTimerMs = BOSS.burstSpacingMs;
      }

      return shots;
    }

    this.reposition(target);

    this.attackTimerMs -= deltaMs;

    if (this.attackTimerMs <= 0) {
      this.pendingPattern = this.nextPattern;
      this.nextPattern = this.nextPattern === 'burst' ? 'nova' : 'burst';
      this.telegraphRemainingMs = this.enraged
        ? BOSS.enragedTelegraphMs
        : BOSS.telegraphMs;
      this.attackTimerMs = this.enraged
        ? BOSS.enragedAttackIntervalMs
        : BOSS.attackIntervalMs;
      this.setTint(TELEGRAPH_TINT);
      this.setScale(1);
    }

    return shots;
  }

  private get enraged(): boolean {
    return this.health.ratio <= 0.5;
  }

  private reposition(target: Player): void {
    const distance = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      target.x,
      target.y,
    );
    const angle = Phaser.Math.Angle.Between(
      this.x,
      this.y,
      target.x,
      target.y,
    );

    this.setRotation(angle);

    if (distance > BOSS.preferredDistance + BOSS.distanceTolerance) {
      this.moveToward(target);
    } else if (distance < BOSS.retreatDistance) {
      this.moveAwayFrom(target);
    } else {
      this.stopMoving();
    }
  }

  private launchPattern(target: Player, shots: ProjectileSpawn[]): void {
    this.clearCharge();

    if (this.pendingPattern === 'nova') {
      this.launchNova(shots);
      return;
    }

    this.burstRemaining = BOSS.burstCount;
    this.burstTimerMs = 0;
    this.setRotation(
      Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y),
    );
  }

  private launchNova(shots: ProjectileSpawn[]): void {
    for (let i = 0; i < BOSS.novaCount; i += 1) {
      const angle =
        this.rotation + (Math.PI * 2 * i) / BOSS.novaCount;
      shots.push(this.createShot(angle));
    }
  }

  private emitBurstShot(target: Player, shots: ProjectileSpawn[]): void {
    const index = BOSS.burstCount - this.burstRemaining;
    const spread = (index - (BOSS.burstCount - 1) / 2) * 0.08;
    const angle =
      Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y) +
      spread;

    shots.push(this.createShot(angle));
  }

  private createShot(angle: number): ProjectileSpawn {
    return {
      x: this.x + Math.cos(angle) * BOSS.spawnOffset,
      y: this.y + Math.sin(angle) * BOSS.spawnOffset,
      angle,
      team: 'enemies',
      ownerId: this.id,
      sourceId: this.id,
      preset: BOSS.bolt,
    };
  }

  private updateChargeVisual(): void {
    this.setTint(TELEGRAPH_TINT);
    this.setScale(1 + Math.sin(this.pulseMs / 45) * 0.08);
  }

  private clearCharge(): void {
    this.setScale(1);
    this.clearTint();
  }
}
