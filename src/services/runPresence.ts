/**
 * In-dungeon (battle) presence for co-op teams.
 * While a team match is running, each member publishes their position to
 * Firestore (`runLobby` collection) and receives teammates in realtime so the
 * game engine can render them inside the dungeon.
 */
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';
import { auth, db, loginAnonymously } from './firebase';
import { playerAuthService } from './playerAuthService';
import { getCharacter } from './lobbyService';
import type { CharacterTheme } from '../types';

export interface RunPlayer {
  id: string;
  name: string;
  theme: CharacterTheme;
  x: number;
  y: number;
  updatedAt: number;
}

const STALE_MS = 12000;

class RunPresenceService {
  private others: RunPlayer[] = [];
  private listeners = new Set<() => void>();
  private unsub: (() => void) | null = null;
  private started = false;
  private active = false;
  private teamCode: string | null = null;
  private lastWrite = 0;
  private pendingTimer: number | null = null;

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private notify() {
    this.listeners.forEach((l) => l());
  }

  getOthers(): RunPlayer[] {
    return this.others;
  }
  getTeamCode(): string | null {
    return this.teamCode;
  }

  /** Begin publishing my position for this team's run. */
  async start(teamCode: string): Promise<void> {
    if (!teamCode) return;
    this.teamCode = teamCode;
    if (this.started) {
      this.active = true;
      this.push(true);
      return;
    }
    try {
      if (!auth.currentUser) {
        const res = await loginAnonymously();
        if (!res.success) return;
      }
      this.started = true;
      this.active = true;
      const q = query(collection(db, 'runLobby'), where('teamCode', '==', teamCode));
      this.unsub = onSnapshot(
        q,
        (snap) => {
          const now = Date.now();
          this.others = snap.docs
            .map((d) => d.data() as Partial<RunPlayer>)
            .filter((p) => p.id && p.id !== auth.currentUser?.uid)
            .map((p) => ({
              id: p.id!,
              name: p.name || 'بطل',
              theme: p.theme || getCharacter('blade').theme,
              x: typeof p.x === 'number' ? p.x : 0,
              y: typeof p.y === 'number' ? p.y : 0,
              updatedAt: p.updatedAt || 0,
            }))
            .filter((p) => now - p.updatedAt < STALE_MS);
          this.notify();
        },
        (err) => console.warn('run presence snapshot error', err)
      );
      this.push(true);
    } catch (e) {
      console.warn('run presence start error', e);
    }
  }

  /** Throttled position publish (called from the game loop). */
  update(x: number, y: number, force = false): void {
    if (!this.active || !this.teamCode) return;
    this.myPos = { x, y };
    this.push(force);
  }
  private myPos = { x: 0, y: 0 };

  private push(force: boolean): void {
    const uid = auth.currentUser?.uid;
    if (!uid || !this.teamCode) return;
    const now = Date.now();
    if (!force && now - this.lastWrite < 450) {
      if (this.pendingTimer === null) {
        this.pendingTimer = window.setTimeout(() => {
          this.pendingTimer = null;
          this.push(true);
        }, 500 - (now - this.lastWrite));
      }
      return;
    }
    this.lastWrite = now;
    const me = playerAuthService.getCurrentUser();
    const theme = getCharacter((me.avatar || 'blade') as any).theme;
    setDoc(
      doc(db, 'runLobby', `${this.teamCode}_${uid}`),
      {
        id: uid,
        name: me.username,
        theme,
        teamCode: this.teamCode,
        x: this.myPos.x,
        y: this.myPos.y,
        updatedAt: now,
      },
      { merge: true }
    ).catch(() => {});
  }

  /** Leave the run: remove my doc and stop listening. */
  leave(): void {
    this.active = false;
    if (this.pendingTimer !== null) { window.clearTimeout(this.pendingTimer); this.pendingTimer = null; }
    const uid = auth.currentUser?.uid;
    if (uid && this.teamCode) {
      deleteDoc(doc(db, 'runLobby', `${this.teamCode}_${uid}`)).catch(() => {});
    }
    this.unsub?.();
    this.unsub = null;
    this.started = false;
    this.teamCode = null;
    this.others = [];
    this.notify();
  }
}

export const runPresence = new RunPresenceService();
