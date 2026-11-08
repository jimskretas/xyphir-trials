import Phaser from 'phaser';
import { DEBUG, VIEWPORT } from '../config/gameplayConfig';
import { UI_COLORS } from '../config/theme';

interface DebugVector {
  x: number;
  y: number;
}

interface BlockedState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

export interface DebugSnapshot {
  position: DebugVector;
  velocity: DebugVector;
  direction: DebugVector;
  facingDegrees: number;
  blocked: BlockedState;
  fps: number;
}

const HINT_TEXT = 'WASD Move  ·  Mouse Aim  ·  ` Debug  ·  F2 Colliders';

export class DebugOverlay {
  private readonly text: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly overlayKey: Phaser.Input.Keyboard.Key | null;
  private readonly colliderKey: Phaser.Input.Keyboard.Key | null;

  private visible = DEBUG.enabled;
  private collidersVisible = false;

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
      .setScrollFactor(0)
      .setDepth(10000)
      .setVisible(this.visible);

    this.hint = scene.add
      .text(16, VIEWPORT.height - 16, HINT_TEXT, {
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: '13px',
        color: UI_COLORS.hintText,
      })
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setDepth(10000);

    this.overlayKey =
      keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.BACKTICK) ?? null;
    this.colliderKey =
      keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.F2) ?? null;
  }

  update(snapshot: DebugSnapshot): void {
    this.handleToggleKeys();

    if (!this.visible) {
      return;
    }

    const contacts = [
      snapshot.blocked.left ? 'L' : '-',
      snapshot.blocked.right ? 'R' : '-',
      snapshot.blocked.up ? 'U' : '-',
      snapshot.blocked.down ? 'D' : '-',
    ].join(' ');

    this.text.setText([
      'XYPHIR TRIALS  ·  DEBUG',
      `pos      ${snapshot.position.x.toFixed(0)}, ${snapshot.position.y.toFixed(0)}`,
      `vel      ${snapshot.velocity.x.toFixed(0)}, ${snapshot.velocity.y.toFixed(0)}`,
      `input    ${snapshot.direction.x.toFixed(2)}, ${snapshot.direction.y.toFixed(2)}`,
      `facing   ${Math.round(snapshot.facingDegrees)}°`,
      `walls    ${contacts}`,
      `fps      ${snapshot.fps.toFixed(0)}`,
    ]);
  }

  destroy(): void {
    const keyboard = this.scene.input.keyboard;

    if (this.overlayKey) {
      keyboard?.removeKey(this.overlayKey, true);
    }

    if (this.colliderKey) {
      keyboard?.removeKey(this.colliderKey, true);
    }

    this.scene.physics.world.drawDebug = false;
    this.text.destroy();
    this.hint.destroy();
  }

  private handleToggleKeys(): void {
    if (this.overlayKey && Phaser.Input.Keyboard.JustDown(this.overlayKey)) {
      this.visible = !this.visible;
      this.text.setVisible(this.visible);
    }

    if (this.colliderKey && Phaser.Input.Keyboard.JustDown(this.colliderKey)) {
      this.toggleColliderDebug();
    }
  }

  private toggleColliderDebug(): void {
    const world = this.scene.physics.world;

    this.collidersVisible = !this.collidersVisible;
    world.drawDebug = this.collidersVisible;

    if (this.collidersVisible) {
      if (!world.debugGraphic) {
        world.debugGraphic = world.createDebugGraphic();
      }

      world.debugGraphic.setVisible(true);
      return;
    }

    world.debugGraphic?.clear();
    world.debugGraphic?.setVisible(false);
  }
}
