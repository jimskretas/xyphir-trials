import Phaser from 'phaser';
import { PLAYER_CONTROLS } from '../config/controls';
import type { PlayerControls, PlayerId } from '../config/controls';

export interface PlayerInputState {
  movement: Phaser.Math.Vector2;
  fireball: boolean;
  shield: boolean;
  dash: boolean;
  autoAttackToggle: boolean;
  skillCasts: boolean[];
}

interface PlayerKeys {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  fireball: Phaser.Input.Keyboard.Key;
  shield: Phaser.Input.Keyboard.Key;
  dash: Phaser.Input.Keyboard.Key;
  autoAttack: Phaser.Input.Keyboard.Key;
  skills: Phaser.Input.Keyboard.Key[];
}

/**
 * Reads one local keyboard control profile. Online sessions use the same
 * layout for both host and guest because each player has their own machine.
 */
export class InputSystem {
  readonly playerId: PlayerId;

  private readonly keys: PlayerKeys;
  private readonly state: PlayerInputState;

  constructor(
    private readonly scene: Phaser.Scene,
    controls: PlayerControls = PLAYER_CONTROLS.p1,
    playerId: PlayerId = 'p1',
  ) {
    this.playerId = playerId;

    const keyboard = scene.input.keyboard;

    if (!keyboard) {
      throw new Error('Keyboard input is not available in this environment.');
    }

    const { binding } = controls;

    this.keys = {
      up: keyboard.addKey(binding.up),
      down: keyboard.addKey(binding.down),
      left: keyboard.addKey(binding.left),
      right: keyboard.addKey(binding.right),
      fireball: keyboard.addKey(binding.fireball),
      shield: keyboard.addKey(binding.shield),
      dash: keyboard.addKey(binding.dash),
      autoAttack: keyboard.addKey(binding.autoAttack),
      skills: controls.skills.map((skill) => keyboard.addKey(skill.key)),
    };

    this.state = {
      movement: new Phaser.Math.Vector2(),
      fireball: false,
      shield: false,
      dash: false,
      autoAttackToggle: false,
      skillCasts: controls.skills.map(() => false),
    };
  }

  update(): void {
    const keys = this.keys;
    const state = this.state;

    state.movement.set(
      Number(keys.right.isDown) - Number(keys.left.isDown),
      Number(keys.down.isDown) - Number(keys.up.isDown),
    );
    state.fireball = Phaser.Input.Keyboard.JustDown(keys.fireball);
    state.shield = Phaser.Input.Keyboard.JustDown(keys.shield);
    state.dash = Phaser.Input.Keyboard.JustDown(keys.dash);
    state.autoAttackToggle = Phaser.Input.Keyboard.JustDown(keys.autoAttack);
    state.skillCasts.length = keys.skills.length;

    for (let index = 0; index < keys.skills.length; index += 1) {
      state.skillCasts[index] = Phaser.Input.Keyboard.JustDown(
        keys.skills[index],
      );
    }
  }

  getState(): PlayerInputState {
    return this.state;
  }

  destroy(): void {
    const keyboard = this.scene.input.keyboard;

    if (!keyboard) {
      return;
    }

    for (const key of [
      this.keys.up,
      this.keys.down,
      this.keys.left,
      this.keys.right,
      this.keys.fireball,
      this.keys.shield,
      this.keys.dash,
      this.keys.autoAttack,
      ...this.keys.skills,
    ]) {
      keyboard.removeKey(key, true, true);
    }
  }
}
