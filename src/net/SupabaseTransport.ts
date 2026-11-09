import { createClient } from '@supabase/supabase-js';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseConfig } from './config';
import type { RoomTransport, TransportPresenceMeta } from './RoomTransport';
import type { NetMessage, PeerPresence, TransportRole } from './types';
import { createPeerId } from './roomCode';
import { parseWireMessage } from './wire';

interface PresenceMeta {
  id: string;
  role: TransportRole;
  name: string;
}

const CONNECT_TIMEOUT_MS = 12000;

export class SupabaseTransport implements RoomTransport {
  readonly selfId = createPeerId();

  private readonly client: SupabaseClient;
  private channel: RealtimeChannel | null = null;
  private messageHandler: ((message: NetMessage, from: string) => void) | null =
    null;
  private presenceHandler: ((peers: readonly PeerPresence[]) => void) | null =
    null;
  private closed = false;

  constructor(
    config: SupabaseConfig,
    private readonly roomCode: string,
  ) {
    this.client = createClient(config.url, config.anonKey, {
      realtime: {
        params: {
          eventsPerSecond: 30,
        },
      },
    });
  }

  async connect(meta: TransportPresenceMeta): Promise<void> {
    if (this.closed) {
      throw new Error('This room has already been closed.');
    }

    const channel = this.client.channel(
      `xyphir-room-${this.roomCode.toLowerCase()}`,
      {
        config: {
          broadcast: { self: false },
          presence: { key: this.selfId, enabled: true },
        },
      },
    );

    this.channel = channel;

    channel.on('broadcast', { event: 'net' }, (payload) => {
      const message = parseWireMessage(payload.payload);

      if (message) {
        this.messageHandler?.(message.body, message.from);
      }
    });

    channel.on('presence', { event: 'sync' }, () => {
      this.emitPresence();
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(new Error('Timed out connecting to the room.'));
      }, CONNECT_TIMEOUT_MS);

      channel.subscribe((status, error) => {
        if (status === 'SUBSCRIBED') {
          window.clearTimeout(timeout);
          resolve();
          return;
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          window.clearTimeout(timeout);
          reject(
            error ??
              new Error(`Could not join the room (${status.toLowerCase()}).`),
          );
        }
      });
    });

    await channel.track({
      id: this.selfId,
      role: meta.role,
      name: meta.name,
    });

    this.emitPresence();
  }

  send(message: NetMessage): void {
    if (this.closed || !this.channel) {
      return;
    }

    void this.channel
      .send({
        type: 'broadcast',
        event: 'net',
        payload: {
          from: this.selfId,
          body: message,
        },
      })
      .catch(() => undefined);
  }

  onMessage(handler: (message: NetMessage, from: string) => void): void {
    this.messageHandler = handler;
  }

  onPresence(handler: (peers: readonly PeerPresence[]) => void): void {
    this.presenceHandler = handler;
  }

  async close(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.closed = true;
    const channel = this.channel;
    this.channel = null;

    if (!channel) {
      return;
    }

    try {
      await channel.untrack();
    } catch {
      // The socket may already be gone; removing the channel is enough.
    }

    await this.client.removeChannel(channel);
  }

  private emitPresence(): void {
    const channel = this.channel;

    if (!channel) {
      return;
    }

    const state = channel.presenceState<PresenceMeta>();
    const peers: PeerPresence[] = [];

    for (const entries of Object.values(state)) {
      for (const entry of entries) {
        if (
          typeof entry.id === 'string' &&
          (entry.role === 'host' || entry.role === 'guest')
        ) {
          peers.push({
            id: entry.id,
            role: entry.role,
            name:
              typeof entry.name === 'string' && entry.name.length > 0
                ? entry.name
                : entry.role,
          });
        }
      }
    }

    this.presenceHandler?.(peers);
  }
}
