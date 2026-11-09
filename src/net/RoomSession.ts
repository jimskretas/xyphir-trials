import type { PlayerId } from '../game/config/controls';
import type { SfxName } from '../game/systems/SfxSystem';
import type { RoomTransport } from './RoomTransport';
import type {
  NetInputFrame,
  NetMessage,
  NetSnapshot,
  PeerPresence,
  TransportRole,
} from './types';
import { clearRoomSession } from './session';
import { isNetSnapshot } from './wire';

const JOIN_RETRY_MS = 1500;
const JOIN_TIMEOUT_MS = 12000;
const DISCONNECT_GRACE_MS = 2500;

export type JoinRejection = 'full' | 'timeout';

export class RoomSession {
  readonly localPlayerId: PlayerId;
  readonly remotePlayerId: PlayerId;
  readonly otherRole: TransportRole;

  onGuestJoined?: () => void;
  onGuestLeft?: () => void;
  onConnected?: () => void;
  onRejected?: (reason: JoinRejection) => void;
  onStart?: (runId: number) => void;
  onInput?: (frame: NetInputFrame) => void;
  onSnapshot?: (snapshot: NetSnapshot) => void;
  onSfx?: (name: SfxName) => void;
  onRestartRequest?: () => void;
  onRestart?: (runId: number) => void;
  onHostLeft?: () => void;
  onPresence?: (peers: readonly PeerPresence[]) => void;

  private guestId: string | null = null;
  private connected = false;
  private started = false;
  private closed = false;
  private runIdValue = 1;
  private joinInterval: number | null = null;
  private joinTimeout: number | null = null;
  private disconnectTimer: number | null = null;
  private guestNotified = false;
  private hostSeen = false;
  private readonly peerRoles = new Set<TransportRole>();

  constructor(
    readonly role: TransportRole,
    readonly code: string,
    private readonly transport: RoomTransport,
    readonly isLocalTest: boolean,
  ) {
    this.localPlayerId = role === 'host' ? 'p1' : 'p2';
    this.remotePlayerId = role === 'host' ? 'p2' : 'p1';
    this.otherRole = role === 'host' ? 'guest' : 'host';
  }

  get runId(): number {
    return this.runIdValue;
  }

  get hasGuest(): boolean {
    return this.guestId !== null;
  }

  async connect(): Promise<void> {
    if (this.closed) {
      throw new Error('This room has already been closed.');
    }

    this.transport.onMessage((message, from) => {
      this.handleMessage(message, from);
    });
    this.transport.onPresence((peers) => {
      this.handlePresence(peers);
    });

    await this.transport.connect({
      role: this.role,
      name: this.role === 'host' ? 'Host' : 'Guest',
    });

    if (this.role === 'guest') {
      this.startJoinRetry();
    }
  }

  startRun(): void {
    if (this.role !== 'host' || !this.guestId || this.closed) {
      return;
    }

    this.started = true;
    this.send({ type: 'start', runId: this.runIdValue });
  }

  restartRun(): void {
    if (this.role !== 'host' || this.closed) {
      return;
    }

    this.runIdValue += 1;
    this.send({ type: 'restart', runId: this.runIdValue });
  }

  requestRestart(): void {
    if (this.role === 'guest' && !this.closed) {
      this.send({ type: 'restart-request' });
    }
  }

  sendInput(frame: NetInputFrame): void {
    if (this.role === 'guest') {
      this.send({ type: 'input', frame });
    }
  }

  sendSnapshot(snapshot: NetSnapshot): void {
    if (this.role === 'host') {
      this.send(snapshot);
    }
  }

  sendSfx(name: SfxName): void {
    if (this.role === 'host' && this.guestId) {
      this.send({ type: 'sfx', name });
    }
  }

  /**
   * Called when the host returns from a finished run to wait for another
   * guest. The transport stays connected and the room code stays valid.
   */
  resetForLobby(): void {
    if (this.role !== 'host' || this.closed) {
      return;
    }

    this.started = false;
    this.guestId = null;
    this.guestNotified = false;
    this.clearDisconnectTimer();
  }

  detachCallbacks(): void {
    this.clearCallbacks();
  }

  async leave(): Promise<void> {
    if (this.closed) {
      return;
    }

    this.send({ type: 'leave', reason: 'left' });
    this.closed = true;
    this.stopTimers();
    this.clearCallbacks();
    clearRoomSession();
    await this.transport.close();
  }

  private send(message: NetMessage): void {
    if (this.closed) {
      return;
    }

    this.transport.send(message);
  }

  private handleMessage(message: NetMessage, from: string): void {
    if (this.closed || from === this.transport.selfId) {
      return;
    }

    switch (message.type) {
      case 'join':
        this.handleJoin(from);
        break;
      case 'welcome':
        if (this.role !== 'guest') {
          return;
        }

        this.connected = true;
        this.hostSeen = true;
        this.runIdValue = message.runId;
        this.stopJoinRetry();
        this.onConnected?.();
        break;
      case 'full':
        if (this.role === 'guest') {
          this.stopJoinRetry();
          this.onRejected?.('full');
        }
        break;
      case 'start':
        if (this.role === 'guest') {
          this.started = true;
          this.runIdValue = message.runId;
          this.onStart?.(message.runId);
        }
        break;
      case 'input':
        if (this.role === 'host' && message.frame) {
          this.onInput?.(message.frame);
        }
        break;
      case 'snapshot':
        if (this.role === 'guest' && isNetSnapshot(message)) {
          this.runIdValue = message.runId;
          this.onSnapshot?.(message);
        }
        break;
      case 'sfx':
        if (this.role === 'guest') {
          this.onSfx?.(message.name);
        }
        break;
      case 'restart-request':
        if (this.role === 'host') {
          this.onRestartRequest?.();
        }
        break;
      case 'restart':
        if (this.role === 'guest') {
          this.runIdValue = message.runId;
          this.onRestart?.(message.runId);
        }
        break;
      case 'leave':
        this.handlePeerLeave();
        break;
    }
  }

  private handleJoin(from: string): void {
    if (this.role !== 'host') {
      return;
    }

    if (this.started) {
      this.send({ type: 'full' });
      return;
    }

    if (this.guestId && this.guestId !== from) {
      this.send({ type: 'full' });
      return;
    }

    this.guestId = from;
    this.send({ type: 'welcome', runId: this.runIdValue });
    this.notifyGuestJoined();
  }

  private handlePeerLeave(): void {
    if (this.role === 'guest') {
      this.hostSeen = false;
      this.onHostLeft?.();
      return;
    }

    const hadGuest = this.guestId !== null || this.guestNotified;

    this.guestId = null;
    this.guestNotified = false;

    if (hadGuest) {
      this.onGuestLeft?.();
    }
  }

  private handlePresence(peers: readonly PeerPresence[]): void {
    if (this.closed) {
      return;
    }

    this.peerRoles.clear();

    for (const peer of peers) {
      if (peer.id !== this.transport.selfId) {
        this.peerRoles.add(peer.role);
      }
    }

    const other = peers.find(
      (peer) =>
        peer.id !== this.transport.selfId && peer.role === this.otherRole,
    );

    if (this.role === 'host') {
      if (other) {
        this.clearDisconnectTimer();

        if (!this.started) {
          this.guestId ??= other.id;
          this.notifyGuestJoined();
        }
      } else if (this.guestId) {
        this.scheduleDisconnect();
      }
    } else if (other) {
      this.clearDisconnectTimer();
      this.hostSeen = true;
    } else if (this.connected || this.hostSeen) {
      this.scheduleDisconnect();
    }

    this.onPresence?.(peers);
  }

  private notifyGuestJoined(): void {
    if (this.guestNotified) {
      return;
    }

    this.guestNotified = true;
    this.onGuestJoined?.();
  }

  private scheduleDisconnect(): void {
    if (this.disconnectTimer !== null) {
      return;
    }

    this.disconnectTimer = window.setTimeout(() => {
      this.disconnectTimer = null;

      if (this.closed || this.peerRoles.has(this.otherRole)) {
        return;
      }

      if (this.role === 'guest') {
        if (this.connected || this.hostSeen) {
          this.hostSeen = false;
          this.onHostLeft?.();
        }

        return;
      }

      this.guestId = null;
      this.guestNotified = false;
      this.onGuestLeft?.();
    }, DISCONNECT_GRACE_MS);
  }

  private clearDisconnectTimer(): void {
    if (this.disconnectTimer !== null) {
      window.clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }
  }

  private startJoinRetry(): void {
    this.send({ type: 'join' });
    this.joinInterval = window.setInterval(() => {
      this.send({ type: 'join' });
    }, JOIN_RETRY_MS);
    this.joinTimeout = window.setTimeout(() => {
      this.joinTimeout = null;

      if (!this.connected) {
        this.stopJoinRetry();
        this.onRejected?.('timeout');
      }
    }, JOIN_TIMEOUT_MS);
  }

  private stopJoinRetry(): void {
    if (this.joinInterval !== null) {
      window.clearInterval(this.joinInterval);
      this.joinInterval = null;
    }

    if (this.joinTimeout !== null) {
      window.clearTimeout(this.joinTimeout);
      this.joinTimeout = null;
    }
  }

  private stopTimers(): void {
    this.stopJoinRetry();
    this.clearDisconnectTimer();
  }

  private clearCallbacks(): void {
    this.onGuestJoined = undefined;
    this.onGuestLeft = undefined;
    this.onConnected = undefined;
    this.onRejected = undefined;
    this.onStart = undefined;
    this.onInput = undefined;
    this.onSnapshot = undefined;
    this.onSfx = undefined;
    this.onRestartRequest = undefined;
    this.onRestart = undefined;
    this.onHostLeft = undefined;
    this.onPresence = undefined;
  }
}
