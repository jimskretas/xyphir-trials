import { TextureKeys } from '../resources/textureKeys';
import type { ProjectilePreset } from '../types/combat';

export const FIREBALL = {
  cooldownMs: 550,
  spawnOffset: 30,
  projectile: {
    texture: TextureKeys.Fireball,
    speed: 500,
    damage: 20,
    radius: 6,
    reflectable: true,
  } satisfies ProjectilePreset,
} as const;

export const SHIELD = {
  durationMs: 800,
  cooldownMs: 1800,
  arcDegrees: 140,
  visualRadius: 30,
  reflectOffset: 40,
  reflectLockMs: 150,
  flashMs: 160,
  enemyReflectDamageMultiplier: 1.25,
  enemyReflectScale: 1.5,
  allyReflectDamageMultiplier: 1.5,
  allyReflectScale: 3,
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
    radius: 5,
    reflectable: true,
    tint: 0xc084fc,
  } satisfies ProjectilePreset,
} as const;

export const BOSS = {
  name: 'Xyphir Warden',
  maxHealth: 480,
  speed: 70,
  radius: 34,
  preferredDistance: 340,
  distanceTolerance: 50,
  retreatDistance: 230,
  attackIntervalMs: 2600,
  enragedAttackIntervalMs: 1600,
  telegraphMs: 750,
  enragedTelegraphMs: 550,
  burstCount: 3,
  burstSpacingMs: 130,
  novaCount: 16,
  spawnOffset: 52,
  spawnTelegraphMs: 1600,
  bolt: {
    texture: TextureKeys.BossBolt,
    speed: 280,
    damage: 12,
    radius: 7,
    reflectable: true,
    tint: 0xf472b6,
  } satisfies ProjectilePreset,
} as const;
