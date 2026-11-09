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
