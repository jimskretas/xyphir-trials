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
    fireball: null,
    shield: null,
  };
}
