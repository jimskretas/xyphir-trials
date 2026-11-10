import type { PlayerId } from '../game/config/controls';
import type { SfxName } from '../game/systems/SfxSystem';
import type { Outcome } from '../game/ui/HudModel';

export type TransportRole = 'host' | 'guest';

export interface PeerPresence {
  id: string;
  role: TransportRole;
  name: string;
}

export interface NetWireMessage {
  from: string;
  body: NetMessage;
}

export interface NetInputFrame {
  seq: number;
  movementX: number;
  movementY: number;
  fireball: boolean;
  shield: boolean;
  dash: boolean;
  autoAttackToggle: boolean;
  skillCasts: boolean[];
}

export interface NetAbilityState {
  ready: boolean;
  active: boolean;
  ratio: number;
}

export interface NetPlayerState {
  id: PlayerId;
  x: number;
  y: number;
  rotation: number;
  alpha: number;
  tint: number | null;
  health: number;
  maxHealth: number;
  alive: boolean;
  dashing: boolean;
  autoAttack: boolean;
  shieldActive: boolean;
  fireball: NetAbilityState;
  shield: NetAbilityState;
  dash: NetAbilityState;
  skills: NetAbilityState[];
}

export interface NetEnemyState {
  id: string;
  kind: 'grunt' | 'boss';
  x: number;
  y: number;
  rotation: number;
  alpha: number;
  scaleX: number;
  scaleY: number;
  tint: number | null;
}

export interface NetProjectileState {
  id: number;
  x: number;
  y: number;
  rotation: number;
  texture: string;
  scaleX: number;
  scaleY: number;
  tint: number | null;
}

export interface NetTurretState {
  ownerId: PlayerId;
  x: number;
  y: number;
  rotation: number;
  alpha: number;
}

export interface NetWallState {
  ownerId: PlayerId;
  x: number;
  y: number;
  rotation: number;
  length: number;
  thickness: number;
  alpha: number;
}

export interface NetWaveState {
  ownerId: PlayerId;
  x: number;
  y: number;
  radius: number;
  alpha: number;
}

export interface NetBossState {
  health: number;
  maxHealth: number;
}

export interface NetTelegraphState {
  x: number;
  y: number;
  radius: number;
  progress: number;
}

export interface NetSnapshot {
  type: 'snapshot';
  runId: number;
  serverTime: number;
  players: NetPlayerState[];
  enemies: NetEnemyState[];
  projectiles: NetProjectileState[];
  turrets: NetTurretState[];
  walls: NetWallState[];
  waves: NetWaveState[];
  boss: NetBossState | null;
  telegraph: NetTelegraphState | null;
  objective: string;
  outcome: Outcome | null;
  reflections: number;
  debugEnemies: number;
  debugProjectiles: number;
}

export interface NetJoinMessage {
  type: 'join';
}

export interface NetWelcomeMessage {
  type: 'welcome';
  runId: number;
}

export interface NetFullMessage {
  type: 'full';
}

export interface NetStartMessage {
  type: 'start';
  runId: number;
}

export interface NetInputMessage {
  type: 'input';
  frame: NetInputFrame;
}

export interface NetSfxMessage {
  type: 'sfx';
  name: SfxName;
}

export interface NetRestartRequestMessage {
  type: 'restart-request';
}

export interface NetRestartMessage {
  type: 'restart';
  runId: number;
}

export interface NetLeaveMessage {
  type: 'leave';
  reason: 'left' | 'closed';
}

export type NetMessage =
  | NetSnapshot
  | NetJoinMessage
  | NetWelcomeMessage
  | NetFullMessage
  | NetStartMessage
  | NetInputMessage
  | NetSfxMessage
  | NetRestartRequestMessage
  | NetRestartMessage
  | NetLeaveMessage;
