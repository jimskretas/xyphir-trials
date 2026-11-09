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
  spawnSpacing: 120,
  maxHealth: 100,
  invulnerabilityMs: 700,
  damageFlashMs: 120,
} as const;

export const DASH = {
  durationMs: 180,
  speed: 950,
  cooldownMs: 850,
  alphaWhileDashing: 0.55,
} as const;

export const CAMERA = {
  followLerp: 0.12,
  zoomLerp: 0.1,
  minZoom: 0.55,
  padding: 160,
} as const;

export const DEBUG = {
  enabled: import.meta.env.DEV,
  damageAmount: 25,
} as const;
