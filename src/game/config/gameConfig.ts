import Phaser from 'phaser';
import { ArenaScene } from '../scenes/ArenaScene';
import { GuestArenaScene } from '../scenes/GuestArenaScene';
import { HudScene } from '../scenes/HudScene';
import { LobbyScene } from '../scenes/LobbyScene';
import { toCssColor, COLORS } from './theme';
import { VIEWPORT } from './gameplayConfig';

export function createGameConfig(): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: 'game',
    width: VIEWPORT.width,
    height: VIEWPORT.height,
    backgroundColor: toCssColor(COLORS.background),
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scene: [LobbyScene, ArenaScene, GuestArenaScene, HudScene],
  };
}
