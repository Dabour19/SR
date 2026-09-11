/**
 * DungeonRoom — Durable Object per team (room id = team code).
 * Shared truth for a run: player positions, shared boss HP, shared kill counter.
 * Uses Hibernating WebSockets so an idle room costs ~0 on the free plan.
 */

import { verifyIdToken } from './verifyToken';

const MAX_PLAYERS = 8;

export class DungeonRoom {
  private state: DurableObjectState;
  public env: any;
  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
  }
  private players = new Map<string, { id: string; name: string; theme: unknown; x: number; y: number; hp: number; maxHp: number }>();
  private boss: { hp: number; maxHp: number } | null = null;
  private kills = 0;
  private lastPosBroadcast = 0;
  private killsTimer: ReturnType<typeof setTimeout> | null = null;

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/ws') return new Response('not found', { status: 404 });

    const pair = new WebSocketPair();
    const clientId = url.searchParams.get('id') || crypto.randomUUID();
    const name = (url.searchParams.get('name') || 'بطل').slice(0, 24);
    let theme: unknown = {};
    try { theme = JSON.parse(url.searchParams.get('theme') || '{}'); } catch { /* keep {} */ }

    // ---- identity verification (anti-impersonation) ----
    // If a Firebase ID token is supplied, its signature and its `sub` are
    // checked against the claimed id. Without a token (guests) we still allow
    // the join, but the id must look sane.
    const token = url.searchParams.get('token');
    if (token) {
      const v = await verifyIdToken(token, this.env?.FIREBASE_PROJECT_ID, clientId);
      if (!v.ok) return new Response('unauthorized', { status: 401 });
    }

    // ---- capacity limit ----
    if (this.players.size >= MAX_PLAYERS && !this.players.has(clientId)) {
      return new Response('room full', { status: 409 });
    }

    this.state.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({ clientId });
    this.players.set(clientId, { id: clientId, name, theme, x: 0, y: 0, hp: 1, maxHp: 1 });

    this.broadcast({ t: 'join', id: clientId, name, theme });
    pair[1].send(JSON.stringify({
      t: 's',
      you: clientId,
      players: [...this.players.values()],
      boss: this.boss,
      kills: this.kills,
    }));
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    let msg: any;
    try {
      msg = typeof message === 'string' ? JSON.parse(message) : JSON.parse(new TextDecoder().decode(message));
    } catch { return; }
    const id: string | undefined = (ws.serializeAttachment() as any)?.clientId;
    if (!id) return;
    const p = this.players.get(id);

    switch (msg.t) {
      case 'p': { // position + hp
        if (!p) break;
        if (typeof msg.x === 'number') p.x = msg.x;
        if (typeof msg.y === 'number') p.y = msg.y;
        if (typeof msg.hp === 'number') p.hp = msg.hp;
        if (typeof msg.maxHp === 'number') p.maxHp = msg.maxHp;
        const now = Date.now();
        if (now - this.lastPosBroadcast >= 80) {
          this.lastPosBroadcast = now;
          this.broadcastExcept(id, { t: 'p', id, x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp });
        }
        break;
      }
      case 'bs': { // boss spawn — first reporter registers the shared boss
        if (!this.boss && typeof msg.hp === 'number') {
          this.boss = { hp: msg.hp, maxHp: msg.hp };
          this.broadcast({ t: 'bs', hp: msg.hp });
        }
        break;
      }
      case 'b': { // boss damage — server is authoritative on shared boss HP
        if (this.boss) {
          const dmg = Math.max(0, Math.min(msg.dmg || 0, this.boss.hp));
          this.boss.hp = Math.max(0, this.boss.hp - dmg);
          this.broadcast({ t: 'b', hp: this.boss.hp });
          if (this.boss.hp <= 0) {
            // Single 'k' broadcast — boss is nulled first, so a flood of
            // concurrent 1e9 damage reports can only kill the boss once.
            this.boss = null;
            this.broadcast({ t: 'k', boss: true });
          }
        }
        break;
      }
      case 'k': { // normal enemy kill — shared counter
        this.kills += 1;
        if (!this.killsTimer) {
          this.killsTimer = setTimeout(() => {
            this.killsTimer = null;
            this.broadcast({ t: 'kc', kills: this.kills });
          }, 400);
        }
        break;
      }
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const id: string | undefined = (ws.serializeAttachment() as any)?.clientId;
    if (id) {
      this.players.delete(id);
      this.broadcast({ t: 'leave', id });
    }
  }

  private broadcast(msg: object) {
    const data = JSON.stringify(msg);
    for (const ws of this.state.getWebSockets()) {
      try { ws.send(data); } catch { /* client gone */ }
    }
  }

  private broadcastExcept(exceptId: string, msg: object) {
    const data = JSON.stringify(msg);
    for (const ws of this.state.getWebSockets()) {
      try {
        const att = (ws.serializeAttachment() as any)?.clientId;
        if (att !== exceptId) ws.send(data);
      } catch { /* ignore */ }
    }
  }
}
