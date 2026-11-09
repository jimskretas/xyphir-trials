import type {
  NetMessage,
  PeerPresence,
  TransportRole,
} from './types';

export interface TransportPresenceMeta {
  role: TransportRole;
  name: string;
}

export interface RoomTransport {
  readonly selfId: string;
  connect(meta: TransportPresenceMeta): Promise<void>;
  send(message: NetMessage): void;
  onMessage(handler: (message: NetMessage, from: string) => void): void;
  onPresence(handler: (peers: readonly PeerPresence[]) => void): void;
  close(): Promise<void>;
}
