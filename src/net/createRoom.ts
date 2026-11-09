import {
  readSupabaseConfig,
  shouldUseLocalTransport,
} from './config';
import { LocalTransport } from './LocalTransport';
import { RoomSession } from './RoomSession';
import type { RoomTransport } from './RoomTransport';
import { createRoomCode } from './roomCode';
import { setRoomSession } from './session';
import { SupabaseTransport } from './SupabaseTransport';

export interface HostRoom {
  session: RoomSession;
  code: string;
  isLocalTest: boolean;
}

export interface GuestRoom {
  session: RoomSession;
  code: string;
  isLocalTest: boolean;
}

function createTransport(
  code: string,
): { transport: RoomTransport; isLocalTest: boolean } {
  if (shouldUseLocalTransport()) {
    return {
      transport: new LocalTransport(code),
      isLocalTest: true,
    };
  }

  const config = readSupabaseConfig();

  if (!config) {
    throw new Error(
      'Multiplayer is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    );
  }

  return {
    transport: new SupabaseTransport(config, code),
    isLocalTest: false,
  };
}

export function createHostRoom(): HostRoom {
  const code = createRoomCode();
  const { transport, isLocalTest } = createTransport(code);
  const session = new RoomSession('host', code, transport, isLocalTest);

  setRoomSession(session);

  return { session, code, isLocalTest };
}

export function createGuestRoom(inputCode: string): GuestRoom {
  const code = inputCode;
  const { transport, isLocalTest } = createTransport(code);
  const session = new RoomSession('guest', code, transport, isLocalTest);

  setRoomSession(session);

  return { session, code, isLocalTest };
}
