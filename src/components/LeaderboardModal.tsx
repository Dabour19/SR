import React, { useState } from 'react';
import {
  X,
  Trophy,
  Timer,
  Skull,
  Sparkles,
  Crown,
} from 'lucide-react';
import {
  AVATAR_OPTIONS,
  TIERS_CONFIG,
  playerAuthService,
} from '../services/playerAuthService';
import { LeaderboardFilter } from '../types';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuthModal?: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  onOpenAuthModal,
}) => {
  const [filter, setFilter] = useState<LeaderboardFilter>('score');

  if (!isOpen) return null;

  const records = playerAuthService.getLeaderboard(filter);
  const currentUser = playerAuthService.getCurrentUser();

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentRankIndex = records.findIndex((r) => r.id === currentUser.id);
  const currentRankPosition = currentRankIndex >= 0 ? currentRankIndex + 1 : null;

  const getRankBadge = (index: number) => {
    if (index === 0) {
      return (
        <div className="w-8 h-8 rounded-xl bg-yellow-500/20 border border-yellow-400 text-yellow-400 flex items-center justify-center font-black text-sm shadow-[0_0_12px_rgba(234,179,8,0.4)]">
          🥇
        </div>
      );
    }
    if (index === 1) {
      return (
        <div className="w-8 h-8 rounded-xl bg-slate-300/20 border border-slate-300 text-slate-200 flex items-center justify-center font-black text-sm shadow-[0_0_12px_rgba(203,213,225,0.3)]">
          🥈
        </div>
      );
    }
    if (index === 2) {
      return (
        <div className="w-8 h-8 rounded-xl bg-amber-700/30 border border-amber-600 text-amber-300 flex items-center justify-center font-black text-sm shadow-[0_0_12px_rgba(180,83,9,0.3)]">
          🥉
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-xl bg-[#0f172a] border border-[#334155] text-slate-400 flex items-center justify-center font-mono font-bold text-xs">
        #{index + 1}
      </div>
    );
  };

  return (
    <div
      id="leaderboard-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-150 overflow-y-auto"
    >
      <div className="w-full max-w-2xl bg-[#1e293b] border-2 border-cyan-400/40 rounded-3xl p-5 sm:p-7 shadow-[0_10px_30px_rgba(34,211,238,0.2)] text-right my-8 max-h-[92vh] flex flex-col relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-cyan-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-yellow-400/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#334155] pb-4 mb-4 shrink-0">
          <button
            id="btn-close-leaderboard"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-[#0f172a] hover:bg-[#334155] text-slate-400 hover:text-white border border-[#334155] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-black italic tracking-tight text-white flex items-center gap-2">
                <Trophy className="w-6 h-6 text-yellow-400" />
                <span>لوحة الشرف وتصنيف الأبطال</span>
              </h2>
              <p className="text-xs font-mono font-semibold uppercase tracking-wider text-cyan-400">
                SURVIVORS HALL OF FAME & LEADERBOARD
              </p>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-[#0f172a] p-1.5 rounded-2xl border border-[#334155] mb-4 shrink-0 overflow-x-auto">
          <button
            id="filter-score"
            onClick={() => setFilter('score')}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center justify-center gap-1 ${
              filter === 'score'
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : 'text-slate-300 hover:bg-[#1e293b]'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            <span>الترتيب العام</span>
          </button>

          <button
            id="filter-time"
            onClick={() => setFilter('time')}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center justify-center gap-1 ${
              filter === 'time'
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : 'text-slate-300 hover:bg-[#1e293b]'
            }`}
          >
            <Timer className="w-3.5 h-3.5" />
            <span>أطول صمود (20 د)</span>
          </button>

          <button
            id="filter-kills"
            onClick={() => setFilter('kills')}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center justify-center gap-1 ${
              filter === 'kills'
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : 'text-slate-300 hover:bg-[#1e293b]'
            }`}
          >
            <Skull className="w-3.5 h-3.5" />
            <span>أكثر الوحوش إبادة</span>
          </button>

          <button
            id="filter-level"
            onClick={() => setFilter('level')}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center justify-center gap-1 ${
              filter === 'level'
                ? 'bg-cyan-500 text-slate-950 shadow-md'
                : 'text-slate-300 hover:bg-[#1e293b]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>أعلى مستوى</span>
          </button>
        </div>

        {/* Current User Standings Quick Pin */}
        <div className="bg-[#0f172a] border border-cyan-400/40 rounded-2xl p-3 mb-3 flex items-center justify-between shadow-inner shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-xl shadow-[0_0_10px_rgba(34,211,238,0.2)]">
              {AVATAR_OPTIONS.find((a) => a.id === currentUser.avatar)?.icon || '🗡️'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white">{currentUser.username}</span>
                <span className="text-[10px] bg-cyan-400/20 text-cyan-300 font-bold px-1.5 py-0.2 rounded border border-cyan-400/40">
                  حسابك الحالي
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                رتبتك: <strong className="text-yellow-400">{currentUser.title}</strong> • أفضل صمود: <span className="font-mono font-bold text-amber-300">{formatTime(currentUser.stats.bestSurvivalTime)}</span>
              </div>
            </div>
          </div>

          <div className="text-left flex items-center gap-2">
            <div>
              <div className="text-[10px] text-slate-400 text-right">موقعك بالقائمة:</div>
              <div className="text-sm sm:text-base font-black text-cyan-300 font-mono text-right">
                {currentRankPosition ? `#${currentRankPosition}` : 'غير مصنف بعد'}
              </div>
            </div>
            {onOpenAuthModal && (
              <button
                onClick={onOpenAuthModal}
                className="text-xs bg-[#1e293b] hover:bg-[#334155] text-slate-200 border border-[#334155] px-2.5 py-1.5 rounded-lg transition cursor-pointer"
              >
                تعديل الحساب
              </button>
            )}
          </div>
        </div>

        {/* Leaderboard Table / List */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2 mb-4 max-h-[50vh]">
          {records.map((rec, idx) => {
            const tierInfo = TIERS_CONFIG[rec.tier] || TIERS_CONFIG.bronze;
            const avatarInfo = AVATAR_OPTIONS.find((a) => a.id === rec.avatar) || AVATAR_OPTIONS[0];

            return (
              <div
                key={rec.id}
                className={`flex items-center justify-between p-3 rounded-2xl border transition-all duration-150 ${
                  rec.isCurrentPlayer
                    ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.25)]'
                    : idx === 0
                    ? 'bg-yellow-950/20 border-yellow-500/40'
                    : 'bg-[#0f172a] border-[#334155] hover:border-slate-500'
                }`}
              >
                {/* Left side: Rank & Avatar & Name */}
                <div className="flex items-center gap-3">
                  {getRankBadge(idx)}

                  <div className="w-9 h-9 rounded-xl bg-[#1e293b] border border-[#334155] flex items-center justify-center text-lg shrink-0">
                    {avatarInfo.icon}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-black text-white">
                        {rec.playerName}
                      </span>
                      {rec.victory && (
                        <span className="text-[10px] bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 px-1.5 py-0.2 rounded-full font-bold">
                          👑 نصر
                        </span>
                      )}
                      {rec.isCurrentPlayer && (
                        <span className="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 px-1.5 py-0.2 rounded font-bold">
                          أنت
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span style={{ color: tierInfo.color }} className="font-bold">
                        {tierInfo.labelAr}
                      </span>
                      <span>•</span>
                      <span>مستوى {rec.level}</span>
                    </div>
                  </div>
                </div>

                {/* Right side: Key Metric Stats */}
                <div className="text-left flex items-center gap-3 sm:gap-5">
                  <div className="text-right hidden sm:block">
                    <div className="text-[10px] text-slate-400 flex items-center justify-end gap-1">
                      <Timer className="w-3 h-3 text-amber-400" />
                      <span>وقت الصمود</span>
                    </div>
                    <div className="text-xs font-mono font-bold text-amber-300">
                      {formatTime(rec.timeSurvived)}
                    </div>
                  </div>

                  <div className="text-right hidden sm:block">
                    <div className="text-[10px] text-slate-400 flex items-center justify-end gap-1">
                      <Skull className="w-3 h-3 text-rose-400" />
                      <span>الوحوش</span>
                    </div>
                    <div className="text-xs font-mono font-bold text-rose-300">
                      {rec.kills.toLocaleString()}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] text-slate-400">مجموع النقاط:</div>
                    <div className="text-sm sm:text-base font-black font-mono text-yellow-400">
                      {rec.score.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-[#334155] pt-3 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400">
            يتم تحديث الترتيب تلقائياً فور انتهاء كل جولة صمود
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
