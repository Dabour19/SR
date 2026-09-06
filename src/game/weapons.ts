import { WeaponDef, WeaponType } from '../types';

export const WEAPON_REGISTRY: Record<WeaponType, WeaponDef> = {
  spinning_blades: {
    id: 'spinning_blades',
    name: 'Spinning Blades',
    nameAr: 'الشفرات الدوارة',
    description: 'Blades orbit around the player slicing through all approaching enemies.',
    descriptionAr: 'شفرات سحرية تدور باستمرار حول اللاعب لتقطيع كل الأعداء المقتربين.',
    icon: 'Orbit',
    baseDamage: 18,
    baseCooldown: 0.1, // continuous
    maxLevel: 5,
    unlockedByDefault: true,
  },
  arcane_burst: {
    id: 'arcane_burst',
    name: 'Arcane Burst',
    nameAr: 'الانفجار السحري',
    description: 'Fires fast magical bolts towards the nearest enemy automatically.',
    descriptionAr: 'يطلق مقذوفات سحرية سريعة تلقائياً نحو أقرب وحش.',
    icon: 'Sparkles',
    baseDamage: 28,
    baseCooldown: 1.1,
    maxLevel: 5,
    unlockedByDefault: true,
  },
  holy_aura: {
    id: 'holy_aura',
    name: 'Holy Aura',
    nameAr: 'الهالة المقدسة',
    description: 'Emits a glowing barrier that continuously damages all surrounding enemies.',
    descriptionAr: 'درع هالة ناصعة تحرق وتسبب ضرراً مستمراً لجميع الأعداء في محيطك.',
    icon: 'ShieldAlert',
    baseDamage: 14,
    baseCooldown: 0.55,
    maxLevel: 5,
    unlockedByDefault: false,
  },
  lightning_strike: {
    id: 'lightning_strike',
    name: 'Thunder Strike',
    nameAr: 'صاعقة البرق',
    description: 'Calls down thunderbolts from above to zap random enemies with heavy damage.',
    descriptionAr: 'يستدعي صواعق برق خارقة من السماء لتدمير أعداء عشوائيين بضرر فتاك.',
    icon: 'Zap',
    baseDamage: 60,
    baseCooldown: 2.0,
    maxLevel: 5,
    unlockedByDefault: false,
  },
  fire_wand: {
    id: 'fire_wand',
    name: 'Fire Wand',
    nameAr: 'عصا اللهب',
    description: 'Launches explosive fireballs that deal area of effect damage on impact.',
    descriptionAr: 'تطلق كرات نارية متفجرة تحدث ضرراً جماعياً واسع النطاق عند الاصطدام.',
    icon: 'Flame',
    baseDamage: 40,
    baseCooldown: 1.5,
    maxLevel: 5,
    unlockedByDefault: false,
  },
};

export function getWeaponLevelDescription(type: WeaponType, targetLevel: number): { en: string; ar: string } {
  switch (type) {
    case 'spinning_blades':
      if (targetLevel === 1) return { en: 'Spawns 1 blade orbiting you.', ar: 'شفرة واحدة تدور حولك.' };
      if (targetLevel === 2) return { en: '+1 additional orbiting blade (2 total).', ar: 'إضافة شفرة ثانية (شفرتان تدوران معاً).' };
      if (targetLevel === 3) return { en: '+1 blade (3 total) and +15% orbit radius.', ar: 'إضافة شفرة ثالثة وزيادة قطر الدوران بـ 15%.' };
      if (targetLevel === 4) return { en: '+1 blade (4 total) and +25% damage.', ar: 'إضافة شفرة رابعة وزيادة قوة الضرر 25%.' };
      return { en: '+1 blade (5 total), max speed and giant blade cut.', ar: 'إضافة شفرة خامسة، أقصى سرعة دوران وضرر قاطع مضاعف!' };

    case 'arcane_burst':
      if (targetLevel === 1) return { en: 'Fires 1 bolt at closest enemy.', ar: 'إطلاق مقذوف سحري نحو أقرب عدو.' };
      if (targetLevel === 2) return { en: 'Fires 2 bolts in rapid sequence.', ar: 'إطلاق مقذوفين متتاليين.' };
      if (targetLevel === 3) return { en: '+30% damage and faster projectile speed.', ar: 'زيادة الضرر 30% مع زيادة سرعة المقذوف.' };
      if (targetLevel === 4) return { en: 'Fires 3 bolts and pierces 1 extra enemy.', ar: 'إطلاق 3 مقذوفات مع اختراق عدو إضافي.' };
      return { en: 'Fires 4 bolts with rapid cooldown and mini-burst.', ar: 'إطلاق 4 مقذوفات بانفجار سحري وتسريع وقت الانتظار!' };

    case 'holy_aura':
      if (targetLevel === 1) return { en: 'Damaging aura with 80px radius.', ar: 'هالة محيطة بقطر 80 بكسل تحرق الأعداء.' };
      if (targetLevel === 2) return { en: '+25% aura radius and +20% damage.', ar: 'زيادة قطر الهالة 25% وقوة الضرر 20%.' };
      if (targetLevel === 3) return { en: '+25% aura radius and faster damage tick.', ar: 'توسيع النطاق وتسريع وتيرة إلحاق الضرر.' };
      if (targetLevel === 4) return { en: '+35% damage and knockback effect.', ar: 'زيادة الضرر 35% ودفع الوحوش للخلف.' };
      return { en: 'Giant sanctuary aura with immense burn damage.', ar: 'هالة عملاقة بحجم الشاشة مع حرق فتاك للوحوش.' };

    case 'lightning_strike':
      if (targetLevel === 1) return { en: 'Strikes 1 random enemy for 60 dmg.', ar: 'صاعقة تضرب عدواً عشوائياً بقوة 60 ضرر.' };
      if (targetLevel === 2) return { en: 'Strikes 2 enemies at once.', ar: 'ضرب عدوين في نفس اللحظة.' };
      if (targetLevel === 3) return { en: 'Strikes 3 enemies and -0.4s cooldown.', ar: 'ضرب 3 أعداء وخفض وقت الانتظار 0.4 ثانية.' };
      if (targetLevel === 4) return { en: 'Strikes 4 enemies with +40% damage.', ar: 'ضرب 4 أعداء وزيادة الضرر 40%.' };
      return { en: 'Cataclysm: Strikes 6 enemies with critical shock.', ar: 'عاصفة رعدية: تضرب 6 أعداء بصواعق حرجة خارقة!' };

    case 'fire_wand':
      if (targetLevel === 1) return { en: 'Launches 1 explosive fireball.', ar: 'إطلاق كرة نارية متفجرة تسبب ضرراً مساحياً.' };
      if (targetLevel === 2) return { en: '+25% explosion radius.', ar: 'زيادة نصف قطر انفجار اللهب بنسبة 25%.' };
      if (targetLevel === 3) return { en: 'Launches 2 fireballs simultaneously.', ar: 'إطلاق كرتين ناريتين في آن واحد.' };
      if (targetLevel === 4) return { en: '+35% explosion damage.', ar: 'زيادة الضرر الانفجاري بنسبة 35%.' };
      return { en: 'Launches 3 inferno meteors with massive blast.', ar: 'إطلاق 3 نيازك حارقة بانفجارات هائلة!' };
  }
}
