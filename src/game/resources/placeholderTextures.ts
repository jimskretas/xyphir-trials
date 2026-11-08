import Phaser from 'phaser';
import { PLAYER } from '../config/gameplayConfig';
import { COLORS } from '../config/theme';

export const TextureKeys = {
  PlayerOne: 'player-p1',
  PlayerTwo: 'player-p2',
} as const;

interface PlayerPalette {
  glow: number;
  fill: number;
  edge: number;
  pointer: number;
}

const PLAYER_PALETTES: Record<string, PlayerPalette> = {
  [TextureKeys.PlayerOne]: {
    glow: COLORS.playerOneGlow,
    fill: COLORS.playerOne,
    edge: COLORS.playerOneEdge,
    pointer: COLORS.playerOnePointer,
  },
  [TextureKeys.PlayerTwo]: {
    glow: COLORS.playerTwoGlow,
    fill: COLORS.playerTwo,
    edge: COLORS.playerTwoEdge,
    pointer: COLORS.playerTwoPointer,
  },
};

export function createPlaceholderTextures(scene: Phaser.Scene): void {
  for (const [key, palette] of Object.entries(PLAYER_PALETTES)) {
    createPlayerTexture(scene, key, palette);
  }
}

function createPlayerTexture(
  scene: Phaser.Scene,
  key: string,
  palette: PlayerPalette,
): void {
  if (scene.textures.exists(key)) {
    return;
  }

  const size = PLAYER.radius * 2 + 12;
  const center = size / 2;
  const graphics = scene.make.graphics({}, false);

  graphics.fillStyle(palette.glow, 0.16);
  graphics.fillCircle(center, center, center - 1);

  graphics.fillStyle(palette.fill, 1);
  graphics.fillCircle(center, center, PLAYER.radius);

  graphics.lineStyle(3, palette.edge, 1);
  graphics.strokeCircle(center, center, PLAYER.radius);

  graphics.fillStyle(palette.pointer, 1);
  graphics.beginPath();
  graphics.moveTo(center + 20, center);
  graphics.lineTo(center + 7, center - 8);
  graphics.lineTo(center + 7, center + 8);
  graphics.closePath();
  graphics.fillPath();

  graphics.generateTexture(key, size, size);
  graphics.destroy();
}
