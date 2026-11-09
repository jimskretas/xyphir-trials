import Phaser from 'phaser';
import {
  adjustBulletDamage,
  combatTuning,
} from '../config/combatTuning';
import { VIEWPORT } from '../config/gameplayConfig';
import { UI_COLORS } from '../config/theme';

const PANEL_WIDTH = 188;
const PANEL_HEIGHT = 86;
const MARGIN = 16;
const STEP = 1;

interface DamageRow {
  key: keyof typeof combatTuning;
  valueText: Phaser.GameObjects.Text;
}

export class DamageDebugPanel {
  private readonly container: Phaser.GameObjects.Container;
  private readonly rows: DamageRow[] = [];

  constructor(scene: Phaser.Scene) {
    const background = scene.add.graphics();
    background.fillStyle(0x070b12, 0.9);
    background.fillRoundedRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 8);
    background.lineStyle(1, 0x455a75, 0.7);
    background.strokeRoundedRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 8);

    const title = scene.add.text(12, 8, 'BULLET DMG', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '12px',
      fontStyle: 'bold',
      color: UI_COLORS.debugText,
    });

    const children: Phaser.GameObjects.GameObject[] = [background, title];

    this.addRow(scene, children, 'PLAYER', 'playerBulletDamage', 32);
    this.addRow(scene, children, 'ENEMY', 'enemyBulletDamage', 56);

    this.container = scene.add
      .container(VIEWPORT.width - MARGIN - PANEL_WIDTH, MARGIN, children)
      .setDepth(10000);

    this.refreshAll();
  }

  destroy(): void {
    this.container.destroy(true);
  }

  private addRow(
    scene: Phaser.Scene,
    children: Phaser.GameObjects.GameObject[],
    label: string,
    key: keyof typeof combatTuning,
    y: number,
  ): void {
    const labelText = scene.add.text(12, y, label, {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '12px',
      color: '#6b7d92',
    });

    const minus = this.createButton(scene, 84, y, '−', () => {
      adjustBulletDamage(key, -STEP);
      this.refreshAll();
    });

    const valueText = scene.add
      .text(122, y, '', {
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: '12px',
        color: '#d6e2ee',
      })
      .setOrigin(0.5, 0);

    const plus = this.createButton(scene, 150, y, '+', () => {
      adjustBulletDamage(key, STEP);
      this.refreshAll();
    });

    this.rows.push({ key, valueText });
    children.push(labelText, minus, valueText, plus);
  }

  private createButton(
    scene: Phaser.Scene,
    x: number,
    y: number,
    symbol: string,
    onClick: () => void,
  ): Phaser.GameObjects.Text {
    const button = scene.add
      .text(x, y, symbol, {
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: '14px',
        color: '#cbd8e6',
        backgroundColor: UI_COLORS.debugBackground,
        padding: { x: 6, y: 0 },
      })
      .setInteractive({ useHandCursor: true });

    button.on('pointerover', () => button.setColor('#67e8f9'));
    button.on('pointerout', () => button.setColor('#cbd8e6'));
    button.on('pointerdown', onClick);

    return button;
  }

  private refreshAll(): void {
    for (const row of this.rows) {
      row.valueText.setText(String(combatTuning[row.key]));
    }
  }
}
