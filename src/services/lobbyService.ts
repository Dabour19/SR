/**
 * Lobby Service: coins, character ownership, shop perks, loot boxes (gacha).
 * Fully local (localStorage). Multiplayer-ready: state is plain serializable data.
 */
import {
  CharacterDef,
  CharacterId,
  CharacterProgress,
  CrateDef,
  CrateId,
  LobbyState,
  PlayerStats,
  Rarity,
  RarityInfo,
  ShopItemDef,
  ShopItemId,
  WeaponType,
  CharacterTheme,
} from '../types';
import {
  applySkillBonuses,
  applyXp,
  canUpgradeNode,
  getNodeRank,
  getSkillTree,
  xpForNextLevel,
} from '../game/skillTree';

const STORAGE_KEY = 'survivor_rogue_lobby_v1';

/* ==================== RARITY CONFIG ==================== */

export const RARITY_CONFIG: Record<Rarity, RarityInfo> = {
  common: {
    rarity: 'common',
    labelAr: 'عادي',
    color: '#94a3b8',
    bg: 'bg-slate-500/20',
    border: 'border-slate-400/50',
    glow: 'rgba(148,163,184,0.5)',
    weight: 60,
  },
  rare: {
    rarity: 'rare',
    labelAr: 'نادر',
    color: '#22d3ee',
    bg: 'bg-cyan-500/20',
    border: 'border-cyan-400/60',
    glow: 'rgba(34,211,238,0.6)',
    weight: 25,
  },
  epic: {
    rarity: 'epic',
    labelAr: 'أسطوري',
    color: '#c084fc',
    bg: 'bg-purple-500/20',
    border: 'border-purple-400/60',
    glow: 'rgba(192,132,252,0.6)',
    weight: 12,
  },
  legendary: {
    rarity: 'legendary',
    labelAr: 'خارق للعادة',
    color: '#fbbf24',
    bg: 'bg-amber-500/20',
    border: 'border-amber-400/70',
    glow: 'rgba(251,191,36,0.7)',
    weight: 3,
  },
};

/* ==================== CHARACTERS ==================== */

/** Visual identity per character: lobby emoji = in-game look. */
const CHAR_THEMES: Record<CharacterId, CharacterTheme> = {
  blade: { cape: '#0f172a', trim: '#22d3ee', glow: '#22d3ee', accent: '#0284c7', boot: '#38bdf8' },
  mage: { cape: '#2e1065', trim: '#c084fc', glow: '#a855f7', accent: '#7c3aed', boot: '#a78bfa' },
  hunter: { cape: '#064e3b', trim: '#34d399', glow: '#10b981', accent: '#059669', boot: '#6ee7b7' },
  paladin: { cape: '#451a03', trim: '#fbbf24', glow: '#f59e0b', accent: '#d97706', boot: '#fcd34d' },
  wraith: { cape: '#1e1b4b', trim: '#e0e7ff', glow: '#818cf8', accent: '#6366f1', boot: '#c7d2fe' },
  berserker: { cape: '#450a0a', trim: '#f87171', glow: '#ef4444', accent: '#dc2626', boot: '#fca5a5' },
};

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'blade',
    name: 'Blade',
    nameAr: 'النصل',
    titleAr: 'مقاتل متوازن',
    emoji: '⚔️',
    rarity: 'common',
    price: 0,
    isStarter: true,
    baseHp: 100,
    speedMultiplier: 1.0,
    damageMultiplier: 1.0,
    descriptionAr: 'شخصية البداية. توازن مثالي بين الصحة والسرعة والضرر.',
    startingWeapons: ['spinning_blades', 'arcane_burst'],
    theme: CHAR_THEMES.blade,
  },
  {
    id: 'mage',
    name: 'Mage',
    nameAr: 'الساحر',
    titleAr: 'قاذف السحر',
    emoji: '🧙',
    rarity: 'rare',
    price: 500,
    baseHp: 80,
    speedMultiplier: 1.0,
    damageMultiplier: 1.25,
    descriptionAr: 'صحة أقل لكن ضرر أعلى بنسبة 25%.',
    startingWeapons: ['arcane_burst'],
    theme: CHAR_THEMES.mage,
  },
  {
    id: 'hunter',
    name: 'Hunter',
    nameAr: 'الصياد',
    titleAr: 'سريع ورشيق',
    emoji: '🏹',
    rarity: 'rare',
    price: 750,
    baseHp: 90,
    speedMultiplier: 1.2,
    damageMultiplier: 1.0,
    descriptionAr: 'سرعة حركة أعلى بنسبة 20%. مثالي للمراوغة.',
    startingWeapons: ['fire_wand'],
    theme: CHAR_THEMES.hunter,
  },
  {
    id: 'paladin',
    name: 'Paladin',
    nameAr: 'القدّيس',
    titleAr: 'حصين محصّن',
    emoji: '🛡️',
    rarity: 'epic',
    price: 1500,
    baseHp: 150,
    speedMultiplier: 0.9,
    damageMultiplier: 0.95,
    descriptionAr: 'صحة عملاقة (150) مع دروع إضافية، لكن أبطأ قليلاً.',
    startingWeapons: ['holy_aura'],
    theme: CHAR_THEMES.paladin,
  },
  {
    id: 'wraith',
    name: 'Wraith',
    nameAr: 'الطيف',
    titleAr: 'شبح سريع',
    emoji: '👻',
    rarity: 'epic',
    price: 2000,
    baseHp: 75,
    speedMultiplier: 1.35,
    damageMultiplier: 1.15,
    descriptionAr: 'الأسرع في اللعبة (+35% سرعة) مع ضرر جيد، لكن هش جداً.',
    startingWeapons: ['lightning_strike'],
    theme: CHAR_THEMES.wraith,
  },
  {
    id: 'berserker',
    name: 'Berserker',
    nameAr: 'المهووس',
    titleAr: 'وحش الدمار',
    emoji: '🪓',
    rarity: 'legendary',
    price: 4000,
    baseHp: 120,
    speedMultiplier: 1.1,
    damageMultiplier: 1.5,
    descriptionAr: 'ضرر هائل (+50%) مع صحة جيدة وسرعة أعلى. الأقوى.',
    startingWeapons: ['spinning_blades'],
    theme: CHAR_THEMES.berserker,
  },
];

export function getCharacter(id: CharacterId): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
}

/* ==================== CRATES ==================== */

export const CRATES: CrateDef[] = [
  {
    id: 'wooden',
    name: 'Wooden Crate',
    nameAr: 'صندوق خشبي',
    emoji: '📦',
    price: 250,
    dropWeights: { common: 70, rare: 22, epic: 7, legendary: 1 },
    color: '#a16207',
  },
  {
    id: 'silver',
    name: 'Silver Crate',
    nameAr: 'صندوق فضي',
    emoji: '🎁',
    price: 600,
    dropWeights: { common: 40, rare: 38, epic: 18, legendary: 4 },
    color: '#94a3b8',
  },
  {
    id: 'golden',
    name: 'Golden Crate',
    nameAr: 'صندوق ذهبي',
    emoji: '🏆',
    price: 1500,
    dropWeights: { common: 10, rare: 40, epic: 38, legendary: 12 },
    color: '#facc15',
  },
  {
    id: 'mythic',
    name: 'Mythic Crate',
    nameAr: 'الصندوق الأسطوري',
    emoji: '💠',
    price: 3500,
    dropWeights: { common: 0, rare: 20, epic: 50, legendary: 30 },
    color: '#e879f9',
  },
];

export function getCrate(id: CrateId): CrateDef {
  return CRATES.find((c) => c.id === id) || CRATES[0];
}

/* ==================== SHOP PERKS ==================== */

export const SHOP_ITEMS: ShopItemDef[] = [
  {
    id: 'double_coins',
    name: 'Double Coins',
    nameAr: 'عملات مضاعفة',
    emoji: '🪙',
    descriptionAr: 'تضاعف العملات المكتسبة من كل جولة (x2).',
    price: 2000,
    rarity: 'epic',
    isConsumable: false,
  },
  {
    id: 'extra_armor',
    name: 'Extra Armor',
    nameAr: 'دروع إضافية',
    emoji: '🛡️',
    descriptionAr: 'تبدأ كل جولة بـ 3 نقاط دروع إضافية.',
    price: 1200,
    rarity: 'rare',
    isConsumable: false,
    applyToStats: (s: PlayerStats) => {
      s.armor += 3;
    },
  },
  {
    id: 'magnet_plus',
    name: 'Magnet Plus',
    nameAr: 'مغناطيس محسّن',
    emoji: '🧲',
    descriptionAr: 'نطاق جذب الجواهر أكبر بنسبة 50%.',
    price: 800,
    rarity: 'rare',
    isConsumable: false,
    applyToStats: (s: PlayerStats) => {
      s.pickupRadius = Math.round(s.pickupRadius * 1.5);
    },
  },
  {
    id: 'swift_start',
    name: 'Swift Start',
    nameAr: 'بداية رشيقة',
    emoji: '👟',
    descriptionAr: 'سرعة حركة أعلى بنسبة 10% منذ بداية الجولة.',
    price: 1000,
    rarity: 'rare',
    isConsumable: false,
    applyToStats: (s: PlayerStats) => {
      s.speed = Math.round(s.speed * 1.1);
    },
  },
  {
    id: 'regen_boost',
    name: 'Regen Boost',
    nameAr: 'تعزيز التجدد',
    emoji: '❤️‍🩹',
    descriptionAr: 'تجديد صحة أساسي أعلى (+0.5 صحة/ثانية).',
    price: 1500,
    rarity: 'epic',
    isConsumable: false,
    applyToStats: (s: PlayerStats) => {
      s.hpRegen += 0.5;
    },
  },
  {
    id: 'lucky_charm',
    name: 'Lucky Charm',
    nameAr: 'تميمة الحظ',
    emoji: '🍀',
    descriptionAr: 'يزيد حظك في فتح الصناديق (تقليل فرصة العناصر العادية وزيادة النادرة).',
    price: 2500,
    rarity: 'legendary',
    isConsumable: false,
  },
];

/* ==================== GACHA ROLL ==================== */

export type CrateReward =
  | { kind: 'character'; id: CharacterId; rarity: Rarity; nameAr: string; emoji: string }
  | { kind: 'coins'; amount: number; rarity: Rarity };

const DEFAULT_STATE: LobbyState = {
  coins: 500, // welcome bonus
  ownedCharacters: ['blade'],
  selectedCharacter: 'blade',
  ownedShopItems: [],
  cratesOpened: 0,
  totalSpent: 0,
  characterProgress: {
    blade: freshProgress(),
    mage: freshProgress(),
    hunter: freshProgress(),
    paladin: freshProgress(),
    wraith: freshProgress(),
    berserker: freshProgress(),
  },
};

function freshProgress(): CharacterProgress {
  return { level: 1, xp: 0, skillPoints: 0, unlockedNodes: [] };
}

/** Roll a reward from a crate, weighted by crate weights + lucky_charm perk. */
export function rollCrate(state: LobbyState, crateId: CrateId): CrateReward {
  const crate = getCrate(crateId);
  const lucky = state.ownedShopItems.includes('lucky_charm');

  const w = { ...crate.dropWeights };
  if (lucky) {
    w.common = Math.max(0, w.common * 0.6);
    w.legendary = w.legendary * 1.5;
  }

  const total = w.common + w.rare + w.epic + w.legendary;
  let roll = Math.random() * total;
  let rarity: Rarity = 'common';
  if ((roll -= w.legendary) < 0) rarity = 'legendary';
  else if ((roll -= w.epic) < 0) rarity = 'epic';
  else if ((roll -= w.rare) < 0) rarity = 'rare';

  // Prefer unlocking a new character of that rarity (70%)
  const lockedChars = CHARACTERS.filter(
    (c) => !state.ownedCharacters.includes(c.id) && c.rarity === rarity
  );
  if (lockedChars.length > 0 && Math.random() < 0.7) {
    const c = lockedChars[Math.floor(Math.random() * lockedChars.length)];
    return { kind: 'character', id: c.id, rarity: c.rarity, nameAr: c.nameAr, emoji: c.emoji };
  }

  // Fallback: coin prize scaled by rarity
  const coinRanges: Record<Rarity, [number, number]> = {
    common: [50, 150],
    rare: [150, 400],
    epic: [400, 1000],
    legendary: [1000, 2500],
  };
  const [min, max] = coinRanges[rarity];
  const amount = Math.floor(min + Math.random() * (max - min));
  return { kind: 'coins', amount, rarity };
}

/* ==================== SERVICE ==================== */

class LobbyService {
  private state: LobbyState = { ...DEFAULT_STATE };
  private listeners = new Set<() => void>();

  constructor() {
    this.load();
  }

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<LobbyState>;
        this.state = { ...DEFAULT_STATE, ...parsed };
        this.state.characterProgress = { ...DEFAULT_STATE.characterProgress, ...(this.state.characterProgress || {}) };
        // Backfill per-character progress for older saves
        for (const id of ['blade', 'mage', 'hunter', 'paladin', 'wraith', 'berserker'] as CharacterId[]) {
          if (!this.state.characterProgress[id]) {
            this.state.characterProgress[id] = freshProgress();
          }
        }
        if (!this.state.ownedCharacters.includes('blade')) {
          this.state.ownedCharacters.push('blade');
        }
      }
    } catch {
      this.state = { ...DEFAULT_STATE };
    }
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {}
  }

  private commit() {
    this.save();
    this.listeners.forEach((l) => l());
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  getState(): LobbyState {
    return this.state;
  }

  /* ---------- Coins ---------- */

  addRunCoins(rawAmount: number): number {
    const doubled = this.state.ownedShopItems.includes('double_coins');
    const amount = doubled ? rawAmount * 2 : rawAmount;
    this.state.coins += amount;
    this.commit();
    return amount;
  }

  private trySpend(cost: number): boolean {
    if (this.state.coins < cost) return false;
    this.state.coins -= cost;
    this.state.totalSpent += cost;
    return true;
  }

  /* ---------- Characters ---------- */

  selectCharacter(id: CharacterId): boolean {
    if (!this.state.ownedCharacters.includes(id)) return false;
    this.state.selectedCharacter = id;
    this.commit();
    return true;
  }

  buyCharacter(id: CharacterId): { success: boolean; error?: string } {
    const char = getCharacter(id);
    if (this.state.ownedCharacters.includes(id)) {
      return { success: false, error: 'الشخصية مملوكة بالفعل' };
    }
    if (!this.trySpend(char.price)) {
      return { success: false, error: 'عملات غير كافية' };
    }
    this.state.ownedCharacters.push(id);
    this.state.selectedCharacter = id;
    this.commit();
    return { success: true };
  }

  /* ---------- Shop Perks ---------- */

  buyShopItem(id: ShopItemId): { success: boolean; error?: string } {
    const item = SHOP_ITEMS.find((i) => i.id === id);
    if (!item) return { success: false, error: 'عنصر غير موجود' };
    if (this.state.ownedShopItems.includes(id)) {
      return { success: false, error: 'تمتلك هذه الترقية بالفعل' };
    }
    if (!this.trySpend(item.price)) {
      return { success: false, error: 'عملات غير كافية' };
    }
    this.state.ownedShopItems.push(id);
    this.commit();
    return { success: true };
  }

  /* ---------- Crates ---------- */

  openCrate(crateId: CrateId): { success: boolean; reward?: CrateReward; error?: string } {
    const crate = getCrate(crateId);
    if (!this.trySpend(crate.price)) {
      return { success: false, error: 'عملات غير كافية' };
    }
    const reward = rollCrate(this.state, crateId);
    if (reward.kind === 'character') {
      if (!this.state.ownedCharacters.includes(reward.id)) {
        this.state.ownedCharacters.push(reward.id);
      }
    } else {
      this.state.coins += reward.amount;
    }
    this.state.cratesOpened += 1;
    this.commit();
    return { success: true, reward };
  }

  /* ---------- Character Level / XP / Skill Tree ---------- */

  /** Progress record for a character (always safe). */
  getProgress(id: CharacterId): CharacterProgress {
    if (!this.state.characterProgress[id]) {
      this.state.characterProgress[id] = freshProgress();
    }
    return this.state.characterProgress[id];
  }

  /** XP needed for this character's next level. */
  getXpRequirement(id: CharacterId): number {
    return xpForNextLevel(this.getProgress(id).level);
  }

  /**
   * Grant XP to a character after a run. Returns summary of gains.
   * XP scales with survival time, kills and in-run level.
   */
  addCharacterXp(id: CharacterId, xp: number): {
    level: number;
    levelsGained: number;
    skillPointsGained: number;
  } {
    const p = this.getProgress(id);
    const res = applyXp(p.level, p.xp, xp);
    p.level = res.level;
    p.xp = res.xp;
    p.skillPoints += res.skillPointsGained;
    this.commit();
    return {
      level: res.level,
      levelsGained: res.levelsGained,
      skillPointsGained: res.skillPointsGained,
    };
  }

  /** Spend a skill point to raise a node's rank. */
  upgradeSkillNode(charId: CharacterId, nodeId: string): { success: boolean; error?: string } {
    const p = this.getProgress(charId);
    const check = canUpgradeNode(charId, p.unlockedNodes, nodeId, p.skillPoints);
    if (!check.ok) return { success: false, error: check.error };
    const node = getSkillTree(charId).find((n) => n.id === nodeId);
    if (!node) return { success: false, error: 'عقدة غير موجودة' };
    const rank = getNodeRank(p.unlockedNodes, nodeId);
    p.unlockedNodes = p.unlockedNodes.filter((entry) => entry.split(':')[0] !== nodeId);
    p.unlockedNodes.push(`${nodeId}:${rank + 1}`);
    p.skillPoints -= 1;
    this.commit();
    return { success: true };
  }

  /* ---------- Run integration ---------- */

  /** Starting stats config for the selected character + owned perks. */
  getRunStartStats(): {
    characterId: CharacterId;
    maxHp: number;
    speedMultiplier: number;
    damageMultiplier: number;
    startingWeapons: WeaponType[];
    theme: CharacterTheme;
    applyPerks: (stats: PlayerStats) => void;
  } {
    const char = getCharacter(this.state.selectedCharacter);
    const ownedPerks = SHOP_ITEMS.filter(
      (i) => this.state.ownedShopItems.includes(i.id) && i.applyToStats
    );
    return {
      characterId: char.id,
      maxHp: char.baseHp,
      speedMultiplier: char.speedMultiplier,
      damageMultiplier: char.damageMultiplier,
      startingWeapons: char.startingWeapons || ['spinning_blades', 'arcane_burst'],
      theme: char.theme,
      applyPerks: (stats: PlayerStats) => {
        ownedPerks.forEach((p) => p.applyToStats?.(stats));
        // Apply unlocked skill-tree bonuses on top of shop perks
        applySkillBonuses(char.id, this.getProgress(char.id).unlockedNodes, stats);
      },
    };
  }
}

export const lobbyService = new LobbyService();
