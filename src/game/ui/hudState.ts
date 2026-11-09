import { PLAYER } from '../config/gameplayConfig';
import type { PlayerId } from '../config/controls';
import type { PlayerHudState } from './HudModel';
import { PLAYER_CONTROLS } from '../config/controls';

export function createPlayerHudState(id: PlayerId): PlayerHudState {
  return {
    id,
    label: PLAYER_CONTROLS[id].label,
    health: PLAYER.maxHealth,
    maxHealth: PLAYER.maxHealth,
    downed: false,
    autoAttack: false,
    fireball: {
      label: 'FIREBALL',
      ready: true,
      active: false,
      ratio: 1,
    },
    shield: {
      label: 'SHIELD',
      ready: true,
      active: false,
      ratio: 1,
    },
    dash: {
      label: 'DASH',
      ready: true,
      active: false,
      ratio: 1,
    },
  };
}
