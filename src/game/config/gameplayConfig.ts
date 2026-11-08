export const VIEWPORT = {
  width: 1280,
  height: 720,
} as const;

export const ARENA = {
  width: 1920,
  height: 1280,
  wallThickness: 48,
  gridSize: 64,
} as const;

export const PLAYER = {
  radius: 18,
  speed: 260,
  turnSpeed: 18,
} as const;

export const CAMERA = {
  followLerp: 0.12,
  deadzoneWidth: 64,
  deadzoneHeight: 64,
} as const;

export const DEBUG = {
  enabled: import.meta.env.DEV,
} as const;
