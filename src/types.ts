/**
 * Core types for Survivor Rogue: 2D Auto-Shooter
 */

export type WeaponType =
  | 'spinning_blades'
  | 'arcane_burst'
  | 'holy_aura'
  | 'lightning_strike'
  | 'fire_wand'
  // Exclusive signature weapons (one per character, unlocked via skill tree level)
  | 'blade_tempest'
  | 'frost_nova'
  | 'poison_volley'
  | 'judgement_beam'
  | 'soul_scythe'
  | 'blood_reaver';

export type PassiveType =
  | 'magnet'
  | 'swift_boots'
  | 'might'
  | 'vitality'
  | 'armor'
  | 'haste';

export type UpgradeItemType = WeaponType | PassiveType;

export interface WeaponDef {
  id: WeaponType;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  icon: string;
  baseDamage: number;
  baseCooldown: number;
  maxLevel: number;
  unlockedByDefault: boolean;
  /** Only offered to this character (signature weapon). Omitted = everyone. */
  exclusiveTo?: CharacterId;
  /** Character level required before it can appear as an upgrade. */
  unlockLevel?: number;
}

export interface PassiveDef {
  id: PassiveType;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  icon: string;
  maxLevel: number;
  perLevelBonus: string;
  perLevelBonusAr: string;
}

export interface PlayerStats {
  maxHp: number;
  hp: number;
  hpRegen: number; // hp per second
  speed: number;
  pickupRadius: number;
  damageMultiplier: number;
  cooldownReduction: number; // percentage (0 - 0.5)
  armor: number; // flat damage reduction
}

export interface ActiveWeapon {
  id: WeaponType;
  level: number;
  timer: number; // for cooldown tracking
}

export interface ActivePassive {
  id: PassiveType;
  level: number;
}

export interface UpgradeOption {
  id: UpgradeItemType;
  isWeapon: boolean;
  name: string;
  nameAr: string;
  level: number; // Level it will become
  maxLevel: number;
  isNew: boolean;
  description: string;
  descriptionAr: string;
  icon: string;
  color: string;
}

export type EnemyCategory =
  | 'bat'
  | 'zombie'
  | 'skeleton'
  | 'ghost'
  | 'orc'
  | 'fire_mage'
  | 'minotaur_boss'
  | 'reaper_boss';

export interface EnemyEntity {
  id: number;
  active: boolean;
  category: EnemyCategory;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  maxHp: number;
  hp: number;
  speed: number;
  damage: number;
  xpValue: number;
  color: string;
  hitFlashTimer: number; // seconds remaining to flash white
  isBoss: boolean;
  animTimer: number;
  // Boss & Ranged mechanics
  attackTimer?: number;
  bossPhase?: number;
  isCharging?: boolean;
  chargeVx?: number;
  chargeVy?: number;
  bossName?: string;
  bossNameAr?: string;
}

export interface EnemyProjectileEntity {
  id: number;
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  life: number;
  maxLife: number;
  color: string;
  type: 'fireball' | 'toxic_orb' | 'void_orb' | 'scythe_wave' | 'shockwave';
  trailTimer?: number;
}

export interface ProjectileEntity {
  id: number;
  active: boolean;
  weaponType: WeaponType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  life: number;
  maxLife: number;
  color: string;
  pierce: number; // how many enemies it can hit before vanishing
  angle?: number; // for spinning blades orbit or facing direction
  orbitDistance?: number;
}

export interface GemEntity {
  id: number;
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number; // XP points
  radius: number;
  color: string;
  attracted: boolean;
}

export interface DamageNumberEntity {
  id: number;
  active: boolean;
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  isCrit: boolean;
  life: number;
  maxLife: number;
}

export interface ParticleEntity {
  id: number;
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface GameRunStats {
  timeSurvived: number; // in seconds
  enemiesKilled: number;
  damageDealt: number;
  gemsCollected: number;
  level: number;
  victory: boolean;
}

export type PlayerTier =
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'diamond'
  | 'legend';

export type PlayerAvatar =
  | 'blade'
  | 'mage'
  | 'hunter'
  | 'paladin'
  | 'wraith'
  | 'berserker';

export interface PlayerRunHistory {
  date: number;
  timeSurvived: number;
  kills: number;
  level: number;
  damage: number;
  victory: boolean;
  score: number;
}

export interface PlayerAccount {
  id: string;
  username: string;
  email?: string;
  photoURL?: string;
  authProvider?: 'google' | 'guest' | 'custom';
  pin?: string;
  avatar: PlayerAvatar;
  title: string;
  tier: PlayerTier;
  rankScore: number;
  isGuest: boolean;
  stats: {
    bestSurvivalTime: number; // seconds
    bestKills: number;
    highestLevel: number;
    totalDamage: number;
    totalRuns: number;
    totalKills: number;
    victories: number;
    lastPlayed: number;
  };
  history: PlayerRunHistory[];
}

export interface LeaderboardRecord {
  id: string;
  playerName: string;
  avatar: PlayerAvatar;
  tier: PlayerTier;
  timeSurvived: number;
  kills: number;
  level: number;
  damage: number;
  victory: boolean;
  score: number;
  date: number;
  isCurrentPlayer?: boolean;
}

export type LeaderboardFilter = 'score' | 'time' | 'kills' | 'level';

/* ==================== LOBBY / SHOP / CRATE SYSTEM ==================== */

export type CharacterId = 'blade' | 'mage' | 'hunter' | 'paladin' | 'wraith' | 'berserker';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface RarityInfo {
  rarity: Rarity;
  labelAr: string;
  color: string; // text color hex
  bg: string; // tailwind bg class (e.g. from-x /50)
  border: string; // tailwind border class
  glow: string; // box-shadow color
  weight: number; // relative drop chance weight
}

export interface CharacterDef {
  id: CharacterId;
  name: string;
  nameAr: string;
  titleAr: string;
  emoji: string;
  rarity: Rarity;
  price: number; // in coins (0 = owned by default)
  isStarter?: boolean;
  // Gameplay modifiers
  baseHp: number;
  speedMultiplier: number;
  damageMultiplier: number;
  descriptionAr: string;
  startingWeapons?: WeaponType[]; // extra starting weapons (blade/mage get defaults)
  /** In-game visual identity, matching the lobby character. */
  theme: CharacterTheme;
}

export interface CharacterTheme {
  cape: string; // cloak color
  trim: string; // glowing trim / rune color
  glow: string; // aura + shadow glow
  accent: string; // pauldrons / secondary armor
  boot: string; // boot rune caps
}

export type CrateId = 'wooden' | 'silver' | 'golden' | 'mythic';

export interface CrateDef {
  id: CrateId;
  name: string;
  nameAr: string;
  emoji: string;
  price: number; // in coins
  // Weights per rarity for this crate
  dropWeights: Record<Rarity, number>;
  color: string;
}

export type ShopItemId = 'double_coins' | 'extra_armor' | 'magnet_plus' | 'swift_start' | 'regen_boost' | 'lucky_charm';

export interface ShopItemDef {
  id: ShopItemId;
  name: string;
  nameAr: string;
  emoji: string;
  descriptionAr: string;
  price: number;
  rarity: Rarity;
  isConsumable: boolean; // consumables can be bought multiple times
  /** Stat bonus applied when the character starts a run */
  applyToStats?: (stats: PlayerStats) => void;
}

/* ==================== FRIENDS & TEAM / MULTIPLAYER ==================== */

export type FriendStatus = 'pending' | 'accepted';

export interface FriendDoc {
  id: string; // `${requesterId}_${targetId}`
  requesterId: string;
  requesterName: string;
  requesterAvatar: PlayerAvatar;
  targetId: string;
  targetName: string;
  targetAvatar: PlayerAvatar;
  status: FriendStatus;
  createdAt: number;
}

export interface TeamMember {
  id: string;
  name: string;
  avatar: PlayerAvatar;
  isHost: boolean;
  selectedCharacter: CharacterId;
  joinedAt: number;
  lastSeen: number;
  ready: boolean;
}

export interface TeamDoc {
  code: string; // 6-char join code (document id)
  hostId: string;
  members: TeamMember[];
  createdAt: number;
  matchStartedAt?: number; // set by host when starting a co-op match
}

export interface CharacterProgress {
  level: number;
  xp: number; // xp earned toward next level
  skillPoints: number; // 1 point per character level
  unlockedNodes: string[]; // skill tree node ids ("nodeId:rank")
}

export interface LobbyState {
  coins: number;
  ownedCharacters: CharacterId[];
  selectedCharacter: CharacterId;
  ownedShopItems: ShopItemId[]; // permanent perks owned
  cratesOpened: number;
  totalSpent: number;
  /** Per-character level / XP / skill-tree state. */
  characterProgress: Record<CharacterId, CharacterProgress>;
}
