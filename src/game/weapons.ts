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
  blade_tempest: {
    id: 'blade_tempest',
    name: 'Blade Tempest',
    nameAr: 'عاصفة النصال',
    description: 'Exclusive to Blade: erupts a full-circle fan of spectral blades around you.',
    descriptionAr: 'حصرية للنصل: تطلق مروحة نصالاً طيفية في كل الاتجاهات حولك.',
    icon: 'Swords',
    baseDamage: 22,
    baseCooldown: 2.2,
    maxLevel: 5,
    unlockedByDefault: false,
    exclusiveTo: 'blade',
    unlockLevel: 3,
  },
  frost_nova: {
    id: 'frost_nova',
    name: 'Frost Nova',
    nameAr: 'الانفجار الجليدي',
    description: 'Exclusive to Mage: detonates an icy shockwave that slows and shatters nearby enemies.',
    descriptionAr: 'حصرية للساحر: تفجير موجة جليدية تجمد الوحوش المحيطة وتقتطعها.',
    icon: 'ShieldAlert',
    baseDamage: 30,
    baseCooldown: 2.4,
    maxLevel: 5,
    unlockedByDefault: false,
    exclusiveTo: 'mage',
    unlockLevel: 3,
  },
  poison_volley: {
    id: 'poison_volley',
    name: 'Poison Volley',
    nameAr: 'رشقة السم',
    description: 'Exclusive to Hunter: fires piercing poison arrows that seep through multiple foes.',
    descriptionAr: 'حصرية للصياد: تطلق سهام السم المخترقة التي تنفذ عبر أعداء متعددين.',
    icon: 'Zap',
    baseDamage: 20,
    baseCooldown: 1.4,
    maxLevel: 5,
    unlockedByDefault: false,
    exclusiveTo: 'hunter',
    unlockLevel: 3,
  },
  judgement_beam: {
    id: 'judgement_beam',
    name: 'Judgement Beam',
    nameAr: 'شعاع الحكم',
    description: 'Exclusive to Paladin: unleashes a searing holy beam that pierces everything in a line.',
    descriptionAr: 'حصرية للقدّيس: يطلق شعاعاً مقدساً محترقاً يخترق كل ما في طريقه.',
    icon: 'Sparkles',
    baseDamage: 45,
    baseCooldown: 2.6,
    maxLevel: 5,
    unlockedByDefault: false,
    exclusiveTo: 'paladin',
    unlockLevel: 3,
  },
  soul_scythe: {
    id: 'soul_scythe',
    name: 'Soul Scythe',
    nameAr: 'منجل الأرواح',
    description: 'Exclusive to Wraith: hurls a returning soul scythe that reaps everything in its path.',
    descriptionAr: 'حصرية للطيف: يرمي منجلاً من الأرواح يعود إليك حاصداً كل ما في طريقه.',
    icon: 'Flame',
    baseDamage: 34,
    baseCooldown: 1.8,
    maxLevel: 5,
    unlockedByDefault: false,
    exclusiveTo: 'wraith',
    unlockLevel: 3,
  },
  blood_reaver: {
    id: 'blood_reaver',
    name: 'Blood Reaver',
    nameAr: 'قاطع الدماء',
    description: 'Exclusive to Berserker: pulsing blood frenzy that damages foes and heals you on kill.',
    descriptionAr: 'حصرية للمهووس: نوبات دموية تخترق الأعداء وتشفيك عند كل قتل.',
    icon: 'HeartPulse',
    baseDamage: 26,
    baseCooldown: 1.6,
    maxLevel: 5,
    unlockedByDefault: false,
    exclusiveTo: 'berserker',
    unlockLevel: 3,
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

    case 'blade_tempest':
      if (targetLevel === 1) return { en: 'Fires 6 spectral blades in a full circle.', ar: 'إطلاق 6 نصال طيفية في دائرة كاملة.' };
      if (targetLevel === 2) return { en: '+2 blades (8 total).', ar: 'إضافة نصالين (8 في المجموع).' };
      if (targetLevel === 3) return { en: '+40% damage and longer lifespan.', ar: 'زيادة الضرر 40% مع عمر أطول للنصال.' };
      if (targetLevel === 4) return { en: '+2 blades (10 total) and pierces 3 enemies.', ar: 'إضافة نصالين (10) مع اختراق 3 أعداء.' };
      return { en: 'Tempest: 12 blades with devastating spiral damage.', ar: 'عاصفة: 12 شفرة بضرر حلزوني مدمّر!' };

    case 'frost_nova':
      if (targetLevel === 1) return { en: 'Icy shockwave with 140px radius.', ar: 'موجة جليدية بنطاق 140 بكسل.' };
      if (targetLevel === 2) return { en: '+30% radius and knockback.', ar: 'زيادة النطاق 30% مع دفع الأعداء.' };
      if (targetLevel === 3) return { en: 'Faster detonation cycle (-0.5s).', ar: 'تسريع دورة التفجير (-0.5 ثانية).' };
      if (targetLevel === 4) return { en: '+50% shatter damage.', ar: 'زيادة ضرر التقتيل الجليدي 50%.' };
      return { en: 'Absolute Zero: screen-wide blizzard detonation.', ar: 'الصفر المطلق: عاصفة ثلجية تدمّر الشاشة بأكملها!' };

    case 'poison_volley':
      if (targetLevel === 1) return { en: 'Fires 3 poison arrows forward.', ar: 'إطلاق 3 سهام سمّية نحو الأعداء.' };
      if (targetLevel === 2) return { en: 'Fires 5 arrows with +20% damage.', ar: 'إطلاق 5 سهام مع زيادة الضرر 20%.' };
      if (targetLevel === 3) return { en: 'Arrows pierce 4 enemies.', ar: 'السهام تخترق 4 أعداء.' };
      if (targetLevel === 4) return { en: 'Fires 7 arrows in a wide spread.', ar: 'إطلاق 7 سهام بانتشار واسع.' };
      return { en: 'Venom Storm: 9 arrows with lethal coating.', ar: 'عاصفة السم: 9 سهام بطبقة قاتلة!' };

    case 'judgement_beam':
      if (targetLevel === 1) return { en: 'Holy beam strikes 1 direction.', ar: 'شعاع مقدس يضرب جهة واحدة.' };
      if (targetLevel === 2) return { en: '+35% beam damage.', ar: 'زيادة ضرر الشعاع 35%.' };
      if (targetLevel === 3) return { en: 'Twin beams in two directions.', ar: 'شعاعان في اتجاهين معاً.' };
      if (targetLevel === 4) return { en: 'Wider beam, burns through armor.', ar: 'شعاع أعرض يحرق الدروع.' };
      return { en: 'Divine Wrath: triple beams of judgement.', ar: 'الغيظ الإلهي: ثلاثة أشعة من الحكم السماوي!' };

    case 'soul_scythe':
      if (targetLevel === 1) return { en: 'Hurls 1 reaping scythe.', ar: 'رمي منجل حاصد واحد.' };
      if (targetLevel === 2) return { en: 'Hurls 2 scythes in a spread.', ar: 'رمي منجلين بانتشار متوازي.' };
      if (targetLevel === 3) return { en: '+30% damage and longer reach.', ar: 'زيادة الضرر 30% مع مدى أطول.' };
      if (targetLevel === 4) return { en: 'Hurls 3 scythes that pierce deeply.', ar: 'رمي 3 مناجل مخترقة بعمق.' };
      return { en: 'Harvest of Souls: 4 giant scythes of doom.', ar: 'حصاد الأرواح: 4 مناجل عملاقة محتدمة!' };

    case 'blood_reaver':
      if (targetLevel === 1) return { en: 'Blood pulse with 110px radius.', ar: 'نبضة دموية بنطاق 110 بكسل.' };
      if (targetLevel === 2) return { en: '+25% radius, heals 2 HP on kill.', ar: 'زيادة النطاق 25% وشفا نقطة صحة عند كل قتل.' };
      if (targetLevel === 3) return { en: 'Faster frenzy pulses.', ar: 'تسريع نبضات الحمّى الدموية.' };
      if (targetLevel === 4) return { en: '+45% damage and 5 HP on kill.', ar: 'زيادة الضرر 45% وشفا 5 نقاط عند كل قتل.' };
      return { en: 'Carnage: massive pulses, 10 HP drained per kill.', ar: 'المذبحة: نبضات هائلة مع شفاء 10 نقاط عند كل قتل!' };
  }
}
