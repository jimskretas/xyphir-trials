import Phaser from 'phaser';
import { PLAYER } from '../config/gameplayConfig';
import { COLORS } from '../config/theme';

export const TextureKeys = {
  Player: 'player',
} as const;

export function createPlaceholderTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(TextureKeys.Player)) {
    return;
  }

  const size = PLAYER.radius * 2 + 12;
  const center = size / 2;
  const graphics = scene.make.graphics({}, false);

  graphics.fillStyle(COLORS.playerGlow, 0.16);
  graphics.fillCircle(center, center, center - 1);

  graphics.fillStyle(COLORS.player, 1);
  graphics.fillCircle(center, center, PLAYER.radius);

  graphics.lineStyle(3, COLORS.playerEdge, 1);
  graphics.strokeCircle(center, center, PLAYER.radius);

  graphics.fillStyle(COLORS.playerPointer, 1);
  graphics.beginPath();
  graphics.moveTo(center + 20, center);
  graphics.lineTo(center + 7, center - 8);
  graphics.lineTo(center + 7, center + 8);
  graphics.closePath();
  graphics.fillPath();

  graphics.generateTexture(TextureKeys.Player, size, size);
  graphics.destroy();
}
