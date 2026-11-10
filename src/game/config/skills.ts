import { TextureKeys } from '../resources/textureKeys';
import type { ProjectilePreset } from '../types/combat';
import type { SkillDefinition } from '../skills/Skill';

export interface TurretSkillDefinition extends SkillDefinition {
  durationMs: number;
  range: number;
  fireIntervalMs: number;
  spawnOffset: number;
  radius: number;
  projectile: ProjectilePreset;
}

export interface WallSkillDefinition extends SkillDefinition {
  durationMs: number;
  length: number;
  thickness: number;
  spawnOffset: number;
}

export interface WaveSkillDefinition extends SkillDefinition {
  durationMs: number;
  radius: number;
  ticksPerSecond: number;
  damagePerTick: number;
}

/**
 * Base turret. Elemental variants can reuse this shape and add their own
 * modifiers, textures and projectile presets later.
 */
export const TURRET_SKILL: TurretSkillDefinition = {
  id: 'turret',
  name: 'Turret',
  description: 'Deploys a turret that fires at the nearest enemy.',
  cooldownMs: 5000,
  durationMs: 10000,
  range: 560,
  fireIntervalMs: 600,
  spawnOffset: 56,
  radius: 13,
  projectile: {
    texture: TextureKeys.TurretBolt,
    speed: 640,
    damage: 8,
    radius: 5,
    reflectable: false,
  },
};

/**
 * Conjured barrier. Oriented across the caster's facing and blocks every
 * projectile that crosses it, regardless of team.
 */
export const WALL_SKILL: WallSkillDefinition = {
  id: 'wall',
  name: 'Wall',
  description: 'Conjures a wall that blocks all projectiles.',
  cooldownMs: 10000,
  durationMs: 5000,
  length: 190,
  thickness: 20,
  spawnOffset: 72,
};

/**
 * Short-range damaging aura. Ticks per second is a data stat so future
 * powerups can raise the frequency without touching the skill logic.
 */
export const WAVE_SKILL: WaveSkillDefinition = {
  id: 'wave',
  name: 'Wave',
  description: 'Damages nearby enemies in repeated pulses.',
  cooldownMs: 10000,
  durationMs: 5000,
  radius: 120,
  ticksPerSecond: 2,
  damagePerTick: 14,
};
