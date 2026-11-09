import type { EnemyBase } from '../entities/EnemyBase';
import type { Player } from '../entities/Player';
import type { ProjectileSpawn } from '../types/combat';
import { Cooldown } from '../components/Cooldown';

/**
 * Multiplicative hooks for a skill. A value of 1 leaves the base stat
 * unchanged, so future modifiers, buffs and elemental variants can adjust a
 * skill without changing its implementation.
 */
export interface SkillModifiers {
  cooldown: number;
  duration: number;
  damage: number;
  projectileSpeed: number;
  range: number;
  fireRate: number;
}

export const DEFAULT_SKILL_MODIFIERS: SkillModifiers = {
  cooldown: 1,
  duration: 1,
  damage: 1,
  projectileSpeed: 1,
  range: 1,
  fireRate: 1,
};

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  cooldownMs: number;
}

export interface SkillCastContext {
  player: Player;
}

export interface SkillUpdateContext {
  enemies: readonly EnemyBase[];
}

export abstract class Skill {
  readonly cooldown: Cooldown;
  readonly modifiers: SkillModifiers;

  constructor(
    readonly definition: SkillDefinition,
    modifierOverrides: Partial<SkillModifiers> = {},
  ) {
    this.modifiers = { ...DEFAULT_SKILL_MODIFIERS, ...modifierOverrides };
    this.cooldown = new Cooldown(
      definition.cooldownMs * this.modifiers.cooldown,
    );
  }

  update(
    deltaMs: number,
    _context: SkillUpdateContext,
  ): ProjectileSpawn[] {
    this.cooldown.update(deltaMs);
    return [];
  }

  tryCast(context: SkillCastContext): boolean {
    if (!context.player.isAlive || !this.cooldown.isReady) {
      return false;
    }

    this.cooldown.tryUse();
    this.cast(context);
    return true;
  }

  get isReady(): boolean {
    return this.cooldown.isReady;
  }

  get isActive(): boolean {
    return false;
  }

  get activeRatio(): number {
    return 0;
  }

  get statusRatio(): number {
    return this.isActive ? this.activeRatio : this.cooldown.readyRatio;
  }

  protected abstract cast(context: SkillCastContext): void;
}
