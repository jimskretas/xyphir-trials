import Phaser from 'phaser';
import { ARENA } from '../config/gameplayConfig';
import type { Player } from '../entities/Player';
import type { CloneSkillDefinition } from '../config/skills';
import { Clone } from '../entities/Clone';
import type { CloneRenderState } from '../entities/Clone';
import { TextureKeys } from '../resources/textureKeys';
import type { ProjectileSpawn } from '../types/combat';
import {
  Skill,
  type SkillCastContext,
  type SkillModifiers,
  type SkillUpdateContext,
} from './Skill';

const CLONE_TEXTURES = {
  p1: TextureKeys.PlayerOne,
  p2: TextureKeys.PlayerTwo,
} as const;

export class CloneSkill extends Skill {
  private clone: Clone | null = null;
  private owner: Player | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly cloneDefinition: CloneSkillDefinition,
    private readonly group: Phaser.GameObjects.Group,
    modifierOverrides: Partial<SkillModifiers> = {},
  ) {
    super(cloneDefinition, modifierOverrides);
  }

  override update(
    deltaMs: number,
    context: SkillUpdateContext,
  ): ProjectileSpawn[] {
    super.update(deltaMs, context);

    const clone = this.clone;

    if (!clone) {
      return [];
    }

    const shots = clone.update(deltaMs, this.owner);

    if (!clone.isAlive || clone.isExpired) {
      this.destroyClone();
    }

    return shots;
  }

  override get isActive(): boolean {
    return this.clone !== null;
  }

  override get activeRatio(): number {
    return this.clone?.activeRatio ?? 0;
  }

  get activeClone(): Clone | null {
    return this.clone;
  }

  get renderState(): CloneRenderState | null {
    return this.clone?.renderState ?? null;
  }

  protected override cast(context: SkillCastContext): void {
    this.destroyClone();

    const player = context.player;
    const facing = player.facingVector;
    const margin = ARENA.wallThickness + this.cloneDefinition.radius;
    const x = Phaser.Math.Clamp(
      player.x + facing.x * this.cloneDefinition.spawnOffset,
      margin,
      ARENA.width - margin,
    );
    const y = Phaser.Math.Clamp(
      player.y + facing.y * this.cloneDefinition.spawnOffset,
      margin,
      ARENA.height - margin,
    );
    const maxHealth = Math.max(
      1,
      Math.ceil(player.health.current * this.cloneDefinition.healthFraction),
    );

    this.owner = player;
    this.clone = new Clone(
      this.scene,
      x,
      y,
      CLONE_TEXTURES[player.id],
      {
        ownerId: player.id,
        durationMs:
          this.cloneDefinition.durationMs * this.modifiers.duration,
        maxHealth,
        fireIntervalMs: this.cloneDefinition.fireIntervalMs,
        projectileOffset: this.cloneDefinition.projectileOffset,
        radius: this.cloneDefinition.radius,
        projectile: this.cloneDefinition.projectile,
      },
    );
    this.group.add(this.clone);
  }

  private destroyClone(): void {
    const clone = this.clone;

    if (!clone) {
      return;
    }

    this.clone = null;
    this.owner = null;
    this.group.remove(clone, false, false);
    clone.destroy();
  }
}
