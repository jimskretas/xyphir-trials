import { FIREBALL, GRUNT } from './combatConfig';
import type { Team } from '../types/combat';

const MIN_DAMAGE = 0;
const MAX_DAMAGE = 100;

export const combatTuning = {
  playerBulletDamage: FIREBALL.projectile.damage as number,
  enemyBulletDamage: GRUNT.bolt.damage as number,
};

export const getBulletDamage = (team: Team): number =>
  team === 'players'
    ? combatTuning.playerBulletDamage
    : combatTuning.enemyBulletDamage;

export const adjustBulletDamage = (
  key: keyof typeof combatTuning,
  delta: number,
): number => {
  combatTuning[key] = Math.min(
    MAX_DAMAGE,
    Math.max(MIN_DAMAGE, combatTuning[key] + delta),
  );

  return combatTuning[key];
};
