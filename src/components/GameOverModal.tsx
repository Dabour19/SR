import React, { useEffect, useState } from 'react';
import { Trophy, Skull, Timer, Swords, Sparkles, RotateCcw } from 'lucide-react';
import { GameRunStats } from '../types';
import { playerAuthService, TierInfo } from '../services/playerAuthService';

interface GameOverModalProps {
  stats: GameRunStats;
  coinsEarned?: number;
  onRestart: () => void;
  onOpenLeaderboard: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  stats,
  coinsEarned,
  onRestart,
  onOpenLeaderboard,
}) => {
  const [bestTime, setBestTime] = useState<number>(0);
  const [bestKills, setBestKills] = useState<number>(0);
  const [runResult, setRunResult] = useState<{
    score: number;
    isNewBest: boolean;
    tier: TierInfo;
    rankPosition: number;
  } | null>(null);

  useEffect(() => {
    try {
      // Record run in player account & update ranking
      const result = playerAuthService.recordRun(stats);
      setRunResult(result);

      const savedTime = parseInt(localStorage.getItem('survivor_best_time') || '0', 10);
      const savedKills = parseInt(localStorage.getItem('survivor_best_kills') || '0', 10);

      const newBestTime = Math.max(savedTime, stats.timeSurvived);
      const newBestKills = Math.max(savedKills, stats.enemiesKilled);

      localStorage.setItem('survivor_best_time', newBestTime.toString());
      localStorage.setItem('survivor_best_kills', newBestKills.toString());

      setBestTime(newBestTime);
      setBestKills(newBestKills);
    } catch (e) {
      console.error(e);
    }
  }, [stats]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isVictory = stats.victory;
  const currentUser = playerAuthService.getCurrentUser();

  return (
    <div
      id="game-over-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-lg bg-[#1e293b] border-2 border-cyan-400/40 rounded-3xl p-6 sm:p-8 shadow-[0_10px_30px_rgba(34,211,238,0.2)] text-center relative overflow-hidden">
        {/* Header Badge */}
        <div className="mb-4">
          {isVictory ? (
            <div className="inline-flex items-center gap-2 bg-yellow-500/20 border border-yellow-400 text-yellow-300 font-bold px-4 py-1.5 rounded-full text-sm shadow-[0_0_15px_rgba(234,179,8,0.25)]">
              <Trophy className="w-4 h-4 text-yellow-400" />
              نصر أسطوري! صمدت لـ 20 دقيقة كاملة!
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 bg-rose-500/20 border border-rose-400 text-rose-300 font-bold px-4 py-1.5 rounded-full text-sm shadow-[0_0_15px_rgba(244,63,94,0.25)]">
              <Skull className="w-4 h-4 text-rose-400" />
              سقط البطل في المعركة (انتهت الجولة)
            </div>
          )}

          <h2 className="text-3xl sm:text-4xl font-black italic tracking-tighter text-white mt-3 drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
            {isVictory ? '👑 أسطورة البقاء' : '💀 انتهت المحاولة'}
          </h2>
        </div>

        {/* Player Rank & Score Box */}
        {runResult && (
          <div className="bg-[#0f172a] border border-cyan-500/30 rounded-2xl p-3 mb-5 text-right shadow-inner">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🏆</span>
                <div>
                  <div className="text-xs font-bold text-white">
                    نقاط الجولة: <span className="font-mono text-yellow-400 font-black">{runResult.score.toLocaleString()}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    اللاعب: <strong className="text-cyan-300">{currentUser.username}</strong> • رتبتك:{' '}
                    <span style={{ color: runResult.tier.color }} className="font-bold">
                      {runResult.tier.labelAr}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-left">
                <div className="text-[10px] text-slate-400">الترتيب بقائمة الشرف:</div>
                <div className="text-base font-mono font-black text-cyan-300">
                  {runResult.rankPosition > 0 ? `#${runResult.rankPosition}` : '-'}
                </div>
              </div>
            </div>
            {runResult.isNewBest && (
              <div className="mt-2 pt-1.5 border-t border-[#334155] text-center text-xs font-bold text-emerald-400">
                🔥 رقم قياسي شخصي جديد! تم تحديث تصنيفك العام!
              </div>
            )}
            {coinsEarned !== undefined && (
              <div className="mt-2 pt-1.5 border-t border-[#334155] text-center text-xs font-bold text-amber-300">
                🪙 ربحت {coinsEarned.toLocaleString()} عملة من هذه الجولة!
              </div>
            )}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6 text-right">
          {/* Survival Time */}
          <div className="bg-[#0f172a] p-3.5 rounded-2xl border border-[#334155] shadow-inner">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Timer className="w-4 h-4 text-amber-400" />
              <span>وقت الصمود:</span>
            </div>
            <div className="text-xl sm:text-2xl font-mono font-black text-amber-300">
              {formatTime(stats.timeSurvived)}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
              الأفضل: {formatTime(bestTime)}
            </div>
          </div>

          {/* Enemies Killed */}
          <div className="bg-[#0f172a] p-3.5 rounded-2xl border border-[#334155] shadow-inner">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Skull className="w-4 h-4 text-rose-400" />
              <span>الوحوش المهزومة:</span>
            </div>
            <div className="text-xl sm:text-2xl font-mono font-black text-rose-300">
              {stats.enemiesKilled}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
              الأفضل: {bestKills}
            </div>
          </div>

          {/* Level Reached */}
          <div className="bg-[#0f172a] p-3.5 rounded-2xl border border-[#334155] shadow-inner">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>المستوى النهائي:</span>
            </div>
            <div className="text-xl sm:text-2xl font-mono font-black text-cyan-300">
              مستوى {stats.level}
            </div>
          </div>

          {/* Damage Dealt */}
          <div className="bg-[#0f172a] p-3.5 rounded-2xl border border-[#334155] shadow-inner">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Swords className="w-4 h-4 text-emerald-400" />
              <span>إجمالي الضرر:</span>
            </div>
            <div className="text-xl sm:text-2xl font-mono font-black text-emerald-300">
              {stats.damageDealt.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            id="btn-retry-game"
            onClick={onRestart}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-black text-base uppercase tracking-tight shadow-[0_0_20px_rgba(34,211,238,0.35)] transition cursor-pointer"
          >
            <RotateCcw className="w-5 h-5" />
            جولة جديدة (Play Again)
          </button>

          <button
            id="btn-open-leaderboard"
            onClick={onOpenLeaderboard}
            className="flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl bg-[#0f172a] hover:bg-cyan-500/20 text-cyan-300 font-bold text-sm border border-cyan-500/40 shadow-md transition cursor-pointer"
          >
            <Trophy className="w-4 h-4 text-yellow-400" />
            <span>عرض التصنيف</span>
          </button>
        </div>
      </div>
    </div>
  );
};
