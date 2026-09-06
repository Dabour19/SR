import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Play,
  Trophy,
  Skull,
  Timer,
  Volume2,
  VolumeX,
  Smartphone,
  Sparkles,
  Swords,
  Shield,
  HelpCircle,
  User,
  Medal,
} from 'lucide-react';
import { soundEngine } from './audio/soundEngine';
import { GameEngine } from './game/gameEngine';
import {
  ActivePassive,
  ActiveWeapon,
  EnemyEntity,
  GameRunStats,
  PassiveType,
  WeaponType,
} from './types';
import { GameHUD } from './components/GameHUD';
import { VirtualJoystick } from './components/VirtualJoystick';
import { LevelUpModal } from './components/LevelUpModal';
import { PauseModal } from './components/PauseModal';
import { GameOverModal } from './components/GameOverModal';
import { AuthModal } from './components/AuthModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { GooglePlayExportModal } from './components/GooglePlayExportModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { playerAuthService } from './services/playerAuthService';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // App & Game State
  const [inGame, setInGame] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [levelUpLevel, setLevelUpLevel] = useState<number | null>(null);
  const [gameOverStats, setGameOverStats] = useState<GameRunStats | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [showGooglePlayModal, setShowGooglePlayModal] = useState(false);
  const [playerUpdateKey, setPlayerUpdateKey] = useState(0);
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  // Audio & Display
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // HUD Stats (synced from engine)
  const [hudStats, setHudStats] = useState({
    hp: 100,
    maxHp: 100,
    xp: 0,
    nextLevelXp: 12,
    level: 1,
    timeSurvived: 0,
    kills: 0,
    activeBoss: null as EnemyEntity | null,
  });

  // Local storage high scores
  const [bestTime, setBestTime] = useState(0);
  const [bestKills, setBestKills] = useState(0);

  // Joystick Opacity (متوازنة وخفيفة بنسبة 40% كافتراضي مع حفظ التفضيل)
  const [joystickOpacity, setJoystickOpacity] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('survivor_joystick_opacity');
      if (saved !== null) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 0.1 && parsed <= 1.0) {
          return parsed;
        }
      }
    } catch {}
    return 0.4;
  });

  const handleJoystickOpacityChange = useCallback((newOpacity: number) => {
    const clamped = Math.max(0.1, Math.min(1.0, Math.round(newOpacity * 100) / 100));
    setJoystickOpacity(clamped);
    try {
      localStorage.setItem('survivor_joystick_opacity', clamped.toString());
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const savedTime = parseInt(localStorage.getItem('survivor_best_time') || '0', 10);
      const savedKills = parseInt(localStorage.getItem('survivor_best_kills') || '0', 10);
      setBestTime(savedTime);
      setBestKills(savedKills);
    } catch {}
  }, []);

  // Format MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Level Up Callback
  const handleLevelUp = useCallback((lvl: number) => {
    setLevelUpLevel(lvl);
  }, []);

  // Game Over Callback
  const handleGameOver = useCallback((stats: GameRunStats) => {
    setGameOverStats(stats);
    try {
      const savedTime = parseInt(localStorage.getItem('survivor_best_time') || '0', 10);
      const savedKills = parseInt(localStorage.getItem('survivor_best_kills') || '0', 10);
      setBestTime(Math.max(savedTime, stats.timeSurvived));
      setBestKills(Math.max(savedKills, stats.enemiesKilled));
    } catch {}
  }, []);

  // Stats Update Callback from Engine
  const handleStatsUpdate = useCallback((stats: typeof hudStats) => {
    setHudStats(stats);
  }, []);

  // Initialize Game Engine when canvas mounts
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Canvas backing-store sizing lives in the engine (capped DPR for
    // performance); we just notify it on window resize.
    const resizeCanvas = () => {
      engineRef.current?.resize();
    };

    window.addEventListener('resize', resizeCanvas);

    const engine = new GameEngine(canvas, {
      onLevelUp: handleLevelUp,
      onGameOver: handleGameOver,
      onStatsUpdate: handleStatsUpdate,
    });
    engineRef.current = engine;
    engine.start();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      engine.destroy();
    };
  }, [handleGameOver, handleLevelUp, handleStatsUpdate]);

  // Start game
  const handleStartGame = () => {
    soundEngine.enableAudio();
    if (engineRef.current) {
      engineRef.current.initNewGame();
    }
    setGameOverStats(null);
    setLevelUpLevel(null);
    setIsPaused(false);
    setInGame(true);
  };

  // Pause / Resume
  const handleTogglePause = () => {
    if (!engineRef.current) return;
    if (isPaused) {
      engineRef.current.resume();
      setIsPaused(false);
    } else {
      engineRef.current.pause();
      setIsPaused(true);
    }
  };

  // Apply Upgrade
  const handleSelectUpgrade = (id: WeaponType | PassiveType, isWeapon: boolean) => {
    if (engineRef.current) {
      engineRef.current.applyUpgrade(id, isWeapon);
    }
    setLevelUpLevel(null);
  };

  // Sound toggle
  const handleToggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    soundEngine.setMuted(newMuted);
  };

  // Fullscreen toggle
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  // Virtual Joystick input
  const handleJoystickMove = useCallback((x: number, y: number) => {
    if (engineRef.current) {
      engineRef.current.setJoystickVector(x, y);
    }
  }, []);

  return (
    <main
      id="game-root"
      className="relative w-screen h-screen overflow-hidden bg-[#0f172a] text-white font-sans select-none touch-none"
    >
      {/* Ambient Grid Pattern from Vibrant Palette */}
      <div
        className="pointer-events-none absolute inset-0 opacity-15 z-0"
        style={{
          backgroundImage: 'radial-gradient(#22d3ee 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* 2D Canvas */}
      <canvas
        id="game-canvas"
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block cursor-crosshair z-0"
      />

      {/* Offline Status Toast */}
      <OfflineIndicator />

      {/* Main Menu / Start Screen */}
      {!inGame && (
        <div
          id="main-menu-overlay"
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/65 backdrop-blur-md p-4 animate-in fade-in duration-300"
        >
          <div className="w-full max-w-lg bg-[#1e293b]/95 border-2 border-cyan-400/40 rounded-3xl p-6 sm:p-8 shadow-[0_10px_30px_rgba(34,211,238,0.2)] text-center relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-cyan-400/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-fuchsia-500/15 rounded-full blur-3xl pointer-events-none" />

            {/* Top Bar with PWA install & Sound */}
            <div className="flex items-center justify-between gap-2 mb-6">
              <PWAInstallButton />

              <div className="flex items-center gap-2">
                <button
                  id="btn-menu-mute"
                  onClick={handleToggleMute}
                  title={isMuted ? 'تشغيل الصوت' : 'كتم الصوت'}
                  className="p-2 rounded-xl bg-[#0f172a] hover:bg-[#334155] text-slate-300 border border-[#334155] transition cursor-pointer shadow-md"
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
                </button>

                <button
                  id="btn-menu-how-to-play"
                  onClick={() => setShowHowToPlay(!showHowToPlay)}
                  className="p-2 rounded-xl bg-[#0f172a] hover:bg-[#334155] text-slate-300 border border-[#334155] transition cursor-pointer shadow-md"
                  title="كيفية اللعب"
                >
                  <HelpCircle className="w-4 h-4 text-cyan-400" />
                </button>
              </div>
            </div>

            {/* Game Logo & Title */}
            <div className="mb-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/40 text-cyan-300 text-xs font-bold mb-3 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>2D Top-Down Auto-Shooter / Rogue-lite</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-black italic tracking-tighter text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
                SURVIVOR ROGUE
              </h1>
              <p className="text-sm font-semibold text-cyan-400 mt-1 uppercase tracking-wider">
                صمود الأبطال: معركة الـ 20 دقيقة
              </p>
            </div>

            {/* Active Player Profile Banner */}
            {(() => {
              const currentUser = playerAuthService.getCurrentUser();
              const currentTier = playerAuthService.getTierInfo(currentUser.tier);
              return (
                <div
                  id="player-profile-pill"
                  onClick={() => setShowAuthModal(true)}
                  className="flex items-center justify-between bg-[#0f172a] hover:bg-[#1e293b] p-2.5 px-3.5 rounded-2xl border border-[#334155] hover:border-cyan-400/50 mb-5 transition cursor-pointer group shadow-inner text-right"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-600/30 border border-cyan-400/40 flex items-center justify-center text-xl shadow-[0_0_10px_rgba(34,211,238,0.2)]">
                      {currentUser.avatar}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-white group-hover:text-cyan-300 transition">
                          {currentUser.username}
                        </span>
                        {currentUser.isGuest ? (
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded-md border border-slate-700">
                            ضيف
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 bg-emerald-950 text-emerald-400 rounded-md border border-emerald-700 font-bold">
                            عضو مسجل
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <span>الرتبة:</span>
                        <span style={{ color: currentTier.color }} className="font-bold">
                          {currentTier.labelAr}
                        </span>
                        <span className="text-slate-600">•</span>
                        <span className="font-mono text-cyan-300 font-bold">{currentUser.rankScore.toLocaleString()} نقطة</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-left flex items-center gap-1 text-xs text-cyan-400 font-bold group-hover:translate-x-[-3px] transition">
                    <span>{currentUser.isGuest ? 'تسجيل دخول' : 'الملف الشخصي'}</span>
                    <User className="w-4 h-4 text-cyan-400" />
                  </div>
                </div>
              );
            })()}

            {/* High Scores Banner */}
            <div className="grid grid-cols-2 gap-3 bg-[#0f172a] p-3.5 rounded-2xl border border-[#334155] mb-5 text-right shadow-inner">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                  <Timer className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">أطول صمود:</div>
                  <div className="text-sm sm:text-base font-mono font-black text-amber-300">
                    {formatTime(bestTime)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.2)]">
                  <Skull className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">أعلى وحوش:</div>
                  <div className="text-sm sm:text-base font-mono font-black text-rose-300">
                    {bestKills}
                  </div>
                </div>
              </div>
            </div>

            {/* How to play quick guide */}
            {showHowToPlay ? (
              <div className="bg-[#0f172a] rounded-2xl p-4 border border-[#334155] text-right text-xs text-slate-300 space-y-2 mb-5 animate-in fade-in shadow-inner">
                <div className="font-bold text-cyan-300 mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>🎮 آليات التحكم وطريقة اللعب:</span>
                </div>
                <p>• <strong>التحكم:</strong> حركة اللاعب فقط باستخدام عصا التحكم (Virtual Joystick) أو أزرار WASD / الأسهم.</p>
                <p>• <strong>الهجوم:</strong> تلقائي بالكامل (Auto-attack) نحو أقرب عدو بمجرد اقترابه!</p>
                <p>• <strong>الترقيات:</strong> اجمع جواهر الخبرة التي تسقط من الوحوش لاختيار أسلحة وتعزيزات جديدة.</p>
                <p>• <strong>الهدف:</strong> البقاء على قيد الحياة ضد جحافل الوحوش حتى الدقيقة 20:00.</p>
              </div>
            ) : null}

            {/* Main Action Buttons */}
            <div className="space-y-2.5">
              <button
                id="btn-play-game"
                onClick={handleStartGame}
                className="w-full group relative flex items-center justify-center gap-3 py-4 px-6 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-black text-lg sm:text-xl uppercase tracking-tight shadow-[0_0_25px_rgba(34,211,238,0.4)] transition-all duration-150 transform hover:scale-[1.02] cursor-pointer"
              >
                <Play className="w-6 h-6 fill-current" />
                <span>بدء المعركة (START GAME)</span>
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  id="btn-menu-leaderboard"
                  onClick={() => setShowLeaderboardModal(true)}
                  className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-[#0f172a] hover:bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 text-xs sm:text-sm font-bold shadow-md transition cursor-pointer"
                >
                  <Trophy className="w-4 h-4 text-yellow-400" />
                  <span>لوحة الصدارة</span>
                </button>

                <button
                  id="btn-menu-player-auth"
                  onClick={() => setShowAuthModal(true)}
                  className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-[#0f172a] hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs sm:text-sm font-bold shadow-md transition cursor-pointer"
                >
                  <User className="w-4 h-4 text-cyan-400" />
                  <span>الملف والتسجيل</span>
                </button>
              </div>

              {/* Google Play Store Export & Package Button */}
              <button
                id="btn-menu-google-play"
                type="button"
                onClick={() => setShowGooglePlayModal(true)}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-emerald-950/80 hover:from-emerald-900 hover:to-slate-800 text-emerald-300 hover:text-emerald-200 border border-emerald-500/40 text-xs sm:text-sm font-bold shadow-[0_0_15px_rgba(52,211,153,0.15)] transition cursor-pointer"
              >
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span>🚀 نشر وتجهيز اللعبة لمتجر Google Play (.aab)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-Game HUD */}
      {inGame && (
        <>
          <GameHUD
            hp={hudStats.hp}
            maxHp={hudStats.maxHp}
            xp={hudStats.xp}
            nextLevelXp={hudStats.nextLevelXp}
            level={hudStats.level}
            timeSurvived={hudStats.timeSurvived}
            kills={hudStats.kills}
            activeBoss={hudStats.activeBoss}
            weapons={engineRef.current?.weapons || new Map()}
            passives={engineRef.current?.passives || new Map()}
            isMuted={isMuted}
            isFullscreen={isFullscreen}
            onToggleMute={handleToggleMute}
            onToggleFullscreen={handleToggleFullscreen}
            onPause={handleTogglePause}
            onOpenLeaderboard={() => {
              if (!isPaused) handleTogglePause();
              setShowLeaderboardModal(true);
            }}
          />

          {/* Full-Screen Dynamic Virtual Joystick */}
          <VirtualJoystick
            onMove={handleJoystickMove}
            opacity={joystickOpacity}
            onChangeOpacity={handleJoystickOpacityChange}
          />

          {/* Desktop Keyboard Controls Prompt */}
          <div className="fixed bottom-3 right-3 z-30 pointer-events-none hidden sm:block bg-[#1e293b]/90 backdrop-blur-sm px-3 py-1 rounded-lg border border-[#334155] text-[11px] text-slate-300 font-mono shadow-md">
            WASD أو الأسهم للحركة • الهجوم تلقائي
          </div>
        </>
      )}

      {/* Level Up Modal */}
      {levelUpLevel !== null && engineRef.current && (
        <LevelUpModal
          level={levelUpLevel}
          currentWeapons={engineRef.current.weapons}
          currentPassives={engineRef.current.passives}
          onSelectUpgrade={handleSelectUpgrade}
        />
      )}

      {/* Pause Modal */}
      {isPaused && (
        <PauseModal
          onResume={handleTogglePause}
          onRestart={handleStartGame}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          joystickOpacity={joystickOpacity}
          onChangeJoystickOpacity={handleJoystickOpacityChange}
        />
      )}

      {/* Game Over Modal */}
      {gameOverStats && (
        <GameOverModal
          stats={gameOverStats}
          onRestart={handleStartGame}
          onOpenLeaderboard={() => setShowLeaderboardModal(true)}
        />
      )}

      {/* Player Account & Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={() => setPlayerUpdateKey((k) => k + 1)}
      />

      {/* Leaderboard & Ranking Modal */}
      <LeaderboardModal
        isOpen={showLeaderboardModal}
        onClose={() => setShowLeaderboardModal(false)}
        onOpenAuth={() => {
          setShowLeaderboardModal(false);
          setShowAuthModal(true);
        }}
      />

      {/* Google Play Store Export Modal */}
      <GooglePlayExportModal
        isOpen={showGooglePlayModal}
        onClose={() => setShowGooglePlayModal(false)}
      />
    </main>
  );
}
