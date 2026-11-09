import Phaser from 'phaser';
import { VIEWPORT } from '../config/gameplayConfig';
import { COLORS, UI_COLORS } from '../config/theme';
import type { Outcome } from './HudModel';

const PANEL_WIDTH = 540;
const PANEL_HEIGHT = 230;

interface OutcomePresentation {
  title: string;
  subtitle: string;
  color: string;
  edge: number;
}

const PRESENTATIONS: Record<Outcome, OutcomePresentation> = {
  victory: {
    title: 'VICTORY',
    subtitle: 'The Xyphir Warden has fallen. The trials are complete.',
    color: UI_COLORS.resultVictory,
    edge: COLORS.playerOneGlow,
  },
  defeat: {
    title: 'DEFEAT',
    subtitle: 'All players have fallen. The trials endure.',
    color: UI_COLORS.resultDefeat,
    edge: 0xf87171,
  },
};

export class ResultOverlay {
  private readonly container: Phaser.GameObjects.Container;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly subtitleText: Phaser.GameObjects.Text;
  private readonly hintText: Phaser.GameObjects.Text;

  private current: Outcome | null = null;

  constructor(scene: Phaser.Scene) {
    const shade = scene.add
      .rectangle(0, 0, VIEWPORT.width, VIEWPORT.height, 0x02040a, 0.62)
      .setOrigin(0);

    this.panel = scene.add.graphics();

    this.titleText = scene.add
      .text(VIEWPORT.width / 2, VIEWPORT.height / 2 - 46, '', {
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: '48px',
        fontStyle: 'bold',
        color: UI_COLORS.resultVictory,
      })
      .setOrigin(0.5);

    this.subtitleText = scene.add
      .text(VIEWPORT.width / 2, VIEWPORT.height / 2 + 8, '', {
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: '16px',
        color: UI_COLORS.resultSubtitle,
        align: 'center',
        wordWrap: { width: PANEL_WIDTH - 64 },
      })
      .setOrigin(0.5);

    this.hintText = scene.add
      .text(
        VIEWPORT.width / 2,
        VIEWPORT.height / 2 + 74,
        'R  RESTART          ESC  LEAVE',
        {
          fontFamily: 'Consolas, "Courier New", monospace',
          fontSize: '15px',
          fontStyle: 'bold',
          color: UI_COLORS.startMuted,
        },
      )
      .setOrigin(0.5);

    this.container = scene.add
      .container(0, 0, [
        shade,
        this.panel,
        this.titleText,
        this.subtitleText,
        this.hintText,
      ])
      .setDepth(2000)
      .setVisible(false);
  }

  setHint(value: string): void {
    this.hintText.setText(value);
  }

  update(outcome: Outcome | null, subtitleOverride?: string): void {
    if (outcome === null) {
      if (this.current !== null) {
        this.current = null;
        this.container.setVisible(false);
      }

      return;
    }

    if (outcome === this.current) {
      if (subtitleOverride !== undefined) {
        this.subtitleText.setText(subtitleOverride);
      }

      return;
    }

    this.current = outcome;

    const presentation = PRESENTATIONS[outcome];

    this.titleText.setText(presentation.title).setColor(presentation.color);
    this.subtitleText.setText(subtitleOverride ?? presentation.subtitle);
    this.drawPanel(presentation.edge);
    this.container.setVisible(true);

    this.titleText.setScale(0.86);
    this.titleText.scene.tweens.add({
      targets: this.titleText,
      scale: 1,
      duration: 220,
      ease: 'Back.Out',
    });
  }

  destroy(): void {
    this.container.destroy(true);
  }

  private drawPanel(edge: number): void {
    const x = (VIEWPORT.width - PANEL_WIDTH) / 2;
    const y = (VIEWPORT.height - PANEL_HEIGHT) / 2;

    this.panel.clear();
    this.panel.fillStyle(0x070b12, 0.96);
    this.panel.fillRoundedRect(x, y, PANEL_WIDTH, PANEL_HEIGHT, 12);

    this.panel.lineStyle(2, edge, 0.9);
    this.panel.strokeRoundedRect(x, y, PANEL_WIDTH, PANEL_HEIGHT, 12);
  }
}
