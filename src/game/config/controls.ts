import Phaser from 'phaser';

export type PlayerId = 'p1' | 'p2';

export const PLAYER_IDS: readonly PlayerId[] = ['p1', 'p2'];

export interface PlayerBinding {
  up: number;
  down: number;
  left: number;
  right: number;
  fireball: number;
  shield: number;
}

export interface PlayerControls {
  label: string;
  movementLabel: string;
  abilityLabel: string;
  binding: PlayerBinding;
}

const { KeyCodes } = Phaser.Input.Keyboard;

export const PLAYER_CONTROLS: Record<PlayerId, PlayerControls> = {
  p1: {
    label: 'P1',
    movementLabel: 'WASD',
    abilityLabel: 'F / G',
    binding: {
      up: KeyCodes.W,
      down: KeyCodes.S,
      left: KeyCodes.A,
      right: KeyCodes.D,
      fireball: KeyCodes.F,
      shield: KeyCodes.G,
    },
  },
  p2: {
    label: 'P2',
    movementLabel: 'Arrows',
    abilityLabel: 'Num 1 / 2',
    binding: {
      up: KeyCodes.UP,
      down: KeyCodes.DOWN,
      left: KeyCodes.LEFT,
      right: KeyCodes.RIGHT,
      fireball: KeyCodes.NUMPAD_ONE,
      shield: KeyCodes.NUMPAD_TWO,
    },
  },
};
