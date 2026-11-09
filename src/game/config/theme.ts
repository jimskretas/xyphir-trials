export const COLORS = {
  background: 0x06080c,
  floor: 0x0f141d,
  grid: 0x1c2635,
  arenaMark: 0x26374d,
  wall: 0x273244,
  wallEdge: 0x455a75,
  playerOneGlow: 0x22d3ee,
  playerOne: 0x2dd4bf,
  playerOneEdge: 0x0f766e,
  playerOnePointer: 0xf0fdfa,
  playerTwoGlow: 0xfbbf24,
  playerTwo: 0xf59e0b,
  playerTwoEdge: 0x92400e,
  playerTwoPointer: 0xfffbeb,
  reflectedProjectile: 0x67e8f9,
} as const;

export const UI_COLORS = {
  debugText: '#a9bfd4',
  hintText: '#5f7288',
  objectiveText: '#cbd8e6',
  debugBackground: 'rgba(8, 11, 17, 0.85)',
  resultVictory: '#67e8f9',
  resultDefeat: '#f87171',
  resultSubtitle: '#cbd8e6',
  startTitle: '#67e8f9',
  startSubtitle: '#cbd8e6',
  startBody: '#a9bfd4',
  startMuted: '#5f7288',
  startAccent: '#fbbf24',
} as const;

export function toCssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
