/**
 * Central connectivity service.
 * Single source of truth for online/offline status so every cloud-backed
 * feature (auth, leaderboard, friends, co-op presence) can degrade gracefully
 * when the device loses internet — the game itself stays fully playable.
 */
type Listener = (online: boolean) => void;

class ConnectivityService {
  private online: boolean =
    typeof navigator !== 'undefined' ? navigator.onLine : true;
  private listeners = new Set<Listener>();
  private listenersOnceOnline = new Set<() => void>();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  private handleOnline = () => {
    const wasOffline = !this.online;
    this.online = true;
    if (wasOffline) {
      this.listeners.forEach((l) => l(true));
      this.listenersOnceOnline.forEach((fn) => fn());
      this.listenersOnceOnline.clear();
    }
  };

  private handleOffline = () => {
    if (this.online) {
      this.online = false;
      this.listeners.forEach((l) => l(false));
    }
  };

  isOnline(): boolean {
    return this.online;
  }

  isOffline(): boolean {
    return !this.online;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Resolve (immediately or later) once connectivity is restored. */
  onceOnline(fn: () => void): void {
    if (this.online) {
      fn();
    } else {
      this.listenersOnceOnline.add(fn);
    }
  }
}

export const connectivityService = new ConnectivityService();
