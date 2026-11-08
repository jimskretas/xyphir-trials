import Phaser from 'phaser';
import { COLORS, toCssColor } from '../config/theme';
import { PLAYER_CONTROLS } from '../config/controls';
import { VIEWPORT } from '../config/gameplayConfig';
import type { AbilityHudState, PlayerHudState } from './HudModel';

const PANEL_WIDTH = 260;
const PANEL_HEIGHT = 104;
const BAR_WIDTH = 236;
const BAR_HEIGHT = 10;
const ABILITY_WIDTH = 112;
const ABILITY_HEIGHT = 8;
const ABILITY_GAP = 12;
const MARGIN = 24;

export class PlayerHudPanel {
  private readonly container: Phaser.GameObjects.Container;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly abilities: Phaser.GameObjects.Graphics;
  private readonly healthText: Phaser.GameObjects.Text;
  private readonly fireballText: Phaser.GameObjects.Text;
  private readonly shieldText: Phaser.GameObjects.Text;
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
    this.abilities = scene.add.graphics();

    const nameText = scene.add.text(12, 8, state.label, {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '16px',
      fontStyle: 'bold',
      color: toCssColor(this.color),
    });

    const controlsText = scene.add.text(
      12,
      84,
      `${controls.movementLabel} move   ${controls.abilityLabel} abilities`,
      {
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: '11px',
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

    this.fireballText = scene.add.text(12, 52, '', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '10px',
      color: '#f97316',
    });

    this.shieldText = scene.add.text(
      12 + ABILITY_WIDTH + ABILITY_GAP,
      52,
      '',
      {
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: '10px',
        color: toCssColor(this.color),
      },
    );

    this.container = scene.add
      .container(x, y, [
        background,
        this.bar,
        this.abilities,
        nameText,
        this.healthText,
        this.fireballText,
        this.shieldText,
        controlsText,
      ])
      .setDepth(1000);

    this.update(state);
  }

  update(state: PlayerHudState): void {
    this.drawHealth(state);
    this.drawAbilities(state);
  }

  destroy(): void {
    this.container.destroy(true);
  }

  private drawHealth(state: PlayerHudState): void {
    const ratio = Phaser.Math.Clamp(state.health / state.maxHealth, 0, 1);

    this.bar.clear();
    this.bar.fillStyle(0x1b2330, 1);
    this.bar.fillRoundedRect(12, 34, BAR_WIDTH, BAR_HEIGHT, 4);

    if (ratio > 0) {
      const fillColor = state.downed
        ? 0x6b7280
        : ratio <= 0.3
          ? 0xef4444
          : this.color;

      this.bar.fillStyle(fillColor, 1);
      this.bar.fillRoundedRect(
        12,
        34,
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

  private drawAbilities(state: PlayerHudState): void {
    this.abilities.clear();

    this.drawAbility(
      12,
      state.fireball,
      0xf97316,
      this.fireballText,
      'FIREBALL',
    );
    this.drawAbility(
      12 + ABILITY_WIDTH + ABILITY_GAP,
      state.shield,
      this.color,
      this.shieldText,
      'SHIELD',
    );
  }

  private drawAbility(
    x: number,
    ability: AbilityHudState | null,
    color: number,
    label: Phaser.GameObjects.Text,
    name: string,
  ): void {
    this.abilities.fillStyle(0x1b2330, 1);
    this.abilities.fillRoundedRect(
      x,
      67,
      ABILITY_WIDTH,
      ABILITY_HEIGHT,
      3,
    );

    if (!ability) {
      label.setText(`${name} —`);
      label.setColor('#4b5b6d');
      return;
    }

    if (ability.ratio > 0) {
      const fillColor = ability.active
        ? 0x38bdf8
        : ability.ready
          ? color
          : 0x475569;

      this.abilities.fillStyle(fillColor, 1);
      this.abilities.fillRoundedRect(
        x,
        67,
        Math.max(3, ABILITY_WIDTH * ability.ratio),
        ABILITY_HEIGHT,
        3,
      );
    }

    label.setText(
      ability.active
        ? `${name} ACTIVE`
        : ability.ready
          ? `${name} READY`
          : name,
    );
    label.setColor(
      ability.active
        ? '#38bdf8'
        : ability.ready
          ? toCssColor(color)
          : '#64748b',
    );
  }
}
