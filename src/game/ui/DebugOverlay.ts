import Phaser from 'phaser';
import { PLAYER_CONTROLS } from '../config/controls';
import { DEBUG, VIEWPORT } from '../config/gameplayConfig';
import { UI_COLORS } from '../config/theme';
import type { DebugSnapshot } from './HudModel';

const skillHints = (id: 'p1' | 'p2'): string =>
  PLAYER_CONTROLS[id].skills
    .map((skill) => `${skill.label} ${skill.name.toLowerCase()}`)
    .join(' / ');

const HINT_TEXT = [
  [
    `${PLAYER_CONTROLS.p1.label} ${PLAYER_CONTROLS.p1.movementLabel}`,
    PLAYER_CONTROLS.p1.abilityLabel,
    `${PLAYER_CONTROLS.p1.dashLabel} dash`,
    `${PLAYER_CONTROLS.p1.autoAttackLabel} auto`,
    skillHints('p1'),
  ]
    .filter((part) => part.length > 0)
    .join('  '),
  [
    `${PLAYER_CONTROLS.p2.label} ${PLAYER_CONTROLS.p2.movementLabel}`,
    PLAYER_CONTROLS.p2.abilityLabel,
    `${PLAYER_CONTROLS.p2.dashLabel} dash`,
    `${PLAYER_CONTROLS.p2.autoAttackLabel} auto`,
    skillHints('p2'),
  ]
    .filter((part) => part.length > 0)
    .join('  '),
  '` Debug',
].join('  ·  ');

export class DebugOverlay {
  private readonly text: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly overlayKey: Phaser.Input.Keyboard.Key | null;

  private visible = DEBUG.enabled;

  constructor(private readonly scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;

    this.text = scene.add
      .text(16, 16, '', {
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: '14px',
        color: UI_COLORS.debugText,
        backgroundColor: UI_COLORS.debugBackground,
        padding: { x: 10, y: 8 },
        lineSpacing: 4,
      })
      .setDepth(10000)
      .setVisible(this.visible);

    this.hint = scene.add
      .text(VIEWPORT.width / 2, VIEWPORT.height - 14, HINT_TEXT, {
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: '13px',
        color: UI_COLORS.hintText,
      })
      .setOrigin(0.5, 1)
      .setDepth(10000);

    this.overlayKey =
      keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.BACKTICK) ?? null;
  }

  update(snapshot: DebugSnapshot): void {
    this.handleToggleKey();

    if (!this.visible) {
      return;
    }

    const lines = ['XYPHIR TRIALS  ·  DEBUG'];

    for (const player of snapshot.players) {
      const contacts = [
        player.blocked.left ? 'L' : '-',
        player.blocked.right ? 'R' : '-',
        player.blocked.up ? 'U' : '-',
        player.blocked.down ? 'D' : '-',
      ].join(' ');

      const flags = [
        player.downed ? 'DOWN' : '',
        player.dashing ? 'DASH' : '',
        player.autoAttack ? 'AUTO' : '',
        player.skillActive ? 'SKILL' : '',
      ]
        .filter((flag) => flag.length > 0)
        .join(' ');

      lines.push(
        `${player.label}  pos ${player.position.x.toFixed(0)}, ${player.position.y.toFixed(0)}  face ${Math.round(player.facingDegrees)}°  hp ${player.health}/${player.maxHealth}${flags ? `  ${flags}` : ''}`,
        `     vel ${player.velocity.x.toFixed(0)}, ${player.velocity.y.toFixed(0)}  in ${player.direction.x.toFixed(2)}, ${player.direction.y.toFixed(2)}  walls ${contacts}`,
      );
    }

    if (DEBUG.enabled) {
      lines.push(`debug  2 / 3 damage (${DEBUG.damageAmount})`);
    }

    lines.push(
      `enemies  ${snapshot.enemies}   projectiles  ${snapshot.projectiles}   reflections  ${snapshot.reflections}`,
    );
    lines.push(`fps  ${snapshot.fps.toFixed(0)}`);
    this.text.setText(lines);
  }

  destroy(): void {
    const keyboard = this.scene.input.keyboard;

    if (this.overlayKey) {
      keyboard?.removeKey(this.overlayKey, true);
    }

    this.text.destroy();
    this.hint.destroy();
  }

  private handleToggleKey(): void {
    if (this.overlayKey && Phaser.Input.Keyboard.JustDown(this.overlayKey)) {
      this.visible = !this.visible;
      this.text.setVisible(this.visible);
    }
  }
}
