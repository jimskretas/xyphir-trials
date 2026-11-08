import Phaser from 'phaser';
import { PLAYER_CONTROLS, PLAYER_IDS } from '../config/controls';
import type { PlayerId } from '../config/controls';

export interface PlayerInputState {
  movement: Phaser.Math.Vector2;
  fireball: boolean;
  shield: boolean;
}

interface PlayerKeys {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  fireball: Phaser.Input.Keyboard.Key;
  shield: Phaser.Input.Keyboard.Key;
}

export class InputSystem {
  private readonly keys = new Map<PlayerId, PlayerKeys>();
  private readonly states = new Map<PlayerId, PlayerInputState>();

  constructor(private readonly scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;

    if (!keyboard) {
      throw new Error('Keyboard input is not available in this environment.');
    }

    for (const id of PLAYER_IDS) {
      const { binding } = PLAYER_CONTROLS[id];

      this.keys.set(id, {
        up: keyboard.addKey(binding.up),
        down: keyboard.addKey(binding.down),
        left: keyboard.addKey(binding.left),
        right: keyboard.addKey(binding.right),
        fireball: keyboard.addKey(binding.fireball),
        shield: keyboard.addKey(binding.shield),
      });

      this.states.set(id, {
        movement: new Phaser.Math.Vector2(),
        fireball: false,
        shield: false,
      });
    }
  }

  update(): void {
    for (const id of PLAYER_IDS) {
      const keys = this.keys.get(id);
      const state = this.states.get(id);

      if (!keys || !state) {
        continue;
      }

      state.movement.set(
        Number(keys.right.isDown) - Number(keys.left.isDown),
        Number(keys.down.isDown) - Number(keys.up.isDown),
      );
      state.fireball = Phaser.Input.Keyboard.JustDown(keys.fireball);
      state.shield = Phaser.Input.Keyboard.JustDown(keys.shield);
    }
  }

  getState(id: PlayerId): PlayerInputState {
    const state = this.states.get(id);

    if (!state) {
      throw new Error(`No input state registered for ${id}.`);
    }

    return state;
  }

  destroy(): void {
    const keyboard = this.scene.input.keyboard;

    if (!keyboard) {
      return;
    }

    for (const keys of this.keys.values()) {
      for (const key of Object.values(keys)) {
        keyboard.removeKey(key, true, true);
      }
    }

    this.keys.clear();
    this.states.clear();
  }
}
