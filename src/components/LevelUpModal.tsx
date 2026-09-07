import React, { useMemo } from 'react';
import {
  Flame,
  Footprints,
  HeartPulse,
  Hourglass,
  Magnet,
  Orbit,
  Shield,
  ShieldAlert,
  Sparkles,
  Swords,
  Zap,
} from 'lucide-react';
import { ActivePassive, ActiveWeapon, CharacterId, UpgradeOption, WeaponType, PassiveType } from '../types';
import { WEAPON_REGISTRY, getWeaponLevelDescription } from '../game/weapons';
import { PASSIVE_REGISTRY } from '../game/passives';
import { soundEngine } from '../audio/soundEngine';

interface LevelUpModalProps {
  level: number;
  characterId: CharacterId;
  characterLevel: number;
  currentWeapons: Map<WeaponType, ActiveWeapon>;
  currentPassives: Map<PassiveType, ActivePassive>;
  onSelectUpgrade: (id: WeaponType | PassiveType, isWeapon: boolean) => void;
}

export const LevelUpModal: React.FC<LevelUpModalProps> = ({
  level,
  characterId,
  characterLevel,
  currentWeapons,
  currentPassives,
  onSelectUpgrade,
}) => {
  // Generate 3 random upgrade options
  const options: UpgradeOption[] = useMemo(() => {
    const pool: UpgradeOption[] = [];

    // Weapon options (filtered by character exclusivity + unlock level)
    for (const [wKey, def] of Object.entries(WEAPON_REGISTRY)) {
      // Exclusive weapons only appear for their character, and only after
      // the character reached the required meta level (skill tree).
      if (def.exclusiveTo && def.exclusiveTo !== characterId) continue;
      if (def.unlockLevel && characterLevel < def.unlockLevel) continue;
      const active = currentWeapons.get(wKey as WeaponType);
      const currLevel = active ? active.level : 0;
      if (currLevel < def.maxLevel) {
        const nextLevel = currLevel + 1;
        const desc = getWeaponLevelDescription(wKey as WeaponType, nextLevel);
        pool.push({
          id: wKey as WeaponType,
          isWeapon: true,
          name: def.name,
          nameAr: def.nameAr,
          level: nextLevel,
          maxLevel: def.maxLevel,
          isNew: currLevel === 0,
          description: desc.en,
          descriptionAr: desc.ar,
          icon: def.icon,
          color: '#38bdf8',
        });
      }
    }

    // Passive options
    for (const [pKey, def] of Object.entries(PASSIVE_REGISTRY)) {
      const active = currentPassives.get(pKey as PassiveType);
      const currLevel = active ? active.level : 0;
      if (currLevel < def.maxLevel) {
        const nextLevel = currLevel + 1;
        pool.push({
          id: pKey as PassiveType,
          isWeapon: false,
          name: def.name,
          nameAr: def.nameAr,
          level: nextLevel,
          maxLevel: def.maxLevel,
          isNew: currLevel === 0,
          description: `${def.description} (${def.perLevelBonus})`,
          descriptionAr: `${def.descriptionAr} (${def.perLevelBonusAr})`,
          icon: def.icon,
          color: '#34d399',
        });
      }
    }

    // Shuffle and pick 3
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    return pool.slice(0, 3);
  }, [currentWeapons, currentPassives, characterId, characterLevel]);

  const renderIcon = (iconName: string) => {
    const props = { className: 'w-8 h-8' };
    switch (iconName) {
      case 'Orbit':
        return <Orbit {...props} className="w-8 h-8 text-cyan-400" />;
      case 'Sparkles':
        return <Sparkles {...props} className="w-8 h-8 text-sky-400" />;
      case 'ShieldAlert':
        return <ShieldAlert {...props} className="w-8 h-8 text-amber-400" />;
      case 'Zap':
        return <Zap {...props} className="w-8 h-8 text-yellow-400" />;
      case 'Flame':
        return <Flame {...props} className="w-8 h-8 text-orange-400" />;
      case 'Magnet':
        return <Magnet {...props} className="w-8 h-8 text-emerald-400" />;
      case 'Footprints':
        return <Footprints {...props} className="w-8 h-8 text-lime-400" />;
      case 'Swords':
        return <Swords {...props} className="w-8 h-8 text-rose-400" />;
      case 'HeartPulse':
        return <HeartPulse {...props} className="w-8 h-8 text-red-400" />;
      case 'Shield':
        return <Shield {...props} className="w-8 h-8 text-blue-400" />;
      case 'Hourglass':
        return <Hourglass {...props} className="w-8 h-8 text-purple-400" />;
      default:
        return <Sparkles {...props} className="w-8 h-8 text-cyan-400" />;
    }
  };

  const cardThemes = [
    {
      borderColor: 'border-cyan-400',
      shadow: 'shadow-[0_10px_30px_rgba(34,211,238,0.25)]',
      iconBg: 'bg-cyan-400/20 border-cyan-400 text-cyan-300',
      titleColor: 'text-cyan-400',
      btnBg: 'bg-cyan-500 hover:bg-cyan-400 text-slate-950',
      tagBg: 'bg-cyan-400/20 border-cyan-400 text-cyan-300',
    },
    {
      borderColor: 'border-fuchsia-500',
      shadow: 'shadow-[0_10px_30px_rgba(217,70,239,0.25)]',
      iconBg: 'bg-fuchsia-500/20 border-fuchsia-500 text-fuchsia-300',
      titleColor: 'text-fuchsia-400',
      btnBg: 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white',
      tagBg: 'bg-fuchsia-500/20 border-fuchsia-500 text-fuchsia-300',
    },
    {
      borderColor: 'border-emerald-400',
      shadow: 'shadow-[0_10px_30px_rgba(52,211,153,0.25)]',
      iconBg: 'bg-emerald-400/20 border-emerald-400 text-emerald-300',
      titleColor: 'text-emerald-400',
      btnBg: 'bg-emerald-500 hover:bg-emerald-400 text-slate-950',
      tagBg: 'bg-emerald-400/20 border-emerald-400 text-emerald-300',
    },
  ];

  return (
    <div
      id="level-up-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200 overflow-y-auto"
    >
      <div className="w-full max-w-4xl flex flex-col items-center gap-6 sm:gap-8 my-auto">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-4xl sm:text-6xl font-black italic tracking-tighter text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
            LEVEL UP!
          </h2>
          <div className="inline-flex items-center gap-2 mt-2 px-4 py-1 rounded-full bg-[#1e293b] border border-[#334155] text-cyan-400 font-bold text-xs uppercase tracking-widest shadow-md">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>المستوى {level} • اختر ترقية لتعزيز قوتك</span>
          </div>
        </div>

        {/* Upgrade Cards Grid */}
        <div className="w-full">
          {options.length === 0 ? (
            <div className="p-8 bg-[#1e293b] border-2 border-cyan-400 rounded-2xl text-center text-slate-200 shadow-xl max-w-md mx-auto">
              <p className="text-base font-bold">لقد وصلت لكافة الترقيات القصوى! استمر في البقاء!</p>
              <button
                onClick={() => onSelectUpgrade('spinning_blades', true)}
                className="mt-4 px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-lg uppercase tracking-tight transition"
              >
                متابعة اللعب
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 w-full">
              {options.map((opt, idx) => {
                const theme = cardThemes[idx % cardThemes.length];
                return (
                  <div
                    key={opt.id}
                    id={`upgrade-option-${opt.id}`}
                    onClick={() => {
                      soundEngine.playGemPickup();
                      onSelectUpgrade(opt.id, opt.isWeapon);
                    }}
                    className={`bg-[#1e293b] border-2 ${theme.borderColor} ${theme.shadow} p-5 sm:p-6 rounded-2xl flex flex-col items-center justify-between gap-4 transform hover:scale-105 transition-all duration-200 cursor-pointer group text-center select-none`}
                  >
                    {/* Top: Icon & Rank */}
                    <div className="flex flex-col items-center gap-3 w-full">
                      <div
                        className={`w-16 h-16 rounded-full flex items-center justify-center border ${theme.iconBg} shadow-inner transition-transform group-hover:scale-110`}
                      >
                        {renderIcon(opt.icon)}
                      </div>

                      <div className="text-center">
                        <h3 className={`font-bold text-lg sm:text-xl ${theme.titleColor}`}>
                          {opt.nameAr}
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5 uppercase font-mono font-semibold tracking-wider">
                          {opt.name}
                        </p>
                        <div className="mt-1.5 inline-block">
                          {opt.isNew ? (
                            <span className="bg-emerald-500/20 border border-emerald-400 text-emerald-300 text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">
                              NEW WEAPON • جديد!
                            </span>
                          ) : (
                            <span className={`border ${theme.tagBg} text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider`}>
                              RANK {opt.level} / {opt.maxLevel}
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed min-h-[48px] flex items-center justify-center">
                        {opt.descriptionAr}
                      </p>
                    </div>

                    {/* Button */}
                    <button
                      type="button"
                      className={`mt-2 w-full py-2.5 ${theme.btnBg} font-black rounded-lg uppercase text-xs sm:text-sm tracking-tighter transition-colors shadow-md group-hover:brightness-110`}
                    >
                      اختيار الترقية (Select)
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Subtext */}
        <p className="text-slate-400 font-mono text-xs tracking-wider animate-pulse">
          ★ CHOOSE YOUR POWER TO RESUME BATTLE ★
        </p>
      </div>
    </div>
  );
};
