import Phaser from 'phaser';
import { ARENA } from '../config/gameplayConfig';
import type { PlayerId } from '../config/controls';
import type { TurretSkillDefinition } from '../config/skills';
import { Turret } from '../entities/Turret';
import type { ProjectileSpawn } from '../types/combat';
import {
  Skill,
  type SkillCastContext,
  type SkillModifiers,
  type SkillUpdateContext,
} from './Skill';

export interface TurretRenderState {
  ownerId: PlayerId;
  x: number;
  y: number;
  rotation: number;
  alpha: number;
}

export class TurretSkill extends Skill {
  private turret: Turret | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly turretDefinition: TurretSkillDefinition,
    modifierOverrides: Partial<SkillModifiers> = {},
  ) {
    super(turretDefinition, modifierOverrides);
  }

  override update(
    deltaMs: number,
    context: SkillUpdateContext,
  ): ProjectileSpawn[] {
    super.update(deltaMs, context);

    if (!this.turret) {
      return [];
    }

    const shots = this.turret.update(deltaMs, context.enemies);

    if (this.turret.isExpired) {
      this.turret.destroy();
      this.turret = null;
    }

    return shots;
  }

  override get isActive(): boolean {
    return this.turret !== null;
  }

  override get activeRatio(): number {
    return this.turret?.activeRatio ?? 0;
  }

  get renderState(): TurretRenderState | null {
    const turret = this.turret;

    if (!turret) {
      return null;
    }

    return {
      ownerId: turret.ownerId,
      x: turret.x,
      y: turret.y,
      rotation: turret.rotation,
      alpha: turret.alpha,
    };
  }

  protected override cast(context: SkillCastContext): void {
    this.turret?.destroy();

    const facing = context.player.facingVector;
    const padding = ARENA.wallThickness + this.turretDefinition.radius;
    const x = Phaser.Math.Clamp(
      context.player.x + facing.x * this.turretDefinition.spawnOffset,
      padding,
      ARENA.width - padding,
    );
    const y = Phaser.Math.Clamp(
      context.player.y + facing.y * this.turretDefinition.spawnOffset,
      padding,
      ARENA.height - padding,
    );

    this.turret = new Turret(this.scene, x, y, {
      ownerId: context.player.id,
      durationMs:
        this.turretDefinition.durationMs * this.modifiers.duration,
      range: this.turretDefinition.range * this.modifiers.range,
      fireIntervalMs:
        this.turretDefinition.fireIntervalMs /
        Math.max(0.01, this.modifiers.fireRate),
      damage:
        this.turretDefinition.projectile.damage * this.modifiers.damage,
      projectile: {
        ...this.turretDefinition.projectile,
        speed:
          this.turretDefinition.projectile.speed *
          this.modifiers.projectileSpeed,
      },
      radius: this.turretDefinition.radius,
    });
  }
}
