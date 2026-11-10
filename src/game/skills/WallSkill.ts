import Phaser from 'phaser';
import { ARENA } from '../config/gameplayConfig';
import type { PlayerId } from '../config/controls';
import type { WallSkillDefinition } from '../config/skills';
import { Wall } from '../entities/Wall';
import type { Projectile } from '../entities/Projectile';
import type { ProjectileSpawn } from '../types/combat';
import {
  Skill,
  type SkillCastContext,
  type SkillModifiers,
  type SkillUpdateContext,
} from './Skill';

export interface WallRenderState {
  ownerId: PlayerId;
  x: number;
  y: number;
  rotation: number;
  length: number;
  thickness: number;
  alpha: number;
}

export class WallSkill extends Skill {
  private wall: Wall | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly wallDefinition: WallSkillDefinition,
    modifierOverrides: Partial<SkillModifiers> = {},
  ) {
    super(wallDefinition, modifierOverrides);
  }

  override update(
    deltaMs: number,
    context: SkillUpdateContext,
  ): ProjectileSpawn[] {
    super.update(deltaMs, context);

    if (!this.wall) {
      return [];
    }

    this.wall.update(deltaMs);

    if (this.wall.isExpired) {
      this.wall.destroy();
      this.wall = null;
    }

    return [];
  }

  override get isActive(): boolean {
    return this.wall !== null;
  }

  override get activeRatio(): number {
    return this.wall?.activeRatio ?? 0;
  }

  override blocksProjectile(projectile: Projectile): boolean {
    return this.wall?.blocksProjectile(projectile) ?? false;
  }

  get renderState(): WallRenderState | null {
    const wall = this.wall;

    if (!wall) {
      return null;
    }

    return {
      ownerId: wall.ownerId,
      x: wall.x,
      y: wall.y,
      rotation: wall.rotation,
      length: this.wallDefinition.length,
      thickness: this.wallDefinition.thickness,
      alpha: wall.alpha,
    };
  }

  protected override cast(context: SkillCastContext): void {
    this.wall?.destroy();

    const facing = context.player.facingVector;
    const rotation = facing.angle() + Math.PI / 2;
    const halfLength = this.wallDefinition.length / 2;
    const halfThickness = this.wallDefinition.thickness / 2;
    const cos = Math.abs(Math.cos(rotation));
    const sin = Math.abs(Math.sin(rotation));
    const halfWidth = cos * halfLength + sin * halfThickness;
    const halfHeight = sin * halfLength + cos * halfThickness;
    const margin = ARENA.wallThickness;
    const x = Phaser.Math.Clamp(
      context.player.x + facing.x * this.wallDefinition.spawnOffset,
      margin + halfWidth,
      ARENA.width - margin - halfWidth,
    );
    const y = Phaser.Math.Clamp(
      context.player.y + facing.y * this.wallDefinition.spawnOffset,
      margin + halfHeight,
      ARENA.height - margin - halfHeight,
    );

    this.wall = new Wall(this.scene, x, y, rotation, {
      ownerId: context.player.id,
      durationMs: this.wallDefinition.durationMs * this.modifiers.duration,
      length: this.wallDefinition.length,
      thickness: this.wallDefinition.thickness,
    });
  }
}
