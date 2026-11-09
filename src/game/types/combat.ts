export type Team = 'players' | 'enemies';

export interface ProjectilePreset {
  texture: string;
  speed: number;
  damage: number;
  radius: number;
  reflectable: boolean;
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

export interface ProjectileReflection {
  team: Team;
  ownerId: string;
  angle: number;
  offset: number;
  lockMs: number;
}
