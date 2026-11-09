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
  dash: number;
  autoAttack: number;
}

export interface PlayerSkillBinding {
  id: string;
  name: string;
  key: number;
  label: string;
}

export interface PlayerControls {
  label: string;
  movementLabel: string;
  fireballLabel: string;
  shieldLabel: string;
  dashLabel: string;
  autoAttackLabel: string;
  abilityLabel: string;
  skills: readonly PlayerSkillBinding[];
  binding: PlayerBinding;
}

const { KeyCodes } = Phaser.Input.Keyboard;

export const PLAYER_CONTROLS: Record<PlayerId, PlayerControls> = {
  p1: {
    label: 'P1',
    movementLabel: 'WASD',
    fireballLabel: 'F',
    shieldLabel: 'G',
    dashLabel: 'Space',
    autoAttackLabel: 'Q',
    abilityLabel: 'F / G',
    skills: [
      {
        id: 'turret',
        name: 'Turret',
        key: KeyCodes.E,
        label: 'E',
      },
    ],
    binding: {
      up: KeyCodes.W,
      down: KeyCodes.S,
      left: KeyCodes.A,
      right: KeyCodes.D,
      fireball: KeyCodes.F,
      shield: KeyCodes.G,
      dash: KeyCodes.SPACE,
      autoAttack: KeyCodes.Q,
    },
  },
  p2: {
    label: 'P2',
    movementLabel: 'WASD',
    fireballLabel: 'F',
    shieldLabel: 'G',
    dashLabel: 'Space',
    autoAttackLabel: 'Q',
    abilityLabel: 'F / G',
    skills: [
      {
        id: 'turret',
        name: 'Turret',
        key: KeyCodes.E,
        label: 'E',
      },
    ],
    binding: {
      up: KeyCodes.W,
      down: KeyCodes.S,
      left: KeyCodes.A,
      right: KeyCodes.D,
      fireball: KeyCodes.F,
      shield: KeyCodes.G,
      dash: KeyCodes.SPACE,
      autoAttack: KeyCodes.Q,
    },
  },
};
