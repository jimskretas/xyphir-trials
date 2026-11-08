export type Team = 'players' | 'enemies';

export interface ProjectilePreset {
  texture: string;
  speed: number;
  damage: number;
  lifetimeMs: number;
  radius: number;
  reflectable: boolean;
  reflectDamageMultiplier: number;
  tint?: number;
}

export interface ProjectileSpawn {
  x: number;
  y: number;
  angle: number;
  team: Team;
  ownerId: string;
  sourceId: string;
  preset: ProjectilePreset;
}
