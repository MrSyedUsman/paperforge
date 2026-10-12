/** Browser storage boundary. No access occurs during module loading or SSR. */
export const browserStorage = {
  getRaw(key: string): string | null {
    try {
      return typeof window === "undefined" ? null : window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  read<T>(key: string, fallback: T): T {
    const raw = this.getRaw(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  write(key: string, value: unknown): boolean {
    try {
      if (typeof window === "undefined") return false;
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key: string): void {
    try {
      if (typeof window !== "undefined") window.localStorage.removeItem(key);
    } catch {
      // Restricted browser storage is optional for the current session.
    }
  },
};
