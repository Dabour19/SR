import { useEffect, useRef, useState, useCallback } from 'react';
import { Coins, Volume2, VolumeX, HelpCircle } from 'lucide-react';
import type { LobbyState } from '../types';
import { getCharacter, CHARACTERS } from '../services/lobbyService';
import { drawHeroSprite } from '../game/characterSprite';
import { hubPresence, type HubPlayer } from '../services/hubPresence';
import { playerAuthService } from '../services/playerAuthService';
import {
  WORLD_W, WORLD_H, HORIZON_Y, BUILDINGS, FOUNTAIN, LAMPS, TREES, BENCHES, PLAYER_SPAWN, CITY_EDGE,
  type Building, type HubStationId,
  resolveMove, nearestBuilding, buildingAtPoint, doorStand, nightFactor, blocked,
  drawSky, drawSkyline, drawGround, drawFountain, drawTree, drawLamp, drawLampGlow, drawBench,
  drawBuilding, drawFireflies, drawBubble, drawNameTag,
} from '../game/cityScene';

export type { HubStationId } from '../game/cityScene';

interface LobbyHubProps {
  state: LobbyState;
  onStation: (id: HubStationId) => void;
  onOpenAuth: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  /** Pending friend requests → badge on the tavern. */
  pendingRequests?: number;
}

const SPEED = 190; // world px / second
const EMOTES = ['👋', '😂', '❤️', '😎', '⚔️', '🎉'];
const EMOTE_MS = 3000;

/* ---------- Townsfolk (NPCs) ---------- */
interface Npc {
  name: string;
  theme: (typeof CHARACTERS)[number]['theme'];
  x: number; y: number;
  tx: number; ty: number;
  waypoints: { x: number; y: number }[];
  wait: number;
  facingLeft: boolean;
  walk: number;
  tips: string[];
  tipIdx: number;
  tipTimer: number;
  speaking: boolean;
}

function makeNpcs(): Npc[] {
  const th = (id: (typeof CHARACTERS)[number]['id']) => getCharacter(id).theme;
  return [
    {
      name: 'الحارس', theme: th('paladin'),
      x: 520, y: 700, tx: 520, ty: 700,
      waypoints: [{ x: 520, y: 700 }, { x: 680, y: 700 }, { x: 600, y: 690 }],
      wait: 2, facingLeft: false, walk: 0, tipIdx: 0, tipTimer: 3, speaking: false,
      tips: ['البوابة تفتح على ساحة المعركة ⚔️', 'الهجوم تلقائي — ركّز على الحركة!', 'الزعماء يظهرون في أوقات محددة، كن مستعداً'],
    },
    {
      name: 'التاجرة', theme: th('mage'),
      x: 300, y: 470, tx: 300, ty: 470,
      waypoints: [{ x: 300, y: 470 }, { x: 380, y: 560 }, { x: 260, y: 580 }],
      wait: 4, facingLeft: true, walk: 0, tipIdx: 0, tipTimer: 6, speaking: false,
      tips: ['المتجر يبيع ترقيات دائمة 🪙', 'عملات مضاعفة = أرباح ×2 كل جولة!', 'الصناديق الخشبية أرخص طريقة لجمع الأبطال'],
    },
    {
      name: 'الحكيم', theme: th('wraith'),
      x: 880, y: 470, tx: 880, ty: 470,
      waypoints: [{ x: 880, y: 470 }, { x: 820, y: 580 }, { x: 940, y: 560 }],
      wait: 3, facingLeft: true, walk: 0, tipIdx: 0, tipTimer: 9, speaking: false,
      tips: ['كل بطل له سلاح بداية مختلف 🧙', 'أضف أصدقاءك في الحانة وشكّلوا فريقاً', 'برج الصدارة يعرض أفضل الناجين 🏆'],
    },
  ];
}

export function LobbyHub({ state, onStation, onOpenAuth, isMuted, onToggleMute, pendingRequests = 0 }: LobbyHubProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /** Player position is persisted so re-entering the hub restores the spot. */
  const posRef = useRef({ ...PLAYER_SPAWN });
  // Restore saved hub position once on mount (falls back to default spawn).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('hub_player_pos') || 'null');
      if (saved && typeof saved.x === 'number' && typeof saved.y === 'number' && !blocked(saved.x, saved.y)) {
        posRef.current = { x: saved.x, y: saved.y };
      }
    } catch { /* ignore */ }
    // Save position when leaving the hub (and periodically while inside).
    const save = () => {
      try { localStorage.setItem('hub_player_pos', JSON.stringify(posRef.current)); } catch { /* ignore */ }
    };
    const iv = window.setInterval(save, 3000);
    window.addEventListener('pagehide', save);
    return () => {
      window.clearInterval(iv);
      window.removeEventListener('pagehide', save);
      save();
    };
  }, []);
  const facingRef = useRef(false);
  const keys = useRef<Set<string>>(new Set());
  const walkCycle = useRef(0);
  const lastMoveTime = useRef(0);
  const raf = useRef(0);
  const joyVec = useRef({ dx: 0, dy: 0 });
  const target = useRef<{ x: number; y: number; station?: HubStationId } | null>(null);
  const camRef = useRef({ x: 0, y: 0, scale: 1 });
  const othersRef = useRef<HubPlayer[]>([]);
  const npcsRef = useRef<Npc[]>(makeNpcs());
  const myEmote = useRef<{ emoji: string; at: number } | null>(null);
  const pendingRef = useRef(pendingRequests);
  pendingRef.current = pendingRequests;
  const onStationRef = useRef(onStation);
  onStationRef.current = onStation;

  const [near, setNear] = useState<Building | null>(null);
  const [onlineCount, setOnlineCount] = useState(1);
  const [showEmotes, setShowEmotes] = useState(false);

  const theme = getCharacter(state.selectedCharacter).theme;
  const user = playerAuthService.getCurrentUser();

  const publishPresence = useCallback((p: { x: number; y: number }, isMoving: boolean, fl: boolean) => {
    const me = playerAuthService.getCurrentUser();
    hubPresence.update({
      id: me.id,
      name: me.username,
      characterId: state.selectedCharacter,
      theme: getCharacter(state.selectedCharacter).theme,
      x: p.x, y: p.y,
      facingLeft: fl,
      isMoving,
    });
  }, [state.selectedCharacter]);

  const sendEmote = useCallback((emoji: string) => {
    myEmote.current = { emoji, at: Date.now() };
    hubPresence.emote(emoji);
    setShowEmotes(false);
  }, []);

  const interact = useCallback(() => {
    const b = nearestBuilding(posRef.current.x, posRef.current.y);
    if (b) onStationRef.current(b.id);
  }, []);

  /** Remaining stops for the current auto-walk (e.g. city-gate waypoint). */
  const waypointQueue = useRef<Array<{ x: number; y: number; station?: HubStationId }>>([]);

  /** Walk to a building and open it on arrival (quick-travel / click).
   *  Wilderness buildings (dungeons) are behind the city wall, so route
   *  through the gate opening first instead of a straight line. */
  const travelTo = useCallback((id: HubStationId) => {
    const b = BUILDINGS.find((x) => x.id === id);
    if (!b) return;
    const d = doorStand(b);
    waypointQueue.current = [];
    if (b.x > CITY_EDGE) {
      waypointQueue.current.push({ x: CITY_EDGE + 70, y: 540 });
    }
    waypointQueue.current.push({ x: d.x, y: d.y, station: id });
    target.current = waypointQueue.current.shift()!;
  }, []);

  /* ---------- presence: other connected players ---------- */
  useEffect(() => {
    hubPresence.start();
    const me = playerAuthService.getCurrentUser();
    hubPresence.join({
      id: me.id,
      name: me.username,
      characterId: state.selectedCharacter,
      theme: getCharacter(state.selectedCharacter).theme,
      x: posRef.current.x, y: posRef.current.y,
      facingLeft: false,
      isMoving: false,
    });
    const unsub = hubPresence.subscribe(() => {
      othersRef.current = hubPresence.getOthers();
      setOnlineCount(othersRef.current.length + 1);
    });
    return () => {
      unsub();
      hubPresence.leave();
    };
  }, [state.selectedCharacter]);

  /* heartbeat keeps our doc fresh */
  useEffect(() => {
    const iv = window.setInterval(() => {
      publishPresence(posRef.current, performance.now() - lastMoveTime.current < 300, facingRef.current);
    }, 4000);
    return () => window.clearInterval(iv);
  }, [publishPresence]);

  /* keyboard */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'e' || e.key === 'E' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        interact();
        return;
      }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= EMOTES.length) { sendEmote(EMOTES[n - 1]); return; }
      keys.current.add(e.key);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key);
    const blur = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [interact, sendEmote]);

  /* tap-to-move / tap a building to walk there and open it */
  const moveTo = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cam = camRef.current;
    const wx = (e.clientX - rect.left) / cam.scale + cam.x;
    const wy = (e.clientY - rect.top) / cam.scale + cam.y;
    const b = buildingAtPoint(wx, wy);
    if (b) { travelTo(b.id); return; }
    target.current = { x: wx, y: Math.max(HORIZON_Y + 60, wy) };
  };

  /* main loop: input + physics + NPCs + camera + rendering */
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d')!;
    let alive = true;
    let last = performance.now();
    let lastNearId: string | null = null;
    const t0 = performance.now();

    const step = (dx: number, dy: number, dt: number) => {
      const len = Math.hypot(dx, dy) || 1;
      const p = posRef.current;
      const np = resolveMove(p.x, p.y, (dx / len) * SPEED * dt, (dy / len) * SPEED * dt);
      if (Math.abs(dx) > 0.05) facingRef.current = dx < 0;
      const moved = np.x !== p.x || np.y !== p.y;
      posRef.current = np;
      if (moved) {
        lastMoveTime.current = performance.now();
        walkCycle.current += dt * 11;
        publishPresence(posRef.current, true, facingRef.current);
      }
      return moved;
    };

    const updateNpcs = (dt: number) => {
      for (const n of npcsRef.current) {
        // speech
        n.tipTimer -= dt;
        if (n.tipTimer <= 0) {
          n.speaking = !n.speaking;
          if (n.speaking) { n.tipIdx = (n.tipIdx + 1) % n.tips.length; n.tipTimer = 3.5; }
          else n.tipTimer = 6 + Math.random() * 8;
        }
        // wander
        if (n.wait > 0) { n.wait -= dt; continue; }
        const dx = n.tx - n.x, dy = n.ty - n.y;
        const d = Math.hypot(dx, dy);
        if (d < 3) {
          n.wait = 2 + Math.random() * 4;
          const wp = n.waypoints[Math.floor(Math.random() * n.waypoints.length)];
          n.tx = wp.x + (Math.random() - 0.5) * 40;
          n.ty = wp.y + (Math.random() - 0.5) * 30;
          continue;
        }
        const sp = 55 * dt;
        n.x += (dx / d) * sp;
        n.y += (dy / d) * sp;
        n.facingLeft = dx < 0;
        n.walk += dt * 9;
      }
    };

    const loop = (t: number) => {
      if (!alive) return;
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const time = (t - t0) / 1000;

      // ---- input ----
      const k = keys.current;
      let dx = 0, dy = 0;
      if (k.has('ArrowLeft') || k.has('a') || k.has('A') || k.has('ش')) dx -= 1;
      if (k.has('ArrowRight') || k.has('d') || k.has('D') || k.has('ي')) dx += 1;
      if (k.has('ArrowUp') || k.has('w') || k.has('W') || k.has('ص')) dy -= 1;
      if (k.has('ArrowDown') || k.has('s') || k.has('S') || k.has('س')) dy += 1;
      if (dx || dy) { target.current = null; waypointQueue.current = []; step(dx, dy, dt); }
      else {
        const v = joyVec.current;
        if (v.dx || v.dy) { target.current = null; waypointQueue.current = []; step(v.dx, v.dy, dt); }
        else if (target.current) {
          const p = posRef.current;
          const tg = target.current;
          const tx = tg.x - p.x, ty = tg.y - p.y;
          const dist = Math.hypot(tx, ty);
          if (dist < 4) {
            if (tg.station) {
              target.current = null;
              waypointQueue.current = [];
              onStationRef.current(tg.station);
            } else {
              // waypoint reached: head to the next stop
              target.current = waypointQueue.current.shift() ?? null;
            }
          } else {
            const moved = step(tx, ty, dt);
            if (!moved) {
              // stuck on an obstacle: skip to next waypoint if any,
              // otherwise give up but still open the station if close enough
              const nxt = waypointQueue.current.shift();
              if (nxt) target.current = nxt;
              else {
                target.current = null;
                if (tg.station && dist < 120) onStationRef.current(tg.station);
              }
            }
          }
        }
      }

      updateNpcs(dt);

      // nearest building (state update only on change)
      const nb = nearestBuilding(posRef.current.x, posRef.current.y);
      const nbId = nb?.id ?? null;
      if (nbId !== lastNearId) { lastNearId = nbId; setNear(nb); }

      // ---- resize + camera ----
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      const vw = rect.width, vh = rect.height;
      const scale = Math.max(vw / WORLD_W, vh / WORLD_H, 0.55);
      const viewW = vw / scale, viewH = vh / scale;
      const cam = camRef.current;
      const targetCx = Math.max(0, Math.min(WORLD_W - viewW, posRef.current.x - viewW / 2));
      const targetCy = Math.max(0, Math.min(WORLD_H - viewH, posRef.current.y - viewH / 2));
      const lerp = 1 - Math.pow(0.001, dt);
      cam.x += (targetCx - cam.x) * lerp;
      cam.y += (targetCy - cam.y) * lerp;
      cam.scale = scale;

      const night = nightFactor(time);
      const now = Date.now();

      // ---- sky (screen space) ----
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawSky(ctx, vw, vh, night, time);

      // ---- world space ----
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, -cam.x * dpr * scale, -cam.y * dpr * scale);
      drawSkyline(ctx, night);
      drawGround(ctx, night);

      // Walk target marker
      if (target.current) {
        const tg = target.current;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2;
        const pr = 8 + Math.sin(time * 8) * 3;
        ctx.beginPath(); ctx.ellipse(tg.x, tg.y, pr, pr * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }

      // ---- y-sorted drawables ----
      type Drawable = { y: number; draw: () => void };
      const items: Drawable[] = [];
      const isMoving = performance.now() - lastMoveTime.current < 200;
      const me = posRef.current;

      for (const b of BUILDINGS) {
        items.push({
          y: b.y - 6,
          draw: () => drawBuilding(ctx, b, {
            t: time, night,
            highlighted: nbId === b.id,
            badge: b.id === 'friends' ? pendingRef.current : undefined,
          }),
        });
      }
      items.push({ y: FOUNTAIN.y + 20, draw: () => drawFountain(ctx, FOUNTAIN, time, night) });
      for (const tr of TREES) items.push({ y: tr.y, draw: () => drawTree(ctx, tr, time, night) });
      for (const l of LAMPS) items.push({ y: l.y, draw: () => drawLamp(ctx, l, night) });
      for (const bn of BENCHES) items.push({ y: bn.y, draw: () => drawBench(ctx, bn, night) });

      // NPCs
      for (const n of npcsRef.current) {
        items.push({
          y: n.y,
          draw: () => {
            ctx.save();
            ctx.translate(n.x, n.y);
            drawHeroSprite(ctx, { theme: n.theme, walkCycle: n.walk, time, facingLeft: n.facingLeft, isMoving: n.wait <= 0 }, 1.25);
            ctx.restore();
          },
        });
      }

      // other players
      for (const o of othersRef.current) {
        if (now - o.updatedAt > 20000) continue;
        const moving = now - o.updatedAt < 1500 && o.isMoving;
        items.push({
          y: o.y,
          draw: () => {
            ctx.save();
            ctx.translate(o.x, o.y);
            drawHeroSprite(ctx, { theme: o.theme, walkCycle: now / 100, time, facingLeft: o.facingLeft, isMoving: moving }, 1.35);
            ctx.restore();
          },
        });
      }

      // me
      items.push({
        y: me.y,
        draw: () => {
          ctx.save();
          ctx.translate(me.x, me.y);
          ctx.strokeStyle = theme.trim + '77';
          ctx.lineWidth = 1.8;
          ctx.setLineDash([4, 4]);
          ctx.lineDashOffset = -time * 20;
          ctx.shadowColor = theme.glow;
          ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.ellipse(0, 22, 30, 12, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
          drawHeroSprite(ctx, { theme, walkCycle: walkCycle.current, time, facingLeft: facingRef.current, isMoving }, 1.5);
          ctx.restore();
        },
      });

      items.sort((a, b) => a.y - b.y);
      for (const it of items) it.draw();

      // ---- night tint + light sources ----
      if (night > 0.02) {
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = `rgba(40,50,110,${night * 0.55})`;
        ctx.fillRect(0, HORIZON_Y, WORLD_W, WORLD_H - HORIZON_Y);
        ctx.globalCompositeOperation = 'lighter';
        for (const l of LAMPS) drawLampGlow(ctx, l, night);
        // gate + fountain glow
        const gate = BUILDINGS.find((b) => b.id === 'start')!;
        const gg = ctx.createRadialGradient(gate.x, gate.y - 60, 10, gate.x, gate.y - 60, 160);
        gg.addColorStop(0, `rgba(244,63,94,${0.25 * night})`); gg.addColorStop(1, 'rgba(244,63,94,0)');
        ctx.fillStyle = gg; ctx.fillRect(gate.x - 160, gate.y - 220, 320, 320);
        const fg = ctx.createRadialGradient(FOUNTAIN.x, FOUNTAIN.y, 5, FOUNTAIN.x, FOUNTAIN.y, 110);
        fg.addColorStop(0, `rgba(125,211,252,${0.25 * night})`); fg.addColorStop(1, 'rgba(125,211,252,0)');
        ctx.fillStyle = fg; ctx.fillRect(FOUNTAIN.x - 110, FOUNTAIN.y - 110, 220, 220);
        ctx.restore();
      }
      drawFireflies(ctx, time, night);

      // ---- overlays: name tags, emotes, NPC speech ----
      for (const n of npcsRef.current) {
        drawNameTag(ctx, n.x, n.y - 62, n.name, '#fde68a', false);
        if (n.speaking) drawBubble(ctx, n.x, n.y - 76, n.tips[n.tipIdx], '#fbbf24');
      }
      for (const o of othersRef.current) {
        if (now - o.updatedAt > 20000) continue;
        drawNameTag(ctx, o.x, o.y - 64, o.name, '#a5f3fc', false);
        if (o.emote && now - o.emoteAt < EMOTE_MS) drawBubble(ctx, o.x, o.y - 78, o.emote, '#fff', true);
      }
      drawNameTag(ctx, me.x, me.y - 70, user.username, theme.trim, true);
      const em = myEmote.current;
      if (em && now - em.at < EMOTE_MS) {
        const k2 = (now - em.at) / EMOTE_MS;
        const pop = k2 < 0.15 ? 0.6 + (k2 / 0.15) * 0.4 : 1;
        ctx.save();
        ctx.translate(me.x, me.y - 84);
        ctx.scale(pop, pop);
        ctx.globalAlpha = k2 > 0.8 ? 1 - (k2 - 0.8) / 0.2 : 1;
        drawBubble(ctx, 0, 0, em.emoji, '#fff', true);
        ctx.restore();
      }

      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(raf.current); };
  }, [theme, publishPresence, user.username]);

  /* joystick */
  const joyRef = useRef<HTMLDivElement>(null);
  const [joy, setJoy] = useState<{ active: boolean; dx: number; dy: number }>({ active: false, dx: 0, dy: 0 });

  const handleJoyStart = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handleJoyMove(e);
  };
  const handleJoyMove = (e: React.PointerEvent) => {
    const el = joyRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const max = rect.width / 2;
    const len = Math.hypot(dx, dy);
    if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
    setJoy({ active: true, dx, dy });
    joyVec.current = { dx: dx / max, dy: dy / max };
  };
  const handleJoyEnd = () => {
    setJoy({ active: false, dx: 0, dy: 0 });
    joyVec.current = { dx: 0, dy: 0 };
  };

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-[#0d1220] select-none">
      {/* city canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 140px rgba(0,0,0,0.55)' }} />

      {/* click-to-move layer */}
      <div className="absolute inset-0 cursor-pointer" onClick={moveTo} />

      {/* interaction button when near a building */}
      {near && (
        <button
          onClick={() => onStation(near.id)}
          className="absolute left-1/2 -translate-x-1/2 bottom-24 sm:bottom-28 z-30 flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm text-slate-900 shadow-lg animate-in fade-in slide-in-from-bottom-2 cursor-pointer"
          style={{ background: near.color, boxShadow: `0 0 28px ${near.color}88` }}
        >
          <span className="text-lg">{near.emoji}</span>
          {near.actionAr}
          <kbd className="hidden sm:inline ml-1 px-1.5 py-0.5 rounded bg-black/20 text-[10px] font-mono">E</kbd>
        </button>
      )}

      {/* HUD top-right: profile + coins + mute + help */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 sm:gap-2">
        <button
          onClick={onOpenAuth}
          title="الملف الشخصي"
          className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-[#0f172a]/85 border border-[#334155] hover:border-cyan-400/50 transition cursor-pointer"
        >
          <span className="text-lg">{getCharacter(state.selectedCharacter).emoji}</span>
          <span className="text-xs font-black text-white max-w-[90px] truncate">{user.username}</span>
        </button>
        <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-amber-500/20 border border-amber-400/50 pointer-events-none">
          <Coins className="w-4 h-4 text-amber-400" />
          <span className="font-mono font-black text-amber-300 text-sm">{state.coins.toLocaleString()}</span>
        </div>
        <button
          onClick={onToggleMute}
          title={isMuted ? 'تشغيل الصوت' : 'كتم الصوت'}
          className="p-2 rounded-xl bg-[#0f172a]/85 hover:bg-[#334155] border border-[#334155] transition cursor-pointer"
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
        </button>
        <button
          onClick={() => onStation('help')}
          title="كيف تلعب؟"
          className="p-2 rounded-xl bg-[#0f172a]/85 hover:bg-[#334155] border border-[#334155] text-cyan-300 transition cursor-pointer"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {/* HUD top-left: online counter */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0f172a]/85 border border-emerald-500/40 pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs font-bold text-emerald-300">{onlineCount} في المدينة</span>
      </div>

      {/* quick-travel bar */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex flex-wrap justify-center items-center gap-1 sm:gap-1.5 px-2 py-1.5 rounded-2xl bg-[#0f172a]/85 border border-[#334155] backdrop-blur-sm max-w-[calc(100vw-1rem)]">
        {BUILDINGS.filter((b) => b.kind !== 'dungeon').map((b) => (
          <button
            key={b.id}
            onClick={() => travelTo(b.id)}
            title={b.labelAr}
            className={`relative w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl text-lg sm:text-xl transition cursor-pointer hover:scale-110 ${b.kind === 'dungeon' ? 'ring-1 ring-amber-400/40 animate-pulse' : ''}`}
            style={{
              background: near?.id === b.id ? `${b.color}33` : 'transparent',
              border: `1px solid ${near?.id === b.id ? b.color : 'transparent'}`,
            }}
          >
            {b.emoji}
            {b.id === 'friends' && pendingRequests > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">
                {pendingRequests}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* emotes */}
      <div className="absolute bottom-20 sm:bottom-24 left-3 z-30 flex flex-col items-start gap-1.5">
        {showEmotes && (
          <div className="flex gap-1 p-1.5 rounded-2xl bg-[#0f172a]/90 border border-[#334155] animate-in fade-in zoom-in-95">
            {EMOTES.map((e, i) => (
              <button
                key={e}
                onClick={() => sendEmote(e)}
                title={`المفتاح ${i + 1}`}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-xl hover:bg-white/10 hover:scale-110 transition cursor-pointer"
              >
                {e}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setShowEmotes((v) => !v)}
          className="w-11 h-11 flex items-center justify-center rounded-full bg-[#0f172a]/85 border border-[#334155] hover:border-cyan-400/50 text-xl transition cursor-pointer"
          title="تعابير"
        >
          😊
        </button>
      </div>

      <div className="absolute bottom-16 sm:bottom-20 right-3 sm:right-40 z-10 hidden sm:block text-[10px] text-slate-400/80 bg-black/30 px-2 py-1 rounded-lg pointer-events-none">
        WASD / الأسهم للحركة • E للتفاعل • 1-6 تعابير • انقر على مبنى للمشي إليه
      </div>

      {/* virtual joystick */}
      <div
        ref={joyRef}
        onPointerDown={handleJoyStart}
        onPointerMove={(e) => joy.active && handleJoyMove(e)}
        onPointerUp={handleJoyEnd}
        onPointerCancel={handleJoyEnd}
        className="absolute bottom-20 sm:bottom-24 right-3 z-30 w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-white/5 border border-white/15 touch-none cursor-pointer"
      >
        <div
          className="absolute w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-cyan-400/70 border border-cyan-200/60"
          style={{
            left: '50%', top: '50%',
            transform: `translate(calc(-50% + ${joy.dx}px), calc(-50% + ${joy.dy}px))`,
          }}
        />
      </div>
    </div>
  );
}
