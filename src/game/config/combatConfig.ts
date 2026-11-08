import { TextureKeys } from '../resources/textureKeys';
import type { ProjectilePreset } from '../types/combat';

export const FIREBALL = {
  cooldownMs: 550,
  spawnOffset: 30,
  projectile: {
    texture: TextureKeys.Fireball,
    speed: 520,
    damage: 20,
    lifetimeMs: 1800,
    radius: 6,
    reflectable: true,
    reflectDamageMultiplier: 1.5,
  } satisfies ProjectilePreset,
} as const;
