const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 5;

export function createRoomCode(): string {
  const values = new Uint32Array(ROOM_CODE_LENGTH);
  crypto.getRandomValues(values);

  let code = '';

  for (const value of values) {
    code += ROOM_ALPHABET[value % ROOM_ALPHABET.length];
  }

  return code;
}

export function normalizeRoomCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, ROOM_CODE_LENGTH);
}

export function isValidRoomCode(code: string): boolean {
  return code.length === ROOM_CODE_LENGTH;
}

export function createPeerId(): string {
  const values = new Uint32Array(2);
  crypto.getRandomValues(values);

  return `${values[0].toString(36)}${values[1].toString(36)}`;
}
