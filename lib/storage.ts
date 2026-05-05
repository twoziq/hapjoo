// Safe localStorage helpers — guard against SSR and private-browsing throws.

const hasStorage = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
};

export function safeGetItem(key: string): string | null {
  if (!hasStorage()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetItem(key: string, value: string): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore quota / private-mode errors
  }
}

export function safeRemoveItem(key: string): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function safeGetJSON<T>(key: string, fallback: T): T {
  const raw = safeGetItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function safeSetJSON(key: string, value: unknown): void {
  try {
    safeSetItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function safeGetInt(key: string, fallback: number): number {
  const raw = safeGetItem(key);
  if (raw === null) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

const hasSession = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return typeof window.sessionStorage !== 'undefined';
  } catch {
    return false;
  }
};

export function safeSessionGetItem(key: string): string | null {
  if (!hasSession()) return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSessionSetItem(key: string, value: string): void {
  if (!hasSession()) return;
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // ignore
  }
}
