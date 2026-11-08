import Phaser from 'phaser';
import { COLORS, toCssColor } from '../config/theme';
import { PLAYER_CONTROLS } from '../config/controls';
import { VIEWPORT } from '../config/gameplayConfig';
import type { PlayerHudState } from './HudModel';

const PANEL_WIDTH = 260;
const PANEL_HEIGHT = 86;
const BAR_WIDTH = 236;
const BAR_HEIGHT = 12;
const MARGIN = 24;

export class PlayerHudPanel {
  private readonly container: Phaser.GameObjects.Container;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly healthText: Phaser.GameObjects.Text;
  private readonly color: number;

  constructor(
    scene: Phaser.Scene,
    state: PlayerHudState,
    align: 'left' | 'right',
  ) {
    const controls = PLAYER_CONTROLS[state.id];
    const x = align === 'left' ? MARGIN : VIEWPORT.width - MARGIN - PANEL_WIDTH;
    const y = VIEWPORT.height - MARGIN - PANEL_HEIGHT;

    this.color = state.id === 'p1' ? COLORS.playerOne : COLORS.playerTwo;

    const background = scene.add.graphics();
    background.fillStyle(0x070b12, 0.9);
    background.fillRoundedRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 8);
    background.lineStyle(1, this.color, 0.55);
    background.strokeRoundedRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 8);

    this.bar = scene.add.graphics();

    this.nameText = scene.add.text(12, 8, state.label, {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '16px',
      fontStyle: 'bold',
      color: toCssColor(this.color),
    });

    const controlsText = scene.add.text(
      12,
      62,
      `${controls.movementLabel} move   ${controls.abilityLabel} abilities`,
      {
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: '12px',
        color: '#6b7d92',
      },
    );

    this.healthText = scene.add
      .text(PANEL_WIDTH - 12, 8, '', {
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: '14px',
        color: '#d6e2ee',
      })
      .setOrigin(1, 0);

    this.container = scene.add
      .container(x, y, [
        background,
        this.bar,
        this.nameText,
        this.healthText,
        controlsText,
      ])
      .setDepth(1000);

    this.update(state);
  }

  update(state: PlayerHudState): void {
    const ratio = Phaser.Math.Clamp(state.health / state.maxHealth, 0, 1);

    this.bar.clear();
    this.bar.fillStyle(0x1b2330, 1);
    this.bar.fillRoundedRect(12, 38, BAR_WIDTH, BAR_HEIGHT, 4);

    if (ratio > 0) {
      const fillColor = state.downed
        ? 0x6b7280
        : ratio <= 0.3
          ? 0xef4444
          : this.color;

      this.bar.fillStyle(fillColor, 1);
      this.bar.fillRoundedRect(
        12,
        38,
        Math.max(4, BAR_WIDTH * ratio),
        BAR_HEIGHT,
        4,
      );
    }

    this.healthText.setText(
      state.downed ? 'DOWN' : `${Math.ceil(state.health)} / ${state.maxHealth}`,
    );
    this.healthText.setColor(state.downed ? '#ef4444' : '#d6e2ee');
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
