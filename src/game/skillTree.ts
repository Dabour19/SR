/**
 * Skill Tree System
 * - Per-character XP formula (character level is meta-progression, separate
 *   from the in-run level system in gameEngine).
 * - Skill nodes spend skill points (1 per character level) on permanent buffs
 *   that apply at the start of every run.
 * - Signature (exclusive) weapon mapping + unlock levels.
 */

import { CharacterId, PlayerStats, WeaponType } from '../types';

/* ==================== CHARACTER LEVEL / XP FORMULA ==================== */

/** XP required to go from `level` to `level + 1`. */
export function xpForNextLevel(level: number): number {
  return Math.round(80 * Math.pow(level, 1.5));
}

/** Cumulative XP needed to reach a given level (level 1 = 0 xp). */
export function totalXpForLevel(level: number): number {
  let sum = 0;
  for (let l = 1; l < level; l++) sum += xpForNextLevel(l);
  return sum;
}

/** Highest character level (skill tree fully unlocks around here). */
export const MAX_CHARACTER_LEVEL = 30;

/** Compute the resulting level/xp after adding `amount` xp starting at (level, xp). */
export function applyXp(level: number, xp: number, amount: number): {
  level: number;
  xp: number;
  levelsGained: number;
  skillPointsGained: number;
} {
  let newLevel = level;
  let newXp = xp + Math.max(0, Math.floor(amount));
  let levelsGained = 0;
  while (newLevel < MAX_CHARACTER_LEVEL && newXp >= xpForNextLevel(newLevel)) {
    newXp -= xpForNextLevel(newLevel);
    newLevel += 1;
    levelsGained += 1;
  }
  return { level: newLevel, xp: newXp, levelsGained, skillPointsGained: levelsGained };
}

/* ==================== SIGNATURE WEAPONS ==================== */

/** One exclusive weapon per character (unlocked at character level 3). */
export const CHARACTER_EXCLUSIVE_WEAPON: Record<CharacterId, WeaponType> = {
  blade: 'blade_tempest',
  mage: 'frost_nova',
  hunter: 'poison_volley',
  paladin: 'judgement_beam',
  wraith: 'soul_scythe',
  berserker: 'blood_reaver',
};

/** Character level at which the signature weapon becomes available in-run. */
export const SIGNATURE_WEAPON_UNLOCK_LEVEL = 3;

/* ==================== SKILL NODES ==================== */

export type SkillNodeEffect =
  | { kind: 'damage'; value: number } // + damageMultiplier per rank
  | { kind: 'maxHp'; value: number } // + flat hp per rank
  | { kind: 'speed'; value: number } // + speed multiplier per rank
  | { kind: 'regen'; value: number } // + hp/sec per rank
  | { kind: 'magnet'; value: number } // + pickup radius per rank
  | { kind: 'armor'; value: number } // + flat armor per rank
  | { kind: 'cooldown'; value: number }; // + cooldown reduction (capped 0.5) per rank

export interface SkillNode {
  id: string;
  nameAr: string;
  descriptionAr: string;
  icon: string;
  maxRank: number;
  effect: SkillNodeEffect;
  /** Node ids that must have at least 1 rank before this node can be upgraded. */
  requires?: string[];
}

/**
 * Branch trees per character: 3 branches × 3 nodes.
 * `requires` creates a simple vertical chain within each branch.
 */
export const SKILL_TREES: Record<CharacterId, SkillNode[]> = {
  blade: [
    { id: 'blade_edge', nameAr: 'حدّة النصل', descriptionAr: '+8% ضرر لكل مستوى', icon: '⚔️', maxRank: 5, effect: { kind: 'damage', value: 0.08 } },
    { id: 'blade_guard', nameAr: 'درع المبارز', descriptionAr: '+15 صحة لكل مستوى', icon: '❤️', maxRank: 5, effect: { kind: 'maxHp', value: 15 } },
    { id: 'blade_guard2', nameAr: 'تقنية الصمود', descriptionAr: '+1 درع لكل مستوى', icon: '🛡️', maxRank: 3, effect: { kind: 'armor', value: 1 }, requires: ['blade_guard'] },
    { id: 'blade_swift', nameAr: 'خطوات النصل', descriptionAr: '+4% سرعة لكل مستوى', icon: '👟', maxRank: 4, effect: { kind: 'speed', value: 0.04 } },
    { id: 'blade_haste', nameAr: 'غضب سريع', descriptionAr: '-6% وقت الانتظار لكل مستوى', icon: '⏱️', maxRank: 3, effect: { kind: 'cooldown', value: 0.06 }, requires: ['blade_swift'] },
    { id: 'blade_magnet', nameAr: 'جذب الغنائم', descriptionAr: '+12 نطاق جذب لكل مستوى', icon: '🧲', maxRank: 3, effect: { kind: 'magnet', value: 12 } },
  ],
  mage: [
    { id: 'mage_power', nameAr: 'عمق السحر', descriptionAr: '+10% ضرر لكل مستوى', icon: '🔮', maxRank: 5, effect: { kind: 'damage', value: 0.1 } },
    { id: 'mage_frost', nameAr: 'قلب الجليد', descriptionAr: '+10 صحة لكل مستوى', icon: '❄️', maxRank: 5, effect: { kind: 'maxHp', value: 10 } },
    { id: 'mage_frost2', nameAr: 'هالة الجليد', descriptionAr: '+1 درع لكل مستوى', icon: '🛡️', maxRank: 3, effect: { kind: 'armor', value: 1 }, requires: ['mage_frost'] },
    { id: 'mage_haste', nameAr: 'تسارع التعويذة', descriptionAr: '-7% وقت الانتظار لكل مستوى', icon: '⏱️', maxRank: 3, effect: { kind: 'cooldown', value: 0.07 } },
    { id: 'mage_magnet', nameAr: 'سحر الجذب', descriptionAr: '+15 نطاق جذب لكل مستوى', icon: '🧲', maxRank: 3, effect: { kind: 'magnet', value: 15 }, requires: ['mage_haste'] },
    { id: 'mage_regen', nameAr: 'مياه الشفاء', descriptionAr: '+0.2 شفاء/ثانية لكل مستوى', icon: '💧', maxRank: 3, effect: { kind: 'regen', value: 0.2 } },
  ],
  hunter: [
    { id: 'hunter_swift', nameAr: 'خطى الصياد', descriptionAr: '+6% سرعة لكل مستوى', icon: '👟', maxRank: 5, effect: { kind: 'speed', value: 0.06 } },
    { id: 'hunter_vigor', nameAr: 'تحمل الصياد', descriptionAr: '+12 صحة لكل مستوى', icon: '❤️', maxRank: 5, effect: { kind: 'maxHp', value: 12 } },
    { id: 'hunter_vigor2', nameAr: 'جلد الغابة', descriptionAr: '+1 درع لكل مستوى', icon: '🛡️', maxRank: 3, effect: { kind: 'armor', value: 1 }, requires: ['hunter_vigor'] },
    { id: 'hunter_damage', nameAr: 'سهام قاتلة', descriptionAr: '+8% ضرر لكل مستوى', icon: '🏹', maxRank: 5, effect: { kind: 'damage', value: 0.08 } },
    { id: 'hunter_magnet', nameAr: 'حدس الغنائم', descriptionAr: '+14 نطاق جذب لكل مستوى', icon: '🧲', maxRank: 3, effect: { kind: 'magnet', value: 14 }, requires: ['hunter_damage'] },
    { id: 'hunter_regen', nameAr: 'شفاء الطبيعة', descriptionAr: '+0.2 شفاء/ثانية لكل مستوى', icon: '🌿', maxRank: 3, effect: { kind: 'regen', value: 0.2 } },
  ],
  paladin: [
    { id: 'paladin_fort', nameAr: 'حصانة القدّيس', descriptionAr: '+20 صحة لكل مستوى', icon: '❤️', maxRank: 5, effect: { kind: 'maxHp', value: 20 } },
    { id: 'paladin_armor', nameAr: 'دروع فولاذية', descriptionAr: '+2 درع لكل مستوى', icon: '🛡️', maxRank: 5, effect: { kind: 'armor', value: 2 }, requires: ['paladin_fort'] },
    { id: 'paladin_light', nameAr: 'نور الهالة', descriptionAr: '+7% ضرر لكل مستوى', icon: '✨', maxRank: 5, effect: { kind: 'damage', value: 0.07 } },
    { id: 'paladin_regen', nameAr: 'بركة الشفاء', descriptionAr: '+0.3 شفاء/ثانية لكل مستوى', icon: '💧', maxRank: 3, effect: { kind: 'regen', value: 0.3 } },
    { id: 'paladin_swift', nameAr: 'درع متحرك', descriptionAr: '+3% سرعة لكل مستوى', icon: '👟', maxRank: 3, effect: { kind: 'speed', value: 0.03 }, requires: ['paladin_armor'] },
    { id: 'paladin_magnet', nameAr: 'جذب النور', descriptionAr: '+12 نطاق جذب لكل مستوى', icon: '🧲', maxRank: 3, effect: { kind: 'magnet', value: 12 } },
  ],
  wraith: [
    { id: 'wraith_swift', nameAr: 'طيف عابر', descriptionAr: '+7% سرعة لكل مستوى', icon: '👟', maxRank: 5, effect: { kind: 'speed', value: 0.07 } },
    { id: 'wraith_haste', nameAr: 'لمس الظل', descriptionAr: '-7% وقت الانتظار لكل مستوى', icon: '⏱️', maxRank: 3, effect: { kind: 'cooldown', value: 0.07 }, requires: ['wraith_swift'] },
    { id: 'wraith_damage', nameAr: 'بُرهان الأرواح', descriptionAr: '+9% ضرر لكل مستوى', icon: '💀', maxRank: 5, effect: { kind: 'damage', value: 0.09 } },
    { id: 'wraith_vigor', nameAr: 'ضمير شبحي', descriptionAr: '+10 صحة لكل مستوى', icon: '❤️', maxRank: 5, effect: { kind: 'maxHp', value: 10 } },
    { id: 'wraith_magnet', nameAr: 'جذب الأرواح', descriptionAr: '+15 نطاق جذب لكل مستوى', icon: '🧲', maxRank: 3, effect: { kind: 'magnet', value: 15 }, requires: ['wraith_vigor'] },
    { id: 'wraith_regen', nameAr: 'استرداد الطيف', descriptionAr: '+0.2 شفاء/ثانية لكل مستوى', icon: '💠', maxRank: 3, effect: { kind: 'regen', value: 0.2 } },
  ],
  berserker: [
    { id: 'berserker_fury', nameAr: 'حمّى الدمار', descriptionAr: '+12% ضرر لكل مستوى', icon: '🪓', maxRank: 5, effect: { kind: 'damage', value: 0.12 } },
    { id: 'berserker_blood', nameAr: 'دم كثيف', descriptionAr: '+18 صحة لكل مستوى', icon: '❤️', maxRank: 5, effect: { kind: 'maxHp', value: 18 } },
    { id: 'berserker_blood2', nameAr: 'جلد حديدي', descriptionAr: '+2 درع لكل مستوى', icon: '🛡️', maxRank: 3, effect: { kind: 'armor', value: 2 }, requires: ['berserker_blood'] },
    { id: 'berserker_swift', nameAr: 'هجوم جامح', descriptionAr: '+5% سرعة لكل مستوى', icon: '👟', maxRank: 4, effect: { kind: 'speed', value: 0.05 } },
    { id: 'berserker_regen', nameAr: 'تدفّق الحمّى', descriptionAr: '+0.25 شفاء/ثانية لكل مستوى', icon: '🩸', maxRank: 3, effect: { kind: 'regen', value: 0.25 }, requires: ['berserker_fury'] },
    { id: 'berserker_magnet', nameAr: 'جذب النهب', descriptionAr: '+12 نطاق جذب لكل مستوى', icon: '🧲', maxRank: 3, effect: { kind: 'magnet', value: 12 } },
  ],
};

export function getSkillTree(id: CharacterId): SkillNode[] {
  return SKILL_TREES[id] || SKILL_TREES.blade;
}

/** Get current rank of a node from unlocked list ("nodeId:rank"). */
export function getNodeRank(unlockedNodes: string[], nodeId: string): number {
  for (const entry of unlockedNodes) {
    const [id, rank] = entry.split(':');
    if (id === nodeId) return parseInt(rank, 10) || 0;
  }
  return 0;
}

/** Whether a node's rank can be increased (enough points + requirements met). */
export function canUpgradeNode(
  charId: CharacterId,
  unlockedNodes: string[],
  nodeId: string,
  availablePoints: number
): { ok: boolean; error?: string } {
  const node = getSkillTree(charId).find((n) => n.id === nodeId);
  if (!node) return { ok: false, error: 'عقدة غير موجودة' };
  const rank = getNodeRank(unlockedNodes, nodeId);
  if (rank >= node.maxRank) return { ok: false, error: 'وصلت للحد الأقصى' };
  if (availablePoints < 1) return { ok: false, error: 'لا توجد نقاط مهارة' };
  if (node.requires) {
    for (const req of node.requires) {
      if (getNodeRank(unlockedNodes, req) < 1) {
        const reqNode = getSkillTree(charId).find((n) => n.id === req);
        return { ok: false, error: `يتطلب: ${reqNode?.nameAr || req}` };
      }
    }
  }
  return { ok: true };
}

/* ==================== SKILL BONUSES → RUN STATS ==================== */

/** Apply all unlocked skill-node bonuses to the run's starting stats. */
export function applySkillBonuses(
  charId: CharacterId,
  unlockedNodes: string[],
  stats: PlayerStats
): void {
  for (const node of getSkillTree(charId)) {
    const rank = getNodeRank(unlockedNodes, node.id);
    if (rank <= 0) continue;
    const e = node.effect;
    switch (e.kind) {
      case 'damage':
        stats.damageMultiplier += e.value * rank;
        break;
      case 'maxHp':
        stats.maxHp += e.value * rank;
        stats.hp += e.value * rank;
        break;
      case 'speed':
        stats.speed = Math.round(stats.speed * (1 + e.value * rank));
        break;
      case 'regen':
        stats.hpRegen += e.value * rank;
        break;
      case 'magnet':
        stats.pickupRadius += e.value * rank;
        break;
      case 'armor':
        stats.armor += e.value * rank;
        break;
      case 'cooldown':
        stats.cooldownReduction = Math.min(0.5, stats.cooldownReduction + e.value * rank);
        break;
    }
  }
}
