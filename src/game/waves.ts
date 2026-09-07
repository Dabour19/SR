import { EnemyCategory } from '../types';

export interface WaveConfig {
  minTime: number; // in seconds
  maxTime: number;
  enemies: {
    category: EnemyCategory;
    weight: number;
    baseHp: number;
    baseSpeed: number;
    baseDamage: number;
    radius: number;
    xpValue: number;
    color: string;
  }[];
  spawnRate: number; // enemies per second
  bossEvent?: {
    triggerTime: number;
    category: EnemyCategory;
    name: string;
    nameAr: string;
    hp: number;
    speed: number;
    damage: number;
    radius: number;
    xpValue: number;
    color: string;
  };
}

export const GAME_DURATION_SECONDS = 20 * 60; // 20 minutes survival goal

export const WAVE_SCHEDULE: WaveConfig[] = [
  // Minute 0 - 2: Early Bats & Zombies
  {
    minTime: 0,
    maxTime: 120,
    spawnRate: 2.6,
    enemies: [
      {
        category: 'bat',
        weight: 60,
        baseHp: 32,
        baseSpeed: 75,
        baseDamage: 8,
        radius: 11,
        xpValue: 1,
        color: '#a855f7',
      },
      {
        category: 'zombie',
        weight: 40,
        baseHp: 56,
        baseSpeed: 45,
        baseDamage: 12,
        radius: 14,
        xpValue: 2,
        color: '#22c55e',
      },
    ],
    bossEvent: {
      triggerTime: 115,
      category: 'minotaur_boss',
      name: 'Crypt Minotaur',
      nameAr: 'مينوتور السراديب',
       hp: 2000,
      speed: 55,
      damage: 22,
      radius: 28,
      xpValue: 35,
      color: '#f97316',
    },
  },

  // Minute 2 - 5: Skeletons, Bats Swarm & Rare Fire Mages (تقليل الأعداء مطلقي النيران)
  {
    minTime: 120,
    maxTime: 300,
    spawnRate: 4.9,
    enemies: [
      {
        category: 'bat',
        weight: 38,
        baseHp: 56,
        baseSpeed: 85,
        baseDamage: 10,
        radius: 11,
        xpValue: 2,
        color: '#c084fc',
      },
      {
        category: 'skeleton',
        weight: 42,
        baseHp: 110,
        baseSpeed: 55,
        baseDamage: 15,
        radius: 13,
        xpValue: 3,
        color: '#e2e8f0',
      },
      {
        category: 'zombie',
        weight: 15,
        baseHp: 150,
        baseSpeed: 42,
        baseDamage: 16,
        radius: 15,
        xpValue: 3,
        color: '#15803d',
      },
      {
        category: 'fire_mage',
        weight: 5, // Reduced from 20 to 5 for early game balance
        baseHp: 76,
        baseSpeed: 44,
        baseDamage: 13,
        radius: 14,
        xpValue: 5,
        color: '#f97316',
      },
    ],
    bossEvent: {
      triggerTime: 290,
      category: 'minotaur_boss',
      name: 'Armored Ghoul King',
      nameAr: 'ملك الغيلان السام',
       hp: 5800,
      speed: 60,
      damage: 28,
      radius: 30,
      xpValue: 60,
      color: '#10b981',
    },
  },

  // Minute 5 - 10: Ghosts, Orc Brutes & Controlled Fire Mages
  {
    minTime: 300,
    maxTime: 600,
    spawnRate: 7.8,
    enemies: [
      {
        category: 'ghost',
        weight: 33,
        baseHp: 130,
        baseSpeed: 95,
        baseDamage: 18,
        radius: 13,
        xpValue: 4,
        color: '#38bdf8',
      },
      {
        category: 'orc',
        weight: 33,
        baseHp: 320,
        baseSpeed: 50,
        baseDamage: 24,
        radius: 18,
        xpValue: 6,
        color: '#ca8a04',
      },
      {
        category: 'skeleton',
        weight: 24,
        baseHp: 160,
        baseSpeed: 62,
        baseDamage: 18,
        radius: 13,
        xpValue: 4,
        color: '#f1f5f9',
      },
      {
        category: 'fire_mage',
        weight: 10, // Controlled from 20 to 10
        baseHp: 160,
        baseSpeed: 48,
        baseDamage: 18,
        radius: 14,
        xpValue: 7,
        color: '#ea580c',
      },
    ],
    bossEvent: {
      triggerTime: 580,
      category: 'minotaur_boss',
      name: 'Abyssal Behemoth',
      nameAr: 'طاغوت الأعماق البركاني',
       hp: 14400,
      speed: 65,
      damage: 35,
      radius: 34,
      xpValue: 120,
      color: '#dc2626',
    },
  },

  // Minute 10 - 15: Intense Multi-Wave Assault & Heavy Fire Mages
  {
    minTime: 600,
    maxTime: 900,
    spawnRate: 11.5,
    enemies: [
      {
        category: 'bat',
        weight: 20,
        baseHp: 180,
        baseSpeed: 105,
        baseDamage: 20,
        radius: 12,
        xpValue: 4,
        color: '#e879f9',
      },
      {
        category: 'ghost',
        weight: 20,
        baseHp: 240,
        baseSpeed: 100,
        baseDamage: 22,
        radius: 14,
        xpValue: 5,
        color: '#67e8f9',
      },
      {
        category: 'orc',
        weight: 25,
        baseHp: 560,
        baseSpeed: 58,
        baseDamage: 30,
        radius: 19,
        xpValue: 8,
        color: '#b45309',
      },
      {
        category: 'skeleton',
        weight: 15,
        baseHp: 300,
        baseSpeed: 70,
        baseDamage: 22,
        radius: 14,
        xpValue: 6,
        color: '#ffffff',
      },
      {
        category: 'fire_mage',
        weight: 20,
        baseHp: 320,
        baseSpeed: 55,
        baseDamage: 30,
        radius: 15,
        xpValue: 9,
        color: '#f97316',
      },
    ],
    bossEvent: {
      triggerTime: 880,
      category: 'reaper_boss',
      name: 'Shadow Overlord',
      nameAr: 'حاكم الظلال الأكبر',
       hp: 30000,
      speed: 72,
      damage: 42,
      radius: 36,
      xpValue: 200,
      color: '#7c3aed',
    },
  },

  // Minute 15 - 20: Climax Blood Moon (Infernal Horde)
  {
    minTime: 900,
    maxTime: 1200,
    spawnRate: 16.5,
    enemies: [
      {
        category: 'bat',
        weight: 20,
        baseHp: 320,
        baseSpeed: 120,
        baseDamage: 26,
        radius: 12,
        xpValue: 6,
        color: '#f43f5e',
      },
      {
        category: 'ghost',
        weight: 20,
        baseHp: 420,
        baseSpeed: 110,
        baseDamage: 28,
        radius: 14,
        xpValue: 7,
        color: '#a855f7',
      },
      {
        category: 'orc',
        weight: 25,
        baseHp: 900,
        baseSpeed: 68,
        baseDamage: 36,
        radius: 20,
        xpValue: 12,
        color: '#e11d48',
      },
      {
        category: 'skeleton',
        weight: 15,
        baseHp: 520,
        baseSpeed: 82,
        baseDamage: 30,
        radius: 14,
        xpValue: 8,
        color: '#cbd5e1',
      },
      {
        category: 'fire_mage',
        weight: 20,
        baseHp: 560,
        baseSpeed: 60,
        baseDamage: 38,
        radius: 15,
        xpValue: 12,
        color: '#ef4444',
      },
    ],
    bossEvent: {
      triggerTime: 1180,
      category: 'reaper_boss',
      name: 'Grim Reaper of Eternity',
      nameAr: 'ملك الموت الأبدي',
       hp: 64000,
      speed: 82,
      damage: 55,
      radius: 40,
      xpValue: 500,
      color: '#9333ea',
    },
  },
];

export function getCurrentWave(timeSeconds: number): WaveConfig {
  for (const wave of WAVE_SCHEDULE) {
    if (timeSeconds >= wave.minTime && timeSeconds < wave.maxTime) {
      return wave;
    }
  }
  // If past 20 minutes (endless overtime), return the most intense wave with scaling
  return WAVE_SCHEDULE[WAVE_SCHEDULE.length - 1];
}


