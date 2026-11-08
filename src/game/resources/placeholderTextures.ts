import Phaser from 'phaser';
import { PLAYER } from '../config/gameplayConfig';
import { COLORS } from '../config/theme';
import { TextureKeys } from './textureKeys';

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

  createFireballTexture(scene);
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

function createFireballTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(TextureKeys.Fireball)) {
    return;
  }

  const size = 22;
  const center = size / 2;
  const graphics = scene.make.graphics({}, false);

  graphics.fillStyle(0xf97316, 0.22);
  graphics.fillCircle(center, center, 10);

  graphics.fillStyle(0xfb923c, 1);
  graphics.fillCircle(center, center, 6);

  graphics.fillStyle(0xfef3c7, 1);
  graphics.fillCircle(center, center, 3);

  graphics.generateTexture(TextureKeys.Fireball, size, size);
  graphics.destroy();
}
