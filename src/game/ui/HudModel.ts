import type { PlayerId } from '../config/controls';

export interface AbilityHudState {
  label: string;
  ready: boolean;
  active: boolean;
  ratio: number;
}

export interface SkillHudState {
  label: string;
  keyLabel: string;
  ready: boolean;
  active: boolean;
  ratio: number;
}

export interface PlayerHudState {
  id: PlayerId;
  label: string;
  health: number;
  maxHealth: number;
  downed: boolean;
  autoAttack: boolean;
  fireball: AbilityHudState | null;
  shield: AbilityHudState | null;
  dash: AbilityHudState | null;
  skills: SkillHudState[];
}

export interface BossHudState {
  name: string;
  health: number;
  maxHealth: number;
}

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

export interface PlayerDebugSnapshot {
  label: string;
  position: DebugVector;
  velocity: DebugVector;
  direction: DebugVector;
  facingDegrees: number;
  health: number;
  maxHealth: number;
  downed: boolean;
  dashing: boolean;
  autoAttack: boolean;
  skillActive: boolean;
  blocked: BlockedState;
}

export interface DebugSnapshot {
  players: readonly PlayerDebugSnapshot[];
  enemies: number;
  projectiles: number;
  reflections: number;
  fps: number;
}

export type Outcome = 'victory' | 'defeat';

export interface HudModel {
  objective: string;
  players: PlayerHudState[];
  boss: BossHudState | null;
  debug: DebugSnapshot;
  outcome: Outcome | null;
  resultHint: string;
}
