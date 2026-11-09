import type { RoomTransport, TransportPresenceMeta } from './RoomTransport';
import type { NetMessage, PeerPresence } from './types';
import { createPeerId } from './roomCode';
import { isRecord, parseWireMessage } from './wire';

const HEARTBEAT_MS = 1000;
const PEER_TIMEOUT_MS = 3500;

type LocalWire =
  | { kind: 'net'; from: string; body: NetMessage }
  | { kind: 'presence'; from: string; meta: TransportPresenceMeta }
  | { kind: 'leave'; from: string };

interface TrackedPeer {
  meta: TransportPresenceMeta;
  lastSeen: number;
}

/**
 * Same-browser transport used for development when no Supabase credentials
 * are present. It mirrors the real transport's message and presence shape so
 * the lobby and netcode can be tested with two tabs.
 */
export class LocalTransport implements RoomTransport {
  readonly selfId = createPeerId();

  private channel: BroadcastChannel | null = null;
  private messageHandler: ((message: NetMessage, from: string) => void) | null =
    null;
  private presenceHandler: ((peers: readonly PeerPresence[]) => void) | null =
    null;
  private readonly peers = new Map<string, TrackedPeer>();
  private heartbeat: number | null = null;
  private sweeper: number | null = null;
  private meta: TransportPresenceMeta | null = null;
  private closed = false;

  constructor(private readonly roomCode: string) {}

  async connect(meta: TransportPresenceMeta): Promise<void> {
    if (this.closed) {
      throw new Error('This room has already been closed.');
    }

    if (typeof BroadcastChannel === 'undefined') {
      throw new Error('Local test mode needs BroadcastChannel support.');
    }

    this.meta = meta;
    this.channel = new BroadcastChannel(
      `xyphir-room-${this.roomCode.toLowerCase()}`,
    );
    this.channel.onmessage = (event: MessageEvent<unknown>) => {
      this.handleWire(event.data);
    };

    this.sendPresence();
    this.heartbeat = window.setInterval(() => this.sendPresence(), HEARTBEAT_MS);
    this.sweeper = window.setInterval(() => this.sweepPeers(), HEARTBEAT_MS);

    await Promise.resolve();
  }

  send(message: NetMessage): void {
    if (this.closed || !this.channel) {
      return;
    }

    const wire: LocalWire = {
      kind: 'net',
      from: this.selfId,
      body: message,
    };

    this.channel.postMessage(wire);
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

    if (this.heartbeat !== null) {
      window.clearInterval(this.heartbeat);
      this.heartbeat = null;
    }

    if (this.sweeper !== null) {
      window.clearInterval(this.sweeper);
      this.sweeper = null;
    }

    if (this.channel) {
      const leave: LocalWire = { kind: 'leave', from: this.selfId };
      this.channel.postMessage(leave);
      this.channel.close();
      this.channel = null;
    }

    this.peers.clear();
  }

  private sendPresence(): void {
    if (this.closed || !this.channel || !this.meta) {
      return;
    }

    const wire: LocalWire = {
      kind: 'presence',
      from: this.selfId,
      meta: this.meta,
    };

    this.channel.postMessage(wire);
  }

  private handleWire(value: unknown): void {
    if (this.closed || !isRecord(value) || typeof value.kind !== 'string') {
      return;
    }

    if (value.kind === 'net') {
      const wire = parseWireMessage(value);

      if (wire && wire.from !== this.selfId) {
        this.messageHandler?.(wire.body, wire.from);
      }

      return;
    }

    if (value.kind === 'presence') {
      const { from, meta } = value;

      if (
        typeof from === 'string' &&
        from !== this.selfId &&
        isRecord(meta) &&
        (meta.role === 'host' || meta.role === 'guest') &&
        typeof meta.name === 'string'
      ) {
        this.peers.set(from, {
          meta: { role: meta.role, name: meta.name },
          lastSeen: Date.now(),
        });
        this.emitPresence();
      }

      return;
    }

    if (value.kind === 'leave' && typeof value.from === 'string') {
      this.peers.delete(value.from);
      this.emitPresence();
    }
  }

  private sweepPeers(): void {
    const cutoff = Date.now() - PEER_TIMEOUT_MS;
    let changed = false;

    for (const [id, peer] of this.peers) {
      if (peer.lastSeen < cutoff) {
        this.peers.delete(id);
        changed = true;
      }
    }

    if (changed) {
      this.emitPresence();
    }
  }

  private emitPresence(): void {
    const peers: PeerPresence[] = [];

    for (const [id, peer] of this.peers) {
      peers.push({
        id,
        role: peer.meta.role,
        name: peer.meta.name,
      });
    }

    this.presenceHandler?.(peers);
  }
}
