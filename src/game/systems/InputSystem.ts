import Phaser from 'phaser';

export class InputSystem {
  private readonly keys: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  private readonly direction = new Phaser.Math.Vector2();
  private readonly pointerWorld = new Phaser.Math.Vector2();

  constructor(private readonly scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;

    if (!keyboard) {
      throw new Error('Keyboard input is not available in this environment.');
    }

    this.keys = {
      up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
  }

  getMovement(): Phaser.Math.Vector2 {
    const x = Number(this.keys.right.isDown) - Number(this.keys.left.isDown);
    const y = Number(this.keys.down.isDown) - Number(this.keys.up.isDown);

    return this.direction.set(x, y);
  }

  getPointerWorld(
    camera: Phaser.Cameras.Scene2D.Camera,
  ): Phaser.Math.Vector2 | null {
    const pointer = this.scene.input.activePointer;

    if (pointer.moveTime === 0) {
      return null;
    }

    return camera.getWorldPoint(pointer.x, pointer.y, this.pointerWorld);
  }

  destroy(): void {
    const keyboard = this.scene.input.keyboard;

    if (!keyboard) {
      return;
    }

    for (const key of Object.values(this.keys)) {
      keyboard.removeKey(key, true, true);
    }
  }
}
