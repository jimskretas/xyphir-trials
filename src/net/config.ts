export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

interface XyphirEnv {
  readonly DEV: boolean;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

const env = import.meta.env as unknown as XyphirEnv;

export function readSupabaseConfig(): SupabaseConfig | null {
  const url = env.VITE_SUPABASE_URL?.trim();
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

export function isDevelopment(): boolean {
  return env.DEV;
}

export function forceLocalTransport(): boolean {
  if (!env.DEV || typeof window === 'undefined') {
    return false;
  }

  return (
    new URLSearchParams(window.location.search).get('transport') === 'local'
  );
}

/**
 * Dev builds without Supabase credentials fall back to same-browser tabs so
 * the lobby and netcode can be tested without a project. Production builds
 * always require real credentials.
 */
export function shouldUseLocalTransport(): boolean {
  if (forceLocalTransport()) {
    return true;
  }

  return env.DEV && readSupabaseConfig() === null;
}

export function isMultiplayerConfigured(): boolean {
  return readSupabaseConfig() !== null || shouldUseLocalTransport();
}
