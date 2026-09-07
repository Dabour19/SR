import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Volume2,
  VolumeX,
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
import { LevelUpModal } from './components/LevelUpModal';
import { PauseModal } from './components/PauseModal';
import { GameOverModal } from './components/GameOverModal';
import { AuthModal } from './components/AuthModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { playerAuthService } from './services/playerAuthService';
import { lobbyService } from './services/lobbyService';
import { Lobby } from './components/Lobby';
import { VirtualJoystick } from './components/VirtualJoystick';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAInstallButton } from './components/PWAInstallButton';

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
  const [, forcePlayerUpdate] = useState(0);
  const [coinsEarned, setCoinsEarned] = useState<number | null>(null);

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

  // Format MM:SS (kept for future use in menus)

  // Level Up Callback
  const handleLevelUp = useCallback((lvl: number) => {
    setLevelUpLevel(lvl);
  }, []);

  // Game Over Callback
  const handleGameOver = useCallback((stats: GameRunStats) => {
    setGameOverStats(stats);
    // Reward coins for the run (time + kills + level, victory bonus)
    const raw = Math.floor(
      stats.timeSurvived * 1.2 + stats.enemiesKilled * 0.6 + stats.level * 8 + (stats.victory ? 500 : 0)
    );
    const earned = lobbyService.addRunCoins(raw);
    setCoinsEarned(earned);
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

  // Exit lobby back to main menu (زر الرجوع)
  const handleExitToMenu = () => {
    soundEngine.setMuted(true);
    setInGame(false);
    setIsPaused(false);
    setGameOverStats(null);
    setCoinsEarned(null);
    setLevelUpLevel(null);
  };

  // Start game
  const handleStartGame = (difficulty?: number) => {
    soundEngine.enableAudio();
    if (engineRef.current) {
      // Apply lobby character + perks before starting
      engineRef.current.setLoadout(lobbyService.getRunStartStats());
      engineRef.current.initNewGame(difficulty);
    }
    setGameOverStats(null);
    setCoinsEarned(null);
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

      {/* Main Menu = Lobby (profile / shop / characters / friends) */}
      {!inGame && (
        <Lobby
          onBack={handleExitToMenu}
          onStartGame={handleStartGame}
          onOpenAuth={() => setShowAuthModal(true)}
          onOpenLeaderboard={() => setShowLeaderboardModal(true)}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
        />
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
          onQuitToHub={() => {
            if (isPaused) handleTogglePause();
            setInGame(false);
          }}
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
          coinsEarned={coinsEarned ?? undefined}
          onRestart={handleStartGame}
          onOpenLeaderboard={() => setShowLeaderboardModal(true)}
          onBackToHub={() => {
            setGameOverStats(null);
            setCoinsEarned(null);
            setInGame(false);
          }}
        />
      )}

      {/* Player Account & Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onUserChanged={() => forcePlayerUpdate((k) => k + 1)}
      />

      {/* Leaderboard & Ranking Modal */}
      <LeaderboardModal
        isOpen={showLeaderboardModal}
        onClose={() => setShowLeaderboardModal(false)}
        onOpenAuthModal={() => {
          setShowLeaderboardModal(false);
          setShowAuthModal(true);
        }}
      />
    </main>
  );
}
