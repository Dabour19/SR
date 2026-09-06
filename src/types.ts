/**
 * Core types for Survivor Rogue: 2D Auto-Shooter
 */

export type WeaponType = 
  | 'spinning_blades' 
  | 'arcane_burst' 
  | 'holy_aura' 
  | 'lightning_strike' 
  | 'fire_wand';

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
