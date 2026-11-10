import type { NetMessage, NetSnapshot, NetWireMessage } from './types';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOutcome(value: unknown): boolean {
  return value === null || value === 'victory' || value === 'defeat';
}

/**
 * Snapshots come from another browser over a public room channel, so the
 * guest checks their shape before rendering. Only the host is expected to
 * send them, but a malformed payload must never break the renderer.
 */
export function isNetSnapshot(value: unknown): value is NetSnapshot {
  return (
    isRecord(value) &&
    value.type === 'snapshot' &&
    Array.isArray(value.players) &&
    Array.isArray(value.enemies) &&
    Array.isArray(value.projectiles) &&
    Array.isArray(value.turrets) &&
    Array.isArray(value.walls) &&
    Array.isArray(value.waves) &&
    (value.boss === null || isRecord(value.boss)) &&
    (value.telegraph === null || isRecord(value.telegraph)) &&
    typeof value.objective === 'string' &&
    isOutcome(value.outcome)
  );
}

/**
 * The transport is a public room channel, so every message is treated as
 * untrusted input. This validates the envelope and the message discriminant;
 * the game still defensively handles unknown values at the edges.
 */
export function parseWireMessage(value: unknown): NetWireMessage | null {
  if (!isRecord(value)) {
    return null;
  }

  const { from, body } = value;

  if (typeof from !== 'string' || !isRecord(body)) {
    return null;
  }

  if (typeof body.type !== 'string') {
    return null;
  }

  return {
    from,
    body: body as unknown as NetMessage,
  };
}
