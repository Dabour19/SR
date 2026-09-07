/**
 * Lobby City Scene — a small pixel-art town rendered with Canvas 2D.
 * World coordinates are in "world px" (WORLD_W x WORLD_H) and the hub
 * component applies a camera transform (scale + translate) before drawing.
 *
 * Every building corresponds to a lobby station (shop, characters, ...).
 */

export const WORLD_W = 2000;
export const WORLD_H = 800;
/** Everything above this y is sky / distant skyline. */
export const HORIZON_Y = 170;

export type HubStationId =
  | 'shop'
  | 'characters'
  | 'crates'
  | 'friends'
  | 'leaderboard'
  | 'profile'
  | 'help'
  | 'start'
  | 'dungeon1'
  | 'dungeon2'
  | 'dungeon3';

export type BuildingKind = 'house' | 'tower' | 'gate' | 'board' | 'kiosk' | 'dungeon';

/** Outside the city (x > CITY_EDGE) lies the open wilderness with dungeon gates. */
export const CITY_EDGE = 1240;

/** Dungeon difficulty (multiplier) per station id. */
export const DUNGEON_DIFFICULTY: Partial<Record<HubStationId, number>> = {
  dungeon1: 1,
  dungeon2: 2,
  dungeon3: 3,
};

export interface Building {
  id: HubStationId;
  labelAr: string;
  actionAr: string;
  emoji: string;
  color: string;
  kind: BuildingKind;
  /** World position of the door (player interaction point, on the ground). */
  x: number;
  y: number;
  /** Footprint (collision box) — centered on x, bottom edge = y. */
  w: number;
  h: number;
  /** Visual wall height above the footprint. */
  wallH: number;
  /** Interaction radius (world px) from the door. */
  range: number;
}

export interface Fountain { x: number; y: number; r: number }
export interface Lamp { x: number; y: number }
export interface Tree { x: number; y: number; s: number }
export interface Bench { x: number; y: number }

export const FOUNTAIN: Fountain = { x: 600, y: 520, r: 52 };

export const BUILDINGS: Building[] = [
  { id: 'shop', labelAr: 'المتجر', actionAr: 'فتح المتجر', emoji: '🏪', color: '#22d3ee', kind: 'house', x: 200, y: 400, w: 190, h: 70, wallH: 130, range: 70 },
  { id: 'characters', labelAr: 'منزل الأبطال', actionAr: 'تغيير الشخصية', emoji: '🏠', color: '#a78bfa', kind: 'house', x: 1000, y: 400, w: 190, h: 70, wallH: 130, range: 70 },
  { id: 'crates', labelAr: 'مستودع الصناديق', actionAr: 'فتح الصناديق', emoji: '📦', color: '#f472b6', kind: 'house', x: 200, y: 660, w: 170, h: 60, wallH: 105, range: 70 },
  { id: 'friends', labelAr: 'حانة الرفاق', actionAr: 'الأصدقاء والفريق', emoji: '🍻', color: '#34d399', kind: 'house', x: 1000, y: 660, w: 170, h: 60, wallH: 105, range: 70 },
  { id: 'leaderboard', labelAr: 'برج الصدارة', actionAr: 'لوحة الصدارة', emoji: '🏆', color: '#fbbf24', kind: 'tower', x: 600, y: 300, w: 130, h: 60, wallH: 210, range: 70 },
  { id: 'profile', labelAr: 'الملف الشخصي', actionAr: 'حسابي', emoji: '🪪', color: '#60a5fa', kind: 'kiosk', x: 400, y: 320, w: 70, h: 36, wallH: 56, range: 55 },
  { id: 'help', labelAr: 'لوحة الإعلانات', actionAr: 'كيف تلعب؟', emoji: '📜', color: '#fb923c', kind: 'board', x: 800, y: 320, w: 80, h: 22, wallH: 62, range: 55 },
  { id: 'start', labelAr: 'بوابة المعركة', actionAr: '⚔️ ابدأ المعركة', emoji: '⚔️', color: '#f43f5e', kind: 'gate', x: 600, y: 752, w: 220, h: 30, wallH: 120, range: 80 },
  /* --- Wilderness (outside the city walls): dungeon gates --- */
  { id: 'dungeon1', labelAr: 'دنجن السهول (مبتدئ)', actionAr: '🌿 ادخل الدنجن (المستوى 1)', emoji: '🌿', color: '#a3e635', kind: 'dungeon', x: 1420, y: 420, w: 150, h: 56, wallH: 100, range: 78 },
  { id: 'dungeon2', labelAr: 'مقبرة الرماد (متوسط)', actionAr: '💀 ادخل الدنجن (المستوى 2)', emoji: '💀', color: '#a78bfa', kind: 'dungeon', x: 1700, y: 660, w: 160, h: 58, wallH: 110, range: 78 },
  { id: 'dungeon3', labelAr: 'هاوية الجحيم (أسطوري)', actionAr: '🔥 ادخل الدنجن (المستوى 3)', emoji: '🔥', color: '#f97316', kind: 'dungeon', x: 1840, y: 300, w: 170, h: 60, wallH: 120, range: 78 },
];

export const LAMPS: Lamp[] = [
  { x: 470, y: 430 }, { x: 730, y: 430 },
  { x: 470, y: 620 }, { x: 730, y: 620 },
  { x: 330, y: 540 }, { x: 870, y: 540 },
];

export const TREES: Tree[] = [
  { x: 70, y: 300, s: 1.1 }, { x: 1130, y: 300, s: 1.1 },
  { x: 60, y: 520, s: 0.9 }, { x: 1140, y: 520, s: 0.9 },
  { x: 90, y: 770, s: 1 }, { x: 1110, y: 770, s: 1 },
  { x: 330, y: 250, s: 0.8 }, { x: 870, y: 250, s: 0.8 },
  { x: 440, y: 760, s: 0.85 }, { x: 760, y: 760, s: 0.85 },
  /* wilderness trees & dead wood */
  { x: 1330, y: 300, s: 1.2 }, { x: 1560, y: 560, s: 1.1 }, { x: 1930, y: 470, s: 1.3 },
  { x: 1480, y: 740, s: 1 }, { x: 1900, y: 640, s: 1.15 }, { x: 1650, y: 260, s: 0.9 },
];

/** Dead wilderness trees get a spooky look. */
export function isWilderness(x: number): boolean {
  return x > CITY_EDGE;
}

export const BENCHES: Bench[] = [
  { x: 520, y: 590 }, { x: 680, y: 590 },
];

export const PLAYER_SPAWN = { x: 600, y: 610 };

export function getBuilding(id: HubStationId): Building {
  return BUILDINGS.find((b) => b.id === id) || BUILDINGS[0];
}

/** Rect used for player collision (feet point). */
export function buildingRect(b: Building) {
  if (b.kind === 'gate') {
    // Only the two pillars block movement
    return null;
  }
  return { x: b.x - b.w / 2, y: b.y - b.h, w: b.w, h: b.h };
}

export function gatePillarRects(b: Building) {
  const pw = 34;
  return [
    { x: b.x - b.w / 2, y: b.y - b.h, w: pw, h: b.h },
    { x: b.x + b.w / 2 - pw, y: b.y - b.h, w: pw, h: b.h },
  ];
}

/* ==================== COLLISION ==================== */

interface Rect { x: number; y: number; w: number; h: number }

function collectSolids(): Rect[] {
  const solids: Rect[] = [];
  for (const b of BUILDINGS) {
    const r = buildingRect(b);
    if (r) solids.push(r);
    else solids.push(...gatePillarRects(b));
  }
  for (const t of TREES) solids.push({ x: t.x - 10 * t.s, y: t.y - 10, w: 20 * t.s, h: 12 });
  for (const l of LAMPS) solids.push({ x: l.x - 5, y: l.y - 6, w: 10, h: 8 });
  for (const bn of BENCHES) solids.push({ x: bn.x - 22, y: bn.y - 8, w: 44, h: 10 });
  // City wall at the wilderness border (leaves the road opening at y 470-610)
  solids.push({ x: CITY_EDGE - 12, y: HORIZON_Y + 14, w: 24, h: 456 - HORIZON_Y - 14 });
  solids.push({ x: CITY_EDGE - 12, y: 624, w: 24, h: WORLD_H - 624 });
  return solids;
}

const SOLIDS = collectSolids();

function pointInRect(px: number, py: number, r: Rect) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

/**
 * Attempt to move from (x,y) by (dx,dy); slides along walls.
 * Returns the resolved position, clamped to the walkable world.
 */
export function resolveMove(x: number, y: number, dx: number, dy: number) {
  const minY = HORIZON_Y + 60;
  let nx = Math.max(24, Math.min(WORLD_W - 24, x + dx));
  let ny = y;
  if (blocked(nx, ny)) nx = x;
  ny = Math.max(minY, Math.min(WORLD_H - 14, y + dy));
  if (blocked(nx, ny)) ny = y;
  return { x: nx, y: ny };
}

export function blocked(px: number, py: number): boolean {
  for (const r of SOLIDS) if (pointInRect(px, py, r)) return true;
  const fd = Math.hypot(px - FOUNTAIN.x, (py - FOUNTAIN.y) * 1.6);
  return fd < FOUNTAIN.r + 6;
}

/** Which building (if any) is close enough to interact with. */
export function nearestBuilding(px: number, py: number): Building | null {
  let best: Building | null = null;
  let bestD = Infinity;
  for (const b of BUILDINGS) {
    const d = Math.hypot(b.x - px, (b.y + 18 - py) * 1.1);
    if (d < bestD && d <= b.range) { bestD = d; best = b; }
  }
  return best;
}

/** Hit-test a world point against a building's drawn body (walls + roof). */
export function buildingAtPoint(px: number, py: number): Building | null {
  for (const b of BUILDINGS) {
    const top = b.y - b.h - b.wallH - (b.kind === 'house' ? 60 : b.kind === 'tower' ? 50 : 10);
    if (px >= b.x - b.w / 2 - 8 && px <= b.x + b.w / 2 + 8 && py >= top && py <= b.y + 4) return b;
  }
  return null;
}

/** Point in front of the door where the player should stop when auto-walking. */
export function doorStand(b: Building) {
  return { x: b.x, y: b.y + 26 };
}

/* ==================== DRAW HELPERS ==================== */

export function lerpColor(a: string, b: string, t: number): string {
  const pa = hex(a), pb = hex(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

function hex(c: string): [number, number, number] {
  const h = c.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** 0 = full day, 1 = full night. Cycle length 4 minutes. */
export function nightFactor(timeSec: number): number {
  const phase = (timeSec % 240) / 240;
  return 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
}

/* ==================== SKY (screen space) ==================== */

const STARS = Array.from({ length: 90 }, (_, i) => ({
  x: ((i * 7919) % 1000) / 1000,
  y: ((i * 104729) % 1000) / 1000,
  s: 0.6 + ((i * 31) % 10) / 10,
}));

export function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, night: number, t: number) {
  const top = lerpColor('#5eb7f0', '#050816', night);
  const mid = lerpColor('#a9dcf7', '#101a3a', night);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(1, mid);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // stars
  if (night > 0.15) {
    ctx.save();
    ctx.globalAlpha = (night - 0.15) / 0.85;
    ctx.fillStyle = '#ffffff';
    for (const s of STARS) {
      const tw = 0.6 + 0.4 * Math.sin(t * 2 + s.x * 40);
      ctx.globalAlpha = ((night - 0.15) / 0.85) * tw;
      ctx.fillRect(s.x * w, s.y * h * 0.6, s.s, s.s);
    }
    ctx.restore();
  }

  // sun / moon along an arc
  const phase = (t % 240) / 240;
  const ang = phase * Math.PI * 2;
  const cx = w * 0.5 + Math.cos(ang - Math.PI / 2) * w * 0.42;
  const cy = h * 0.35 - Math.sin(ang - Math.PI / 2) * h * 0.28;
  ctx.save();
  if (night < 0.5) {
    ctx.shadowColor = '#fff7ae';
    ctx.shadowBlur = 40;
    ctx.fillStyle = '#fff3b0';
    ctx.globalAlpha = 1 - night * 2;
    ctx.beginPath(); ctx.arc(cx, cy, 26, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.shadowColor = '#c7d2fe';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#e0e7ff';
    ctx.globalAlpha = (night - 0.5) * 2;
    ctx.beginPath(); ctx.arc(w - cx, cy, 20, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = lerpColor('#101a3a', '#050816', night);
    ctx.beginPath(); ctx.arc(w - cx + 8, cy - 5, 16, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // drifting clouds
  ctx.save();
  ctx.globalAlpha = 0.35 * (1 - night * 0.6);
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 5; i++) {
    const cxs = ((t * (6 + i * 2) + i * 260) % (w + 300)) - 150;
    const cys = 30 + i * 22;
    cloud(ctx, cxs, cys, 1 + (i % 3) * 0.3);
  }
  ctx.restore();
}

function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.arc(x, y, 18 * s, 0, Math.PI * 2);
  ctx.arc(x + 20 * s, y - 8 * s, 22 * s, 0, Math.PI * 2);
  ctx.arc(x + 45 * s, y, 18 * s, 0, Math.PI * 2);
  ctx.arc(x + 22 * s, y + 8 * s, 16 * s, 0, Math.PI * 2);
  ctx.fill();
}

/* ==================== GROUND (world space) ==================== */

export function drawSkyline(ctx: CanvasRenderingContext2D, night: number) {
  // distant mountains + city silhouette behind the horizon
  ctx.save();
  ctx.fillStyle = lerpColor('#7fb0cf', '#0b1230', night);
  ctx.beginPath();
  ctx.moveTo(0, HORIZON_Y);
  const peaks: number[] = [];
  for (let i = 0; i <= Math.ceil(WORLD_W / 130); i++) peaks.push(i * 130);
  peaks.forEach((px, i) => {
    const ph = 40 + ((i * 37) % 60);
    ctx.lineTo(px - 60, HORIZON_Y);
    ctx.lineTo(px, HORIZON_Y - ph);
  });
  ctx.lineTo(WORLD_W, HORIZON_Y);
  ctx.closePath();
  ctx.fill();

  // far towers
  ctx.fillStyle = lerpColor('#5f8fb0', '#070c22', night);
  for (let i = 0; i < 24; i++) {
    const bx = i * 52 + ((i * 13) % 20);
    const bh = 20 + ((i * 29) % 45);
    ctx.fillRect(bx, HORIZON_Y - bh, 26 + (i % 3) * 8, bh);
    if (night > 0.4) {
      ctx.save();
      ctx.fillStyle = `rgba(253,224,71,${(night - 0.4) * 0.9})`;
      for (let k = 0; k < 3; k++) if ((i + k) % 2 === 0) ctx.fillRect(bx + 5 + k * 8, HORIZON_Y - bh + 6 + (k % 2) * 10, 3, 3);
      ctx.restore();
    }
  }
  ctx.restore();
}

export function drawGround(ctx: CanvasRenderingContext2D, night: number) {
  const grass = lerpColor('#3f8a3f', '#12301c', night);
  const grassDark = lerpColor('#357a35', '#0e2616', night);
  ctx.fillStyle = grass;
  ctx.fillRect(0, HORIZON_Y, WORLD_W, WORLD_H - HORIZON_Y);

  // subtle grass tufts
  ctx.fillStyle = grassDark;
  for (let i = 0; i < 160; i++) {
    const gx = (i * 977) % WORLD_W;
    const gy = HORIZON_Y + 10 + ((i * 613) % (WORLD_H - HORIZON_Y - 20));
    ctx.fillRect(gx, gy, 6, 2);
    ctx.fillRect(gx + 2, gy - 2, 2, 2);
  }

  // horizon fence / hedge
  ctx.fillStyle = lerpColor('#2f6b2f', '#0b1f12', night);
  ctx.fillRect(0, HORIZON_Y, WORLD_W, 14);

  // Wilderness (x > CITY_EDGE): darker cursed ground + rocky patches
  ctx.save();
  ctx.fillStyle = lerpColor('rgba(24,28,42,0.35)', 'rgba(4,6,14,0.5)', night);
  ctx.fillRect(CITY_EDGE, HORIZON_Y, WORLD_W - CITY_EDGE, WORLD_H - HORIZON_Y);
  ctx.fillStyle = lerpColor('rgba(40,44,60,0.5)', 'rgba(8,10,20,0.6)', night);
  for (let i = 0; i < 40; i++) {
    const rx = CITY_EDGE + 40 + ((i * 761) % (WORLD_W - CITY_EDGE - 80));
    const ry = HORIZON_Y + 60 + ((i * 389) % (WORLD_H - HORIZON_Y - 100));
    ctx.beginPath(); ctx.ellipse(rx, ry, 10 + (i % 4) * 6, 4 + (i % 3) * 2, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // City wall separating town from the wilderness (with an opening as the road)
  drawCityWall(ctx, night);

  // paths from fountain to each building
  const path = lerpColor('#c9b38a', '#4d4636', night);
  const pathEdge = lerpColor('#a58f68', '#38321f', night);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const roads: [number, number, number, number][] = BUILDINGS.map((b) => [FOUNTAIN.x, FOUNTAIN.y, b.x, b.y + 16]);
  for (const [x1, y1, x2, y2] of roads) {
    ctx.strokeStyle = pathEdge; ctx.lineWidth = 46;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo((x1 + x2) / 2, y2, x2, y2); ctx.stroke();
  }
  for (const [x1, y1, x2, y2] of roads) {
    ctx.strokeStyle = path; ctx.lineWidth = 38;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo((x1 + x2) / 2, y2, x2, y2); ctx.stroke();
  }

  // central cobblestone plaza
  ctx.save();
  ctx.translate(FOUNTAIN.x, FOUNTAIN.y);
  ctx.scale(1, 0.62);
  ctx.fillStyle = pathEdge;
  ctx.beginPath(); ctx.arc(0, 0, 215, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = lerpColor('#d6c3a0', '#554d3c', night);
  ctx.beginPath(); ctx.arc(0, 0, 200, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1;
  for (let r = 40; r < 200; r += 40) { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); }
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 200, Math.sin(a) * 200); ctx.stroke();
  }
  ctx.restore();
}

/** Stone wall at the city edge with an arched opening at y 470-610. */
function drawCityWall(ctx: CanvasRenderingContext2D, night: number) {
  const stone = lerpColor('#8d97a8', '#222a3a', night);
  const stoneDark = lerpColor('#5b6575', '#151b28', night);
  const segs: [number, number][] = [
    [HORIZON_Y + 14, 456], // top segment
    [624, WORLD_H],        // bottom segment
  ];
  for (const [y0, y1] of segs) {
    ctx.fillStyle = stoneDark;
    ctx.fillRect(CITY_EDGE - 14, y0, 22, y1 - y0);
    ctx.fillStyle = stone;
    ctx.fillRect(CITY_EDGE - 10, y0, 14, y1 - y0);
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    for (let y = y0 + 16; y < y1; y += 18) {
      ctx.beginPath(); ctx.moveTo(CITY_EDGE - 10, y); ctx.lineTo(CITY_EDGE + 4, y); ctx.stroke();
    }
    // crenellations
    ctx.fillStyle = stoneDark;
    for (let y = y0; y < y1; y += 26) ctx.fillRect(CITY_EDGE - 18, y, 8, 14);
  }
  // opening arch lintel
  ctx.fillStyle = stoneDark;
  ctx.fillRect(CITY_EDGE - 16, 456, 26, 14);
  ctx.fillRect(CITY_EDGE - 16, 610, 26, 14);
}

/* ==================== PROPS ==================== */

export function drawFountain(ctx: CanvasRenderingContext2D, f: Fountain, t: number, night: number) {
  ctx.save();
  ctx.translate(f.x, f.y);
  // basin
  ctx.scale(1, 0.62);
  ctx.fillStyle = lerpColor('#8f9bb0', '#3a4256', night);
  ctx.beginPath(); ctx.arc(0, 0, f.r + 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = lerpColor('#c7d2e6', '#5b667f', night);
  ctx.beginPath(); ctx.arc(0, 0, f.r, 0, Math.PI * 2); ctx.fill();
  // water
  const wg = ctx.createRadialGradient(0, 0, 4, 0, 0, f.r - 6);
  wg.addColorStop(0, '#7dd3fc');
  wg.addColorStop(1, '#0284c7');
  ctx.fillStyle = wg;
  ctx.beginPath(); ctx.arc(0, 0, f.r - 6, 0, Math.PI * 2); ctx.fill();
  // ripples
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const rr2 = ((t * 18 + i * 15) % (f.r - 8)) + 4;
    ctx.globalAlpha = 1 - rr2 / (f.r - 4);
    ctx.beginPath(); ctx.arc(0, 0, rr2, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // pedestal + water jet (unscaled)
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.fillStyle = lerpColor('#a5b1c7', '#465068', night);
  rr(ctx, -10, -30, 20, 30, 4); ctx.fill();
  ctx.fillStyle = lerpColor('#c7d2e6', '#5b667f', night);
  ctx.beginPath(); ctx.ellipse(0, -30, 18, 6, 0, 0, Math.PI * 2); ctx.fill();
  // jet
  ctx.strokeStyle = 'rgba(186,230,253,0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, -32); ctx.quadraticCurveTo(0, -70, 0, -62 + Math.sin(t * 6) * 3); ctx.stroke();
  // droplets
  ctx.fillStyle = 'rgba(224,242,254,0.95)';
  for (let i = 0; i < 10; i++) {
    const ph = (t * 1.4 + i / 10) % 1;
    const ang = (i / 10) * Math.PI * 2;
    const dx = Math.cos(ang) * ph * 34;
    const dy = -62 + ph * ph * 60 - Math.sin(ph * Math.PI) * 20;
    ctx.globalAlpha = 1 - ph;
    ctx.beginPath(); ctx.arc(dx, dy, 2.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function drawTree(ctx: CanvasRenderingContext2D, tr: Tree, t: number, night: number) {
  ctx.save();
  ctx.translate(tr.x, tr.y);
  ctx.scale(tr.s, tr.s);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 2, 22, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = lerpColor('#6b4423', '#2a1a0d', night);
  ctx.fillRect(-6, -34, 12, 36);
  const sway = Math.sin(t * 1.3 + tr.x) * 2;
  const leaf = lerpColor('#2f8f3a', '#143a1c', night);
  const leafHi = lerpColor('#4fb35a', '#1e5a2a', night);
  ctx.fillStyle = leaf;
  ctx.beginPath(); ctx.arc(sway, -60, 30, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(sway - 20, -45, 22, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(sway + 20, -45, 22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = leafHi;
  ctx.beginPath(); ctx.arc(sway - 6, -68, 14, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawLamp(ctx: CanvasRenderingContext2D, l: Lamp, night: number) {
  ctx.save();
  ctx.translate(l.x, l.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 1, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = lerpColor('#334155', '#0f172a', night);
  ctx.fillRect(-3, -70, 6, 70);
  rr(ctx, -7, -2, 14, 4, 2); ctx.fill();
  ctx.fillStyle = lerpColor('#475569', '#1e293b', night);
  rr(ctx, -9, -86, 18, 18, 3); ctx.fill();
  ctx.fillStyle = night > 0.3 ? '#fde68a' : '#e2e8f0';
  rr(ctx, -6, -83, 12, 12, 2); ctx.fill();
  ctx.restore();
}

export function drawLampGlow(ctx: CanvasRenderingContext2D, l: Lamp, night: number) {
  if (night < 0.3) return;
  const a = (night - 0.3) / 0.7;
  const g = ctx.createRadialGradient(l.x, l.y - 78, 4, l.x, l.y - 78, 110);
  g.addColorStop(0, `rgba(253,224,71,${0.55 * a})`);
  g.addColorStop(1, 'rgba(253,224,71,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(l.x, l.y - 78, 110, 0, Math.PI * 2); ctx.fill();
}

export function drawBench(ctx: CanvasRenderingContext2D, b: Bench, night: number) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, 0, 24, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = lerpColor('#7c4a1e', '#2f1c0b', night);
  ctx.fillRect(-18, -10, 4, 10); ctx.fillRect(14, -10, 4, 10);
  ctx.fillStyle = lerpColor('#b06a2c', '#4a2c11', night);
  rr(ctx, -22, -14, 44, 6, 2); ctx.fill();
  rr(ctx, -22, -24, 44, 5, 2); ctx.fill();
  ctx.restore();
}

/* ==================== BUILDINGS ==================== */

export interface BuildingDrawOpts {
  t: number;
  night: number;
  highlighted: boolean;
  /** Optional numeric badge (e.g. pending friend requests). */
  badge?: number;
}

export function drawBuilding(ctx: CanvasRenderingContext2D, b: Building, o: BuildingDrawOpts) {
  ctx.save();
  ctx.translate(b.x, b.y);
  // ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(0, 0, b.w / 2 + 10, 12, 0, 0, Math.PI * 2); ctx.fill();

  switch (b.kind) {
    case 'house': drawHouse(ctx, b, o); break;
    case 'tower': drawTower(ctx, b, o); break;
    case 'gate': drawGate(ctx, b, o); break;
    case 'board': drawBoard(ctx, b, o); break;
    case 'kiosk': drawKiosk(ctx, b, o); break;
    case 'dungeon': drawDungeon(ctx, b, o); break;
  }
  ctx.restore();
}

function wallColors(b: Building, night: number) {
  return {
    wall: lerpColor('#e7d6bd', '#4a4032', night),
    wallDark: lerpColor('#c9b596', '#332b21', night),
    roof: lerpColor(b.color, '#111827', night * 0.55),
    roofDark: lerpColor(shade(b.color), '#0b1020', night * 0.55),
    wood: lerpColor('#7c4a1e', '#2f1c0b', night),
    window: night > 0.35 ? '#fde68a' : '#93c5fd',
  };
}

function shade(hexColor: string): string {
  const [r, g, b] = hex(hexColor);
  return `#${[r, g, b].map((v) => Math.max(0, Math.round(v * 0.7)).toString(16).padStart(2, '0')).join('')}`;
}

function drawHouse(ctx: CanvasRenderingContext2D, b: Building, o: BuildingDrawOpts) {
  const c = wallColors(b, o.night);
  const hw = b.w / 2;
  const top = -b.h - b.wallH;

  // side depth face
  ctx.fillStyle = c.wallDark;
  ctx.fillRect(-hw, top, b.w, b.wallH + b.h);
  // front wall
  ctx.fillStyle = c.wall;
  ctx.fillRect(-hw + 6, top + 6, b.w - 12, b.wallH + b.h - 6);
  // planks
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1;
  for (let y = top + 20; y < 0; y += 16) { ctx.beginPath(); ctx.moveTo(-hw + 6, y); ctx.lineTo(hw - 6, y); ctx.stroke(); }

  // roof
  ctx.fillStyle = c.roofDark;
  ctx.beginPath();
  ctx.moveTo(-hw - 16, top + 6);
  ctx.lineTo(0, top - 58);
  ctx.lineTo(hw + 16, top + 6);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = c.roof;
  ctx.beginPath();
  ctx.moveTo(-hw - 8, top + 2);
  ctx.lineTo(0, top - 50);
  ctx.lineTo(hw + 8, top + 2);
  ctx.closePath(); ctx.fill();
  // roof tiles
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  for (let i = 1; i < 5; i++) {
    const yy = top - 50 + i * 10.4;
    const half = (i / 5) * (hw + 8);
    ctx.beginPath(); ctx.moveTo(-half, yy); ctx.lineTo(half, yy); ctx.stroke();
  }

  // chimney + smoke
  ctx.fillStyle = c.wallDark;
  ctx.fillRect(hw - 40, top - 40, 16, 40);
  ctx.save();
  ctx.fillStyle = 'rgba(226,232,240,0.5)';
  for (let i = 0; i < 4; i++) {
    const ph = (o.t * 0.35 + i * 0.25) % 1;
    ctx.globalAlpha = (1 - ph) * 0.6;
    ctx.beginPath(); ctx.arc(hw - 32 + Math.sin(ph * 6 + i) * 6, top - 44 - ph * 50, 4 + ph * 8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // windows
  ctx.save();
  ctx.fillStyle = c.window;
  ctx.shadowColor = c.window;
  ctx.shadowBlur = o.night > 0.35 ? 14 : 0;
  const wy = top + 34;
  [-hw + 26, hw - 50].forEach((wx) => {
    rr(ctx, wx, wy, 24, 26, 3); ctx.fill();
  });
  ctx.restore();
  ctx.strokeStyle = c.wood;
  ctx.lineWidth = 2;
  [-hw + 26, hw - 50].forEach((wx) => {
    ctx.strokeRect(wx, wy, 24, 26);
    ctx.beginPath(); ctx.moveTo(wx + 12, wy); ctx.lineTo(wx + 12, wy + 26); ctx.moveTo(wx, wy + 13); ctx.lineTo(wx + 24, wy + 13); ctx.stroke();
  });

  // door
  ctx.fillStyle = c.wood;
  rr(ctx, -18, -b.h - 48 + b.h, 36, 48, 8); ctx.fill();
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath(); ctx.arc(10, -22, 2.5, 0, Math.PI * 2); ctx.fill();
  // step
  ctx.fillStyle = c.wallDark;
  rr(ctx, -24, -4, 48, 6, 2); ctx.fill();

  drawSign(ctx, b, top + 8, o);
}

function drawTower(ctx: CanvasRenderingContext2D, b: Building, o: BuildingDrawOpts) {
  const c = wallColors(b, o.night);
  const hw = b.w / 2;
  const top = -b.h - b.wallH;
  const stone = lerpColor('#94a3b8', '#2b3445', o.night);
  const stoneDark = lerpColor('#64748b', '#1c2331', o.night);

  ctx.fillStyle = stoneDark;
  ctx.fillRect(-hw, top, b.w, b.wallH + b.h);
  ctx.fillStyle = stone;
  ctx.fillRect(-hw + 8, top + 8, b.w - 16, b.wallH + b.h - 8);
  // bricks
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  for (let y = top + 24; y < 0; y += 18) {
    ctx.beginPath(); ctx.moveTo(-hw + 8, y); ctx.lineTo(hw - 8, y); ctx.stroke();
    for (let x = -hw + 8 + ((y / 18) % 2 ? 0 : 14); x < hw - 8; x += 28) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 18); ctx.stroke();
    }
  }
  // battlements
  ctx.fillStyle = stoneDark;
  for (let x = -hw - 6; x < hw + 6; x += 22) ctx.fillRect(x, top - 18, 14, 22);
  // spire
  ctx.fillStyle = c.roofDark;
  ctx.beginPath(); ctx.moveTo(-hw * 0.6, top - 16); ctx.lineTo(0, top - 66); ctx.lineTo(hw * 0.6, top - 16); ctx.closePath(); ctx.fill();
  ctx.fillStyle = c.roof;
  ctx.beginPath(); ctx.moveTo(-hw * 0.5, top - 18); ctx.lineTo(0, top - 60); ctx.lineTo(hw * 0.5, top - 18); ctx.closePath(); ctx.fill();
  // flag
  const wave = Math.sin(o.t * 5) * 4;
  ctx.fillStyle = '#334155';
  ctx.fillRect(-1, top - 92, 2, 34);
  ctx.fillStyle = b.color;
  ctx.beginPath(); ctx.moveTo(1, top - 92); ctx.lineTo(22 + wave, top - 84); ctx.lineTo(1, top - 76); ctx.closePath(); ctx.fill();
  // arched windows (glowing)
  ctx.save();
  ctx.fillStyle = c.window;
  ctx.shadowColor = c.window;
  ctx.shadowBlur = o.night > 0.35 ? 14 : 0;
  for (let i = 0; i < 3; i++) {
    const wy = top + 30 + i * 46;
    ctx.beginPath(); ctx.moveTo(-9, wy + 22); ctx.lineTo(-9, wy + 8); ctx.arc(0, wy + 8, 9, Math.PI, 0); ctx.lineTo(9, wy + 22); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // door
  ctx.fillStyle = c.wood;
  ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-18, -34); ctx.arc(0, -34, 18, Math.PI, 0); ctx.lineTo(18, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = stoneDark;
  rr(ctx, -26, -4, 52, 6, 2); ctx.fill();

  drawSign(ctx, b, top + 4, o);
}

function drawGate(ctx: CanvasRenderingContext2D, b: Building, o: BuildingDrawOpts) {
  const hw = b.w / 2;
  const top = -b.h - b.wallH;
  const stone = lerpColor('#7c8798', '#242b3a', o.night);
  const stoneDark = lerpColor('#4b5563', '#141a26', o.night);
  const pw = 34;

  // portal glow (always visible – it is the "play" call to action)
  const pulse = 0.75 + Math.sin(o.t * 3) * 0.25;
  ctx.save();
  const g = ctx.createLinearGradient(0, top + 30, 0, 0);
  g.addColorStop(0, `rgba(244,63,94,${0.15 * pulse})`);
  g.addColorStop(1, `rgba(244,63,94,${0.7 * pulse})`);
  ctx.fillStyle = g;
  ctx.fillRect(-hw + pw, top + 30, b.w - pw * 2, b.h + b.wallH - 30);
  // portal swirls
  ctx.strokeStyle = `rgba(253,164,175,${0.5 * pulse})`;
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const r = 20 + i * 18 + ((o.t * 20) % 18);
    ctx.globalAlpha = 1 - r / 80;
    ctx.beginPath(); ctx.arc(0, -50, r, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();

  // pillars
  [-hw, hw - pw].forEach((px) => {
    ctx.fillStyle = stoneDark;
    ctx.fillRect(px, top, pw, b.h + b.wallH);
    ctx.fillStyle = stone;
    ctx.fillRect(px + 5, top + 5, pw - 10, b.h + b.wallH - 5);
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    for (let y = top + 20; y < 0; y += 18) { ctx.beginPath(); ctx.moveTo(px + 5, y); ctx.lineTo(px + pw - 5, y); ctx.stroke(); }
    // torch
    ctx.fillStyle = '#7c4a1e';
    ctx.fillRect(px + pw / 2 - 2, top + 40, 4, 16);
    ctx.save();
    ctx.shadowColor = '#fb923c';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#fb923c';
    const fl = Math.sin(o.t * 12 + px) * 2;
    ctx.beginPath(); ctx.ellipse(px + pw / 2, top + 36, 5, 8 + fl, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fde68a';
    ctx.beginPath(); ctx.ellipse(px + pw / 2, top + 38, 2.5, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  });

  // arch
  ctx.fillStyle = stoneDark;
  ctx.beginPath();
  ctx.moveTo(-hw, top + 4);
  ctx.lineTo(-hw, top - 10);
  ctx.quadraticCurveTo(0, top - 60, hw, top - 10);
  ctx.lineTo(hw, top + 4);
  ctx.lineTo(hw - pw, top + 4);
  ctx.quadraticCurveTo(0, top - 30, -hw + pw, top + 4);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = stone;
  ctx.beginPath();
  ctx.moveTo(-hw + 5, top);
  ctx.lineTo(-hw + 5, top - 6);
  ctx.quadraticCurveTo(0, top - 52, hw - 5, top - 6);
  ctx.lineTo(hw - 5, top);
  ctx.lineTo(hw - pw, top);
  ctx.quadraticCurveTo(0, top - 28, -hw + pw, top);
  ctx.closePath(); ctx.fill();

  // banners
  [-hw + pw + 10, hw - pw - 22].forEach((bx, i) => {
    const wave = Math.sin(o.t * 4 + i) * 3;
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.moveTo(bx, top + 4); ctx.lineTo(bx + 12, top + 4);
    ctx.lineTo(bx + 12 + wave, top + 44); ctx.lineTo(bx + 6, top + 36); ctx.lineTo(bx + wave, top + 44);
    ctx.closePath(); ctx.fill();
  });

  drawSign(ctx, b, top - 34, o, true);
}

function drawBoard(ctx: CanvasRenderingContext2D, b: Building, o: BuildingDrawOpts) {
  const wood = lerpColor('#8b5a2b', '#3a2512', o.night);
  const paper = lerpColor('#f5e9d0', '#8a7d68', o.night);
  const top = -b.h - b.wallH;
  ctx.fillStyle = wood;
  ctx.fillRect(-b.w / 2 + 6, top + 10, 6, b.h + b.wallH - 10);
  ctx.fillRect(b.w / 2 - 12, top + 10, 6, b.h + b.wallH - 10);
  rr(ctx, -b.w / 2, top, b.w, 44, 4); ctx.fill();
  // small roof
  ctx.fillStyle = lerpColor(b.color, '#111827', o.night * 0.5);
  ctx.beginPath(); ctx.moveTo(-b.w / 2 - 6, top + 2); ctx.lineTo(0, top - 14); ctx.lineTo(b.w / 2 + 6, top + 2); ctx.closePath(); ctx.fill();
  // papers
  ctx.fillStyle = paper;
  rr(ctx, -b.w / 2 + 6, top + 6, 28, 30, 2); ctx.fill();
  rr(ctx, -b.w / 2 + 40, top + 8, 30, 26, 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let i = 0; i < 4; i++) { ctx.fillRect(-b.w / 2 + 10, top + 12 + i * 6, 20, 1.5); ctx.fillRect(-b.w / 2 + 44, top + 13 + i * 5, 22, 1.5); }
  // pin
  ctx.fillStyle = '#ef4444';
  ctx.beginPath(); ctx.arc(-b.w / 2 + 20, top + 7, 2.5, 0, Math.PI * 2); ctx.fill();
  drawSign(ctx, b, top - 10, o, true);
}

function drawKiosk(ctx: CanvasRenderingContext2D, b: Building, o: BuildingDrawOpts) {
  const c = wallColors(b, o.night);
  const top = -b.h - b.wallH;
  const hw = b.w / 2;
  ctx.fillStyle = c.wallDark;
  ctx.fillRect(-hw, top + 14, b.w, b.h + b.wallH - 14);
  ctx.fillStyle = c.wall;
  ctx.fillRect(-hw + 5, top + 18, b.w - 10, b.h + b.wallH - 18);
  // counter window
  ctx.save();
  ctx.fillStyle = c.window;
  ctx.shadowColor = c.window;
  ctx.shadowBlur = o.night > 0.35 ? 12 : 0;
  rr(ctx, -hw + 12, top + 26, b.w - 24, 22, 3); ctx.fill();
  ctx.restore();
  // striped awning
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 ? '#f8fafc' : b.color;
    ctx.fillRect(-hw - 6 + i * ((b.w + 12) / 6), top, (b.w + 12) / 6, 16);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(-hw - 6, top + 14, b.w + 12, 3);
  drawSign(ctx, b, top - 8, o, true);
}

/** Dark dungeon gate in the wilderness — glowing portal + difficulty stars. */
function drawDungeon(ctx: CanvasRenderingContext2D, b: Building, o: BuildingDrawOpts) {
  const hw = b.w / 2;
  const top = -b.h - b.wallH;
  const rock = lerpColor('#4b4256', '#14101d', o.night);
  const rockDark = lerpColor('#2e2838', '#0b0812', o.night);

  // ground shadow + aura
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(0, 0, hw + 22, 16, 0, 0, Math.PI * 2); ctx.fill();
  const aura = 0.5 + Math.sin(o.t * 2.4) * 0.2;
  const ag = ctx.createRadialGradient(0, -40, 10, 0, -40, hw + 60);
  ag.addColorStop(0, `${b.color}${Math.round(aura * 90).toString(16).padStart(2, '0')}`);
  ag.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ag;
  ctx.fillRect(-hw - 70, top - 70, b.w + 140, b.h + b.wallH + 140);

  // rocky mound
  ctx.fillStyle = rockDark;
  ctx.beginPath();
  ctx.moveTo(-hw - 30, 0);
  ctx.quadraticCurveTo(-hw - 10, top + 30, 0, top);
  ctx.quadraticCurveTo(hw + 10, top + 30, hw + 30, 0);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = rock;
  ctx.beginPath();
  ctx.moveTo(-hw - 18, 0);
  ctx.quadraticCurveTo(-hw, top + 42, 0, top + 14);
  ctx.quadraticCurveTo(hw, top + 42, hw + 18, 0);
  ctx.closePath(); ctx.fill();
  // cracks
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const cx0 = -hw + 22 + i * (b.w / 4);
    ctx.beginPath(); ctx.moveTo(cx0, -10); ctx.lineTo(cx0 + 8, top + 50); ctx.stroke();
  }

  // cave mouth / portal
  const pulse = 0.7 + Math.sin(o.t * 3) * 0.3;
  ctx.save();
  ctx.shadowColor = b.color;
  ctx.shadowBlur = 24 * pulse;
  const pg = ctx.createLinearGradient(0, 0, 0, top + 30);
  pg.addColorStop(0, `rgba(0,0,0,0.95)`);
  pg.addColorStop(1, `${b.color}cc`);
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.moveTo(-hw * 0.5, 0);
  ctx.quadraticCurveTo(-hw * 0.45, -70, 0, -78);
  ctx.quadraticCurveTo(hw * 0.45, -70, hw * 0.5, 0);
  ctx.closePath(); ctx.fill();
  // swirling particles escaping the portal
  ctx.fillStyle = b.color;
  for (let i = 0; i < 8; i++) {
    const ph = (o.t * 0.8 + i / 8) % 1;
    const px = Math.sin(i * 2.4 + o.t) * hw * 0.35 * (1 - ph);
    ctx.globalAlpha = (1 - ph) * pulse;
    ctx.beginPath(); ctx.arc(px, -20 - ph * 90, 2 + ph * 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // skull totems on both sides
  [-hw + 4, hw - 20].forEach((sx, i) => {
    ctx.fillStyle = lerpColor('#d6d3d1', '#57534e', o.night);
    ctx.beginPath(); ctx.arc(sx + 8, -16, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(sx + 5, -10, 6, 6);
    ctx.fillStyle = '#111';
    ctx.fillRect(sx + 4, -19, 3, 3); ctx.fillRect(sx + 10, -19, 3, 3);
    ctx.fillStyle = '#78716c';
    ctx.fillRect(sx + 6, -8, 1, 8 + Math.sin(o.t * 2 + i) * 1);
    ctx.fillRect(sx + 10, -8, 1, 8);
  });

  drawSign(ctx, b, top - 12, o, true);
}

/** Emoji + Arabic label sign above a building. */
function drawSign(ctx: CanvasRenderingContext2D, b: Building, y: number, o: BuildingDrawOpts, floating = false) {
  const bounce = floating ? Math.sin(o.t * 2.2) * 3 : 0;
  const yy = y - 26 + bounce;
  ctx.save();
  ctx.font = '22px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 12px sans-serif';
  const tw = ctx.measureText(b.labelAr).width + 44;
  ctx.shadowColor = o.highlighted ? b.color : 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = o.highlighted ? 18 : 6;
  ctx.fillStyle = o.highlighted ? 'rgba(15,23,42,0.95)' : 'rgba(15,23,42,0.8)';
  rr(ctx, -tw / 2, yy - 13, tw, 26, 8); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = o.highlighted ? b.color : `${b.color}88`;
  ctx.lineWidth = o.highlighted ? 2 : 1.2;
  rr(ctx, -tw / 2, yy - 13, tw, 26, 8); ctx.stroke();
  ctx.font = '16px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(b.emoji, -tw / 2 + 16, yy + 1);
  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = o.highlighted ? '#ffffff' : b.color;
  ctx.fillText(b.labelAr, 12, yy + 1);

  if (o.badge && o.badge > 0) {
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(tw / 2, yy - 12, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(String(Math.min(99, o.badge)), tw / 2, yy - 11);
  }
  ctx.restore();
}

/* ==================== NIGHT AMBIENCE ==================== */

export function drawFireflies(ctx: CanvasRenderingContext2D, t: number, night: number) {
  if (night < 0.4) return;
  const a = (night - 0.4) / 0.6;
  ctx.save();
  ctx.fillStyle = '#bef264';
  ctx.shadowColor = '#bef264';
  ctx.shadowBlur = 8;
  for (let i = 0; i < 22; i++) {
    const bx = 80 + ((i * 337) % (WORLD_W - 160));
    const by = HORIZON_Y + 80 + ((i * 211) % (WORLD_H - HORIZON_Y - 120));
    const fx = bx + Math.sin(t * 0.7 + i) * 30;
    const fy = by + Math.cos(t * 0.9 + i * 1.7) * 18;
    ctx.globalAlpha = a * (0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i)));
    ctx.beginPath(); ctx.arc(fx, fy, 1.8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** Speech bubble with Arabic text above a character (world space). */
export function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color = '#ffffff', big = false) {
  ctx.save();
  ctx.font = big ? '26px "Segoe UI Emoji", "Apple Color Emoji", sans-serif' : 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const padX = big ? 10 : 10;
  const h = big ? 38 : 22;
  const tw = Math.min(260, ctx.measureText(text).width) + padX * 2;
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 6;
  rr(ctx, x - tw / 2, y - h, tw, h, 8); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x, y + 7); ctx.lineTo(x + 6, y); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = big ? '#000' : '#0f172a';
  ctx.fillText(text, x, y - h / 2 + 1, 240);
  if (!big) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    rr(ctx, x - tw / 2, y - h, tw, h, 8); ctx.stroke();
  }
  ctx.restore();
}

/** Name tag drawn above a character. */
export function drawNameTag(ctx: CanvasRenderingContext2D, x: number, y: number, name: string, color: string, isMe: boolean) {
  ctx.save();
  ctx.font = `bold ${isMe ? 12 : 11}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(name).width + 14;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  rr(ctx, x - tw / 2, y - 9, tw, 18, 6); ctx.fill();
  if (isMe) { ctx.strokeStyle = `${color}aa`; ctx.lineWidth = 1; rr(ctx, x - tw / 2, y - 9, tw, 18, 6); ctx.stroke(); }
  ctx.fillStyle = color;
  ctx.fillText(name, x, y + 0.5);
  ctx.restore();
}
