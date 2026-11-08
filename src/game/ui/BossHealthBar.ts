import Phaser from 'phaser';
import { VIEWPORT } from '../config/gameplayConfig';
import { COLORS, toCssColor } from '../config/theme';
import type { BossHudState } from './HudModel';

const BAR_WIDTH = 520;
const BAR_HEIGHT = 18;

export class BossHealthBar {
  private readonly container: Phaser.GameObjects.Container;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly nameText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    const background = scene.add.graphics();
    background.fillStyle(0x070b12, 0.92);
    background.fillRoundedRect(0, 0, BAR_WIDTH, BAR_HEIGHT, 5);
    background.lineStyle(1, COLORS.playerTwoEdge, 0.9);
    background.strokeRoundedRect(0, 0, BAR_WIDTH, BAR_HEIGHT, 5);

    this.bar = scene.add.graphics();

    this.nameText = scene.add
      .text(BAR_WIDTH / 2, -20, '', {
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: '14px',
        fontStyle: 'bold',
        color: toCssColor(0xfca5a5),
      })
      .setOrigin(0.5, 0);

    this.container = scene.add
      .container((VIEWPORT.width - BAR_WIDTH) / 2, 58, [
        background,
        this.bar,
        this.nameText,
      ])
      .setDepth(1000)
      .setVisible(false);
  }

  update(boss: BossHudState | null): void {
    if (!boss) {
      this.container.setVisible(false);
      return;
    }

    this.container.setVisible(true);
    this.nameText.setText(boss.name);

    const ratio = Phaser.Math.Clamp(boss.health / boss.maxHealth, 0, 1);

    this.bar.clear();
    this.bar.fillStyle(0x3f1118, 1);
    this.bar.fillRoundedRect(0, 0, BAR_WIDTH, BAR_HEIGHT, 5);

    if (ratio > 0) {
      this.bar.fillStyle(0xdc2626, 1);
      this.bar.fillRoundedRect(
        0,
        0,
        Math.max(BAR_HEIGHT, BAR_WIDTH * ratio),
        BAR_HEIGHT,
        5,
      );
    }
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
