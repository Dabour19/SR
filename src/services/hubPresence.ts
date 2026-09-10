/**
 * Lobby hub presence: shares each connected player's name, character and
 * position in the hub arena via Firestore, and broadcasts others in realtime.
 */
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  query,
} from 'firebase/firestore';
import { auth, db, loginAnonymously } from './firebase';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import type { CharacterId, CharacterTheme } from '../types';

export interface HubPlayer {
  id: string;
  name: string;
  characterId: CharacterId;
  theme: CharacterTheme;
  x: number; // world px (see game/cityScene WORLD_W/WORLD_H)
  y: number;
  facingLeft: boolean;
  isMoving: boolean;
  /** Last emote emoji shown above the head ('' = none). */
  emote: string;
  /** Timestamp (ms) of the last emote. */
  emoteAt: number;
  updatedAt: number;
}

export type HubPlayerInput = Omit<HubPlayer, 'updatedAt' | 'emote' | 'emoteAt'> & Partial<Pick<HubPlayer, 'emote' | 'emoteAt'>>;

const STALE_MS = 20000;

class HubPresenceService {
  private others: HubPlayer[] = [];
  private listeners = new Set<() => void>();
  private unsub: (() => void) | null = null;
  private authUnsub: (() => void) | null = null;
  private started = false;
  private joined = false;
  private myDoc: Omit<HubPlayer, 'updatedAt'> | null = null;
  private lastWrite = 0;
  private pendingTimer: number | null = null;

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.authUnsub = onAuthStateChanged(auth, (u: FirebaseUser | null) => {
      if (u && this.joined) this.subscribeCollection();
    });
    try {
      if (!auth.currentUser) {
        const res = await loginAnonymously();
        if (!res.success) return;
      }
      this.subscribeCollection();
    } catch (e) {
      console.warn('hub presence auth error', e);
    }
  }

  stop(): void {
    this.leave();
    this.unsub?.();
    this.unsub = null;
    this.authUnsub?.();
    this.authUnsub = null;
    this.started = false;
  }

  private subscribeCollection(): void {
    if (this.unsub) return;
    try {
      const q = query(collection(db, 'lobby'));
      this.unsub = onSnapshot(
        q,
        (snap) => {
          const now = Date.now();
          this.others = snap.docs
            .map((d) => {
              const p = d.data() as Partial<HubPlayer>;
              return {
                ...p,
                emote: p.emote ?? '',
                emoteAt: p.emoteAt ?? 0,
                x: typeof p.x === 'number' ? p.x : 600,
                y: typeof p.y === 'number' ? p.y : 600,
              } as HubPlayer;
            })
            .filter((p) => p.id !== auth.currentUser?.uid && now - (p.updatedAt || 0) < STALE_MS);
          this.notify();
        },
        (err) => console.warn('hub presence snapshot error', err)
      );
    } catch (e) {
      console.warn('hub presence snapshot error', e);
    }
  }

  private normalize(data: HubPlayerInput): Omit<HubPlayer, 'updatedAt'> {
    return {
      ...data,
      emote: data.emote ?? this.myDoc?.emote ?? '',
      emoteAt: data.emoteAt ?? this.myDoc?.emoteAt ?? 0,
    };
  }

  join(data: HubPlayerInput): void {
    this.joined = true;
    this.myDoc = this.normalize(data);
    this.push(true);
  }

  update(data: HubPlayerInput, force = false): void {
    this.myDoc = this.normalize(data);
    this.push(force);
  }

  /** Broadcast an emote immediately (bypasses throttling). */
  emote(emoji: string): void {
    if (!this.myDoc) return;
    this.myDoc = { ...this.myDoc, emote: emoji, emoteAt: Date.now() };
    this.push(true);
  }

  leave(): void {
    this.joined = false;
    if (this.pendingTimer !== null) { window.clearTimeout(this.pendingTimer); this.pendingTimer = null; }
    const uid = this.myFirebaseUid();
    if (uid) deleteDoc(doc(db, 'lobby', uid)).catch(() => { });
    this.myDoc = null;
  }

  private notify(): void {
    this.listeners.forEach((l) => l());
  }

  private myFirebaseUid(): string | null {
    return auth.currentUser?.uid || null;
  }

  private push(force: boolean): void {
    if (!this.myDoc) return;
    const uid = this.myFirebaseUid();
    if (!uid) return;
    const now = Date.now();
    if (!force && now - this.lastWrite < 900) {
      // Schedule a trailing write so the final resting position is always sent.
      if (this.pendingTimer === null) {
        this.pendingTimer = window.setTimeout(() => {
          this.pendingTimer = null;
          this.push(true);
        }, 950 - (now - this.lastWrite));
      }
      return;
    }
    this.lastWrite = now;
    setDoc(doc(db, 'lobby', uid), { ...this.myDoc, id: uid, updatedAt: now }).catch(() => { });
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getOthers(): HubPlayer[] {
    return this.others;
  }
}

export const hubPresence = new HubPresenceService();
