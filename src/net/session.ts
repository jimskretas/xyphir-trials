import type { RoomSession } from './RoomSession';

let activeSession: RoomSession | null = null;

export function setRoomSession(session: RoomSession): void {
  activeSession = session;
}

export function getRoomSession(): RoomSession | null {
  return activeSession;
}

export function clearRoomSession(): void {
  activeSession = null;
}
