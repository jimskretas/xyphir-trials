export const COLORS = {
  background: 0x06080c,
  floor: 0x0f141d,
  grid: 0x1c2635,
  arenaMark: 0x26374d,
  wall: 0x273244,
  wallEdge: 0x455a75,
  playerGlow: 0x22d3ee,
  player: 0x2dd4bf,
  playerEdge: 0x0f766e,
  playerPointer: 0xf0fdfa,
} as const;

export const UI_COLORS = {
  debugText: '#a9bfd4',
  hintText: '#5f7288',
  debugBackground: 'rgba(8, 11, 17, 0.85)',
} as const;

export function toCssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
