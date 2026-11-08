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

export const GRUNT = {
  maxHealth: 60,
  speed: 90,
  radius: 14,
  preferredDistance: 260,
  distanceTolerance: 40,
  retreatDistance: 180,
  fireRange: 420,
  fireIntervalMs: 1800,
  spawnOffset: 24,
  bolt: {
    texture: TextureKeys.EnemyBolt,
    speed: 300,
    damage: 10,
    lifetimeMs: 3000,
    radius: 5,
    reflectable: true,
    reflectDamageMultiplier: 1.5,
    tint: 0xc084fc,
  } satisfies ProjectilePreset,
} as const;
