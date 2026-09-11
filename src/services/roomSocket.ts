/**
 * Real-time co-op room connection (WebSocket).
 * Replaces the Firestore-based runPresence for live play: positions arrive in
 * ~30-80ms instead of 450ms+, and boss damage / kills are SHARED through the
 * server (one boss, one kill counter for the whole team).
 *
 * Server: Cloudflare Worker + Durable Objects (free tier) — see /server.
 * The endpoint can be overridden via localStorage('coop_server_url').
 */
import { getCharacter } from './lobbyService';
import { playerAuthService } from './playerAuthService';
import { auth } from './firebase';
import type { CharacterTheme } from '../types';

export interface RoomPlayer {
  id: string;
  name: string;
  theme: CharacterTheme;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  updatedAt: number;
}

export interface RoomEvents {
  /** Shared boss HP changed (or boss spawned / died) — returns authoritative hp. */
  onBossSync?: (hp: number | null) => void;
  /** A teammate (possibly the server) reports a shared kill. */
  onKill?: () => void;
  /** Server reported the shared boss died. */
  onBossKilled?: () => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

const RECONNECT_MS = 2500;

class RoomSocketService {
  private ws: WebSocket | null = null;
  private url: string = '';
  private others = new Map<string, RoomPlayer>();
  private myId = '';
  private teamCode: string | null = null;
  private active = false;
  private started = false;
  private reconnectTimer: number | null = null;
  private lastSend = 0;
  private pendingPos: { x: number; y: number; hp: number; maxHp: number } | null = null;
  private flushTimer: number | null = null;
  private pendingToken: string | null = null;
  private events: RoomEvents = {};

  constructor() {
    // Local dev fallback: if the app is served from localhost and no explicit
    // server URL is configured, assume the co-op Worker runs on wrangler dev
    // (npm run dev in /server, port 8787) to avoid 'fetch failed' from the
    // unresolved sr-coop.<YOUR-SUBDOMAIN>.workers.dev placeholder.
    const isLocalDev = typeof location !== 'undefined' &&
      /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(location.hostname);
    const fallback = isLocalDev ? 'ws://127.0.0.1:8787/ws' : '';
    let stored: string | null = null;
    try { stored = localStorage.getItem('coop_server_url'); } catch { /* ignore */ }
    // Ignore unconfigured/placeholder endpoints so we never hammer a dead host.
    this.url = stored && !stored.includes('<') ? stored.replace(/\/+$/, '') + '/ws' : fallback;
  }

  /** Set/override the server endpoint (e.g. after deploying your Worker). */
  setServerUrl(url: string) {
    this.url = url.replace(/\/+$/, '') + '/ws';
    try { localStorage.setItem('coop_server_url', url); } catch { /* ignore */ }
  }

  setEvents(events: RoomEvents) { this.events = events; }

  getOthers(): RoomPlayer[] { return [...this.others.values()]; }
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
  getTeamCode(): string | null { return this.teamCode; }

  /** Begin the live room session for this team (falls back silently offline). */
  start(teamCode: string): void {
    if (!teamCode) return;
    this.teamCode = teamCode;
    this.active = true;
    if (!this.started) {
      this.started = true;
      this.connect();
    } else if (this.isConnected()) {
      // already on the same room — nothing to do
    } else {
      this.connect();
    }
  }

  private async connect(): Promise<void> {
    // No co-op server configured (or placeholder) → skip live room silently;
    // Firestore presence (runPresence) still shows teammates.
    if (!this.url) return;
    if (!this.teamCode || !this.active) return;
    try { this.ws?.close(); } catch { /* ignore */ }

    const me = playerAuthService.getCurrentUser();
    this.myId = me.id;
    const theme = getCharacter((me.avatar || 'blade') as any).theme;
    const qs = new URLSearchParams({
      room: this.teamCode,
      id: me.id,
      name: me.username,
      theme: JSON.stringify(theme),
    });
    // Identity: attach a Firebase ID token when the player is signed in with
    // Google so the server can verify id/name against a real signature.
    try {
      const fbUser = auth.currentUser;
      if (fbUser) this.pendingToken = await fbUser.getIdToken();
    } catch { /* ignore */ }
    if (this.pendingToken) qs.set('token', this.pendingToken);
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${this.url}?${qs.toString()}`);
    } catch (e) {
      console.warn('room socket connect failed', e);
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => this.events.onConnected?.();
    ws.onmessage = (ev) => this.handleMessage(ev.data);
    ws.onclose = () => {
      this.others.clear();
      this.events.onDisconnected?.();
      this.scheduleReconnect();
    };
    ws.onerror = () => { try { ws.close(); } catch { /* ignore */ } };
  }

  private scheduleReconnect(): void {
    if (!this.active) return;
    if (this.reconnectTimer !== null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, RECONNECT_MS);
  }

  private handleMessage(raw: unknown): void {
    let msg: any;
    try { msg = JSON.parse(String(raw)); } catch { return; }
    const now = Date.now();

    switch (msg.t) {
      case 's': { // full snapshot
        // NOTE: never overwrite myId from the server — it comes from our own
        // auth service. Only accept player records for others.
        for (const p of msg.players || []) {
          if (p.id === this.myId) continue;
          this.others.set(p.id, this.toRunPlayer(p, now));
        }
        this.events.onBossSync?.(msg.boss ? msg.boss.hp : null);
        break;
      }
      case 'join': {
        if (msg.id && msg.id !== this.myId) {
          this.others.set(msg.id, {
            id: msg.id, name: msg.name || 'بطل',
            theme: msg.theme || getCharacter('blade').theme,
            x: 0, y: 0, hp: 1, maxHp: 1, updatedAt: now,
          });
        }
        break;
      }
      case 'p': {
        const o = this.others.get(msg.id);
        if (!o) break;
        o.x = msg.x; o.y = msg.y; o.hp = msg.hp; o.maxHp = msg.maxHp; o.updatedAt = now;
        break;
      }
      case 'leave': {
        this.others.delete(msg.id);
        break;
      }
      case 'bs': this.events.onBossSync?.(msg.hp); break;
      case 'b': this.events.onBossSync?.(msg.hp); break;
      case 'k': {
        if (msg.boss) this.events.onBossKilled?.();
        else this.events.onKill?.();
        break;
      }
      case 'kc': break; // server-side kill counter (unused client-side for now)
    }
  }

  private toRunPlayer(p: any, now: number): RoomPlayer {
    return {
      id: p.id,
      name: p.name || 'بطل',
      theme: p.theme || getCharacter('blade').theme,
      x: typeof p.x === 'number' ? p.x : 0,
      y: typeof p.y === 'number' ? p.y : 0,
      hp: p.hp || 1,
      maxHp: p.maxHp || 1,
      updatedAt: now,
    };
  }

  /** Throttled position publish (~20Hz) called from the game loop. */
  update(x: number, y: number, hp: number, maxHp: number): void {
    if (!this.isConnected()) return;
    this.pendingPos = { x, y, hp, maxHp };
    const now = Date.now();
    if (now - this.lastSend < 50) {
      // Flush the held position once the throttle window expires so the last
      // movement is never lost (previously it waited for the next update).
      if (this.flushTimer === null) {
        this.flushTimer = window.setTimeout(() => {
          this.flushTimer = null;
          this.flushPending();
        }, 55);
      }
      return;
    }
    this.lastSend = now;
    const p = this.pendingPos!;
    this.pendingPos = null;
    this.ws!.send(JSON.stringify({ t: 'p', x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp }));
  }

  private flushPending(): void {
    if (!this.isConnected() || !this.pendingPos) return;
    const p = this.pendingPos;
    this.pendingPos = null;
    this.lastSend = Date.now();
    this.ws!.send(JSON.stringify({ t: 'p', x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp }));
  }

  /** Report a normal enemy kill → increments the shared team counter. */
  sendKill(): void {
    if (this.isConnected()) this.ws!.send(JSON.stringify({ t: 'k' }));
  }

  /** Report boss damage → the server keeps the authoritative shared HP. */
  sendBossDamage(dmg: number): void {
    if (this.isConnected()) this.ws!.send(JSON.stringify({ t: 'b', dmg }));
  }

  /** Report a boss spawn (first client to reach it wins; server dedupes). */
  sendBossSpawn(hp: number): void {
    if (this.isConnected()) this.ws!.send(JSON.stringify({ t: 'bs', hp }));
  }

  leave(): void {
    this.active = false;
    this.teamCode = null;
    this.others.clear();
    this.pendingToken = null;
    if (this.flushTimer !== null) {
      window.clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try { this.ws?.close(); } catch { /* ignore */ }
    this.ws = null;
  }
}

export const roomSocket = new RoomSocketService();
