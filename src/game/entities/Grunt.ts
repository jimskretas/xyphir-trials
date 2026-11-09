import Phaser from 'phaser';
import { GRUNT } from '../config/combatConfig';
import { Cooldown } from '../components/Cooldown';
import { TextureKeys } from '../resources/textureKeys';
import type { ProjectileSpawn } from '../types/combat';
import { EnemyBase } from './EnemyBase';
import type { Player } from './Player';

export class Grunt extends EnemyBase {
  private readonly shotCooldown = new Cooldown(GRUNT.fireIntervalMs);

  constructor(scene: Phaser.Scene, id: string, x: number, y: number) {
    super(scene, id, x, y, TextureKeys.Grunt, {
      maxHealth: GRUNT.maxHealth,
      speed: GRUNT.speed,
      radius: GRUNT.radius,
    });
  }

  protected updateBehavior(
    deltaMs: number,
    target: Player | null,
  ): ProjectileSpawn[] {
    this.shotCooldown.update(deltaMs);

    if (!target) {
      this.stopMoving();
      return [];
    }

    const distance = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      target.x,
      target.y,
    );
    const aimAngle = Phaser.Math.Angle.Between(
      this.x,
      this.y,
      target.x,
      target.y,
    );

    this.setRotation(aimAngle);

    if (distance > GRUNT.preferredDistance + GRUNT.distanceTolerance) {
      this.moveToward(target);
    } else if (distance < GRUNT.retreatDistance) {
      this.moveAwayFrom(target);
    } else {
      this.stopMoving();
    }

    if (distance > GRUNT.fireRange || !this.shotCooldown.tryUse()) {
      return [];
    }

    return [
      {
        x: this.x + Math.cos(aimAngle) * GRUNT.spawnOffset,
        y: this.y + Math.sin(aimAngle) * GRUNT.spawnOffset,
        angle: aimAngle,
        team: 'enemies',
        ownerId: this.id,
        sourceId: this.id,
        preset: GRUNT.bolt,
      },
    ];
  }
}
