import React from 'react';
import {
  Maximize,
  Minimize,
  Pause,
  Skull,
  Timer,
  Volume2,
  VolumeX,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { ActivePassive, ActiveWeapon, EnemyEntity, PassiveType, WeaponType } from '../types';

interface GameHUDProps {
  hp: number;
  maxHp: number;
  xp: number;
  nextLevelXp: number;
  level: number;
  timeSurvived: number;
  kills: number;
  activeBoss: EnemyEntity | null;
  weapons: Map<WeaponType, ActiveWeapon>;
  passives: Map<PassiveType, ActivePassive>;
  isMuted: boolean;
  isFullscreen: boolean;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onPause: () => void;
  onOpenLeaderboard: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  hp,
  maxHp,
  xp,
  nextLevelXp,
  level,
  timeSurvived,
  kills,
  activeBoss,
  weapons,
  passives,
  isMuted,
  isFullscreen,
  onToggleMute,
  onToggleFullscreen,
  onPause,
  onOpenLeaderboard,
}) => {
  // Format MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const xpPercentage = Math.min(100, Math.max(0, (xp / nextLevelXp) * 100));
  const hpPercentage = Math.min(100, Math.max(0, (hp / maxHp) * 100));

  return (
    <div className="pointer-events-none fixed inset-0 flex flex-col justify-between p-2 sm:p-4 select-none z-30 font-sans">
      {/* Top Section */}
      <div className="w-full flex flex-col gap-2">
        {/* Top Control Bar with Badges, Timer, and Controls */}
        <div className="flex items-center justify-between gap-1.5 sm:gap-3 px-1">
          {/* Left: Badges (Kills & Level) */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Kills Badge */}
            <div className="bg-[#1e293b]/95 border border-[#334155] px-2.5 sm:px-3.5 py-1 rounded-full text-[11px] sm:text-xs font-bold flex items-center gap-1.5 text-white shadow-md">
              <Skull className="w-3.5 h-3.5 text-red-400" />
              <span className="font-mono tracking-tight">{kills.toLocaleString()}</span>
            </div>

            {/* Level Badge */}
            <div className="bg-[#1e293b]/95 border border-[#334155] px-2.5 sm:px-3.5 py-1 rounded-full text-[11px] sm:text-xs font-bold flex items-center gap-1.5 text-white shadow-md">
              <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
              <span className="font-mono tracking-tight">LVL {level}</span>
            </div>
          </div>

          {/* Center: Monospace Timer with Deep Drop Shadow */}
          <div className="text-xl sm:text-3xl font-mono font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)] tracking-wider">
            {formatTime(timeSurvived)}
          </div>

          {/* Right: Health Bar & Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* HP Bar Container */}
            <div className="flex items-center gap-1.5 sm:gap-2 bg-[#1e293b]/90 border border-[#334155] px-2 sm:px-3 py-1 sm:py-1.5 rounded-full shadow-md">
              <div className="w-16 sm:w-32 h-2.5 sm:h-3 bg-[#0f172a] rounded-full overflow-hidden border border-[#334155] shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-blue-400 to-cyan-400 shadow-[0_0_10px_#22d3ee] transition-all duration-150"
                  style={{ width: `${hpPercentage}%` }}
                />
              </div>
              <span className="text-[10px] sm:text-xs font-mono font-bold text-cyan-300 whitespace-nowrap">
                {Math.round(hp)}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5">
              <button
                id="btn-hud-leaderboard"
                onClick={onOpenLeaderboard}
                title="لوحة الصدارة والتصنيف"
                className="flex items-center justify-center w-8 h-8 sm:w-auto sm:px-2.5 sm:py-1.5 rounded-xl bg-[#1e293b] hover:bg-cyan-600/30 border border-[#334155] hover:border-cyan-400 text-white text-xs font-bold shadow-md transition cursor-pointer"
              >
                <Trophy className="w-4 h-4 text-yellow-400" />
                <span className="hidden sm:inline mr-1">التصنيف</span>
              </button>

              <button
                id="btn-toggle-sound"
                onClick={onToggleMute}
                title={isMuted ? 'تشغيل الصوت' : 'كتم الصوت'}
                className="flex items-center justify-center w-8 h-8 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-slate-200 border border-[#334155] transition shadow-md cursor-pointer"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
              </button>

              <button
                id="btn-toggle-fullscreen"
                onClick={onToggleFullscreen}
                title="ملء الشاشة"
                className="items-center justify-center w-8 h-8 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-slate-200 border border-[#334155] transition shadow-md hidden sm:flex cursor-pointer"
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>

              <button
                id="btn-pause-game"
                onClick={onPause}
                title="إيقاف مؤقت"
                className="flex items-center justify-center w-8 h-8 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-amber-400 border border-[#334155] transition shadow-md cursor-pointer"
              >
                <Pause className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Full-width Glowing XP Progress Bar */}
        <div className="w-full h-2.5 sm:h-3 bg-[#1e293b] rounded-full overflow-hidden border border-[#334155] shadow-inner relative flex items-center">
          <div
            className="h-full bg-gradient-to-r from-fuchsia-600 via-pink-500 to-purple-500 shadow-[0_0_15px_#d946ef] transition-all duration-150"
            style={{ width: `${xpPercentage}%` }}
          />
          <div className="absolute inset-0 flex items-center justify-between px-2.5 text-[9px] sm:text-[10px] font-mono font-bold text-white drop-shadow pointer-events-none">
            <span className="flex items-center gap-1 text-fuchsia-200">
              <Sparkles className="w-3 h-3 text-fuchsia-300" />
              XP
            </span>
            <span className="text-white/90">
              {xp} / {nextLevelXp} XP ({Math.round(xpPercentage)}%)
            </span>
          </div>
        </div>

        {/* Boss Active Alert Bar */}
        {activeBoss && (
          <div className="w-full max-w-md mx-auto bg-[#1e293b]/95 border border-rose-500/60 rounded-xl p-2 sm:p-2.5 text-center animate-pulse shadow-[0_0_20px_rgba(244,63,94,0.3)]">
            <div className="flex items-center justify-between text-xs font-bold text-rose-300 mb-1 px-1">
              <span className="flex items-center gap-1.5">
                <Skull className="w-3.5 h-3.5 text-rose-400" />
                ⚠️ {activeBoss.bossNameAr || activeBoss.bossName || 'زعيم نشط!'}
              </span>
              <span className="font-mono text-[11px] sm:text-xs">{Math.max(0, Math.round(activeBoss.hp))} / {activeBoss.maxHp} HP</span>
            </div>
            <div className="w-full h-2 sm:h-2.5 bg-[#0f172a] rounded-full overflow-hidden border border-[#334155]">
              <div
                className="h-full bg-gradient-to-r from-rose-600 via-red-500 to-amber-400 shadow-[0_0_10px_#f43f5e] transition-all duration-100"
                style={{ width: `${Math.max(0, (activeBoss.hp / activeBoss.maxHp) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Section: Active Inventory */}
      <div className="w-full flex items-end justify-end pointer-events-none">
        {/* Right side: Equipped Weapons and Passives Badges with Vibrant Palette glow */}
        <div className="pointer-events-auto flex flex-col gap-1.5 items-end">
          {/* Weapons */}
          <div className="flex items-center gap-2 bg-[#1e293b]/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-[#334155] shadow-lg">
            <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider ml-1">الأسلحة:</span>
            {(Array.from(weapons.values()) as ActiveWeapon[]).map((w: ActiveWeapon) => (
              <div
                key={w.id}
                className="relative w-8 h-8 rounded-xl bg-[#0f172a] border border-cyan-400/50 shadow-[0_0_8px_rgba(34,211,238,0.25)] flex items-center justify-center text-cyan-300 text-xs font-mono font-bold"
                title={`${w.id} (Lvl ${w.level})`}
              >
                {w.id === 'spinning_blades' && '⚔️'}
                {w.id === 'arcane_burst' && '🔮'}
                {w.id === 'holy_aura' && '🛡️'}
                {w.id === 'lightning_strike' && '⚡'}
                {w.id === 'fire_wand' && '🔥'}
                <span className="absolute -bottom-1 -left-1 bg-cyan-400 text-slate-950 text-[9px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-black">
                  {w.level}
                </span>
              </div>
            ))}
          </div>

          {/* Passives */}
          {passives.size > 0 && (
            <div className="flex items-center gap-2 bg-[#1e293b]/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-[#334155] shadow-lg">
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider ml-1">التعزيزات:</span>
              {(Array.from(passives.values()) as ActivePassive[]).map((p: ActivePassive) => (
                <div
                  key={p.id}
                  className="relative w-7 h-7 rounded-xl bg-[#0f172a] border border-emerald-400/50 shadow-[0_0_8px_rgba(52,211,153,0.25)] flex items-center justify-center text-emerald-300 text-xs font-mono font-bold"
                  title={`${p.id} (Lvl ${p.level})`}
                >
                  {p.id === 'magnet' && '🧲'}
                  {p.id === 'swift_boots' && '👟'}
                  {p.id === 'might' && '🗡️'}
                  {p.id === 'vitality' && '❤️'}
                  {p.id === 'armor' && '🛡️'}
                  {p.id === 'haste' && '⏳'}
                  <span className="absolute -bottom-1 -left-1 bg-emerald-400 text-slate-950 text-[8px] w-3.5 h-3.5 rounded-full flex items-center justify-center font-black">
                    {p.level}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
