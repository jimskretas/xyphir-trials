import Phaser from 'phaser';
import { PLAYER_CONTROLS, PLAYER_IDS } from '../config/controls';
import type { PlayerId } from '../config/controls';
import { VIEWPORT } from '../config/gameplayConfig';
import { SceneKeys } from '../config/sceneKeys';
import { COLORS, UI_COLORS } from '../config/theme';
import { sfx } from '../systems/SfxSystem';

const MONO = 'Consolas, "Courier New", monospace';

const CARD_WIDTH = 430;
const CARD_HEIGHT = 176;
const CARD_GAP = 40;
const CARD_Y = 210;

const PLAYER_COLORS: Record<PlayerId, number> = {
  p1: COLORS.playerOne,
  p2: COLORS.playerTwo,
};

export class StartScene extends Phaser.Scene {
  private started = false;

  constructor() {
    super(SceneKeys.Start);
  }

  create(): void {
    this.started = false;

    this.drawBackground();

    this.add
      .text(VIEWPORT.width / 2, 74, 'XYPHIR TRIALS', {
        fontFamily: MONO,
        fontSize: '54px',
        fontStyle: 'bold',
        color: UI_COLORS.startTitle,
      })
      .setOrigin(0.5, 0);

    this.add
      .text(VIEWPORT.width / 2, 136, 'A local co-op trial for two players', {
        fontFamily: MONO,
        fontSize: '18px',
        color: UI_COLORS.startSubtitle,
      })
      .setOrigin(0.5, 0);

    this.add
      .text(
        VIEWPORT.width / 2,
        168,
        'Survive the grunt wave. Defeat the Xyphir Warden.',
        {
          fontFamily: MONO,
          fontSize: '15px',
          color: UI_COLORS.startMuted,
        },
      )
      .setOrigin(0.5, 0);

    const cardsWidth = CARD_WIDTH * PLAYER_IDS.length + CARD_GAP;
    let x = (VIEWPORT.width - cardsWidth) / 2;

    for (const id of PLAYER_IDS) {
      this.drawPlayerCard(id, x, CARD_Y);
      x += CARD_WIDTH + CARD_GAP;
    }

    this.drawReflectionCallout();

    this.add
      .text(VIEWPORT.width / 2, 602, 'PRESS ENTER OR SPACE TO BEGIN', {
        fontFamily: MONO,
        fontSize: '21px',
        fontStyle: 'bold',
        color: UI_COLORS.startAccent,
      })
      .setOrigin(0.5, 0);

    this.add
      .text(VIEWPORT.width / 2, 646, 'Keyboard only · No mouse required', {
        fontFamily: MONO,
        fontSize: '13px',
        color: UI_COLORS.startMuted,
      })
      .setOrigin(0.5, 0);

    const keyboard = this.input.keyboard;

    keyboard?.on('keydown-ENTER', this.startGame, this);
    keyboard?.on('keydown-SPACE', this.startGame, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  private startGame(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    void sfx.unlock().then(() => sfx.play('start'));
    this.scene.start(SceneKeys.Arena);
  }

  private handleShutdown(): void {
    const keyboard = this.input.keyboard;

    keyboard?.off('keydown-ENTER', this.startGame, this);
    keyboard?.off('keydown-SPACE', this.startGame, this);
  }

  private drawBackground(): void {
    this.add
      .rectangle(0, 0, VIEWPORT.width, VIEWPORT.height, COLORS.background)
      .setOrigin(0);

    const grid = this.add.graphics();
    grid.lineStyle(1, COLORS.grid, 0.55);

    for (let x = 0; x <= VIEWPORT.width; x += 64) {
      grid.lineBetween(x, 0, x, VIEWPORT.height);
    }

    for (let y = 0; y <= VIEWPORT.height; y += 64) {
      grid.lineBetween(0, y, VIEWPORT.width, y);
    }
  }

  private drawPlayerCard(id: PlayerId, x: number, y: number): void {
    const controls = PLAYER_CONTROLS[id];
    const color = PLAYER_COLORS[id];

    const card = this.add.graphics();
    card.fillStyle(0x0b111a, 0.94);
    card.fillRoundedRect(x, y, CARD_WIDTH, CARD_HEIGHT, 10);
    card.lineStyle(2, color, 0.85);
    card.strokeRoundedRect(x, y, CARD_WIDTH, CARD_HEIGHT, 10);

    this.add.text(x + 24, y + 18, controls.label, {
      fontFamily: MONO,
      fontSize: '24px',
      fontStyle: 'bold',
      color: `#${color.toString(16).padStart(6, '0')}`,
    });

    this.add
      .text(x + CARD_WIDTH - 24, y + 24, 'co-op partner', {
        fontFamily: MONO,
        fontSize: '12px',
        color: UI_COLORS.startMuted,
      })
      .setOrigin(1, 0);

    this.drawControlRow(x, y + 68, 'MOVE', controls.movementLabel);
    this.drawControlRow(x, y + 106, 'FIREBALL', controls.fireballLabel);
    this.drawControlRow(x, y + 144, 'SHIELD', controls.shieldLabel);
  }

  private drawControlRow(
    cardX: number,
    y: number,
    label: string,
    value: string,
  ): void {
    this.add.text(cardX + 24, y, label, {
      fontFamily: MONO,
      fontSize: '14px',
      color: UI_COLORS.startMuted,
    });

    this.add
      .text(cardX + CARD_WIDTH - 24, y - 2, value, {
        fontFamily: MONO,
        fontSize: '18px',
        fontStyle: 'bold',
        color: UI_COLORS.startBody,
      })
      .setOrigin(1, 0);
  }

  private drawReflectionCallout(): void {
    const width = 760;
    const height = 108;
    const x = (VIEWPORT.width - width) / 2;
    const y = 424;

    const panel = this.add.graphics();
    panel.fillStyle(0x0b111a, 0.94);
    panel.fillRoundedRect(x, y, width, height, 10);
    panel.lineStyle(1, COLORS.playerOneGlow, 0.5);
    panel.strokeRoundedRect(x, y, width, height, 10);

    this.add
      .text(VIEWPORT.width / 2, y + 16, 'CO-OP REFLECTION', {
        fontFamily: MONO,
        fontSize: '15px',
        fontStyle: 'bold',
        color: UI_COLORS.startTitle,
      })
      .setOrigin(0.5, 0);

    this.add
      .text(
        VIEWPORT.width / 2,
        y + 46,
        'Face an incoming projectile and raise your shield to send it back.\nReflected shots hit harder. Cover your partner — you cannot damage each other.',
        {
          fontFamily: MONO,
          fontSize: '14px',
          color: UI_COLORS.startBody,
          align: 'center',
          lineSpacing: 6,
        },
      )
      .setOrigin(0.5, 0);
  }
}
