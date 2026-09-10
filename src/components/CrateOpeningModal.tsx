import { useEffect, useRef, useState } from 'react';
import { Coins, Sparkles, PartyPopper } from 'lucide-react';
import { getCrate, lobbyService, RARITY_CONFIG, CHARACTERS, type CrateReward } from '../services/lobbyService';
import { soundEngine } from '../audio/soundEngine';

interface CrateOpeningModalProps {
  crateId: ReturnType<typeof getCrate>['id'];
  onClose: () => void;
}

const SPIN_DURATION = 3800; // ms of reel spinning before landing
const TICK_SOUNDS = 26; // number of click sounds during spin
const LAND_INDEX = 34; // strip slot the reel stops on
const ITEM_H = 96; // px per reel item (h-24)

/** Build a shuffled strip of emojis; the winner emoji is placed at the landing slot. */
function buildStrip(winnerEmoji: string): string[] {
  const pool = [...CHARACTERS.map((c) => c.emoji), '🪙', '🪙', '💎', '✨', '🪙'];
  const strip: string[] = [];
  for (let i = 0; i < 40; i++) strip.push(pool[Math.floor(Math.random() * pool.length)]);
  strip[LAND_INDEX] = winnerEmoji; // landing slot matches the real reward
  return strip;
}

export function CrateOpeningModal({ crateId, onClose }: CrateOpeningModalProps) {
  const crate = getCrate(crateId);
  const [phase, setPhase] = useState<'spin' | 'landed' | 'reveal'>('spin');
  const [reward, setReward] = useState<CrateReward | null>(null);
  const [tick, setTick] = useState(0);
  const reelRef = useRef<HTMLDivElement | null>(null);

  // The reward is rolled in the mount effect below, but we need the strip to be
  // stable across re-renders, so roll the coins/character reward exactly once here.
  const [strip, setStrip] = useState<string[]>(() => buildStrip('🪙'));

  useEffect(() => {
    // Deduct coins & roll immediately
    const res = lobbyService.openCrate(crateId);
    if (!res.success || !res.reward) {
      onClose();
      return;
    }
    setReward(res.reward);
    // Rebuild strip so the landing slot shows the ACTUAL reward icon
    setStrip(buildStrip(
      res.reward.kind === 'character'
        ? res.reward.emoji
        : res.reward.rarity === 'legendary' || res.reward.rarity === 'epic'
          ? '💎'
          : '🪙'
    ));

    // Fast ticking sound that decelerates with the reel
    let played = 0;
    const tickTimer = window.setInterval(() => {
      if (played >= TICK_SOUNDS) {
        window.clearInterval(tickTimer);
        return;
      }
      soundEngine.playGemPickup();
      played++;
    }, SPIN_DURATION / TICK_SOUNDS);

    const t1 = window.setTimeout(() => {
      setPhase('landed');
      soundEngine.playExplosion();
    }, SPIN_DURATION);
    const t2 = window.setTimeout(() => {
      setPhase('reveal');
      soundEngine.playLevelUp();
    }, SPIN_DURATION + 700);
    return () => {
      window.clearInterval(tickTimer);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [crateId, onClose]);

  // Reel scroll: start from slot 0, then transition to the landing slot center.
  useEffect(() => {
    if (phase !== 'spin') return;
    const el = reelRef.current;
    if (!el) return;
    // Reset instantly to top first (strip may have been rebuilt with the winner)
    el.style.transition = 'none';
    el.style.transform = 'translateY(0px)';
    // Wait for the reset to paint, then animate the long scroll with a
    // decelerating curve, landing the winning item exactly behind the marker.
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const viewport = el.parentElement?.clientHeight || ITEM_H;
        const target = LAND_INDEX * ITEM_H + ITEM_H / 2 - viewport / 2;
        el.style.transition = `transform ${SPIN_DURATION}ms cubic-bezier(0.12, 0.8, 0.15, 1)`;
        el.style.transform = `translateY(-${target}px)`;
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [phase, strip]);

  // Ticking counter for excitement (updated on a fast interval during spin)
  useEffect(() => {
    if (phase !== 'spin') return;
    const t = window.setInterval(() => setTick((n) => n + 1), 80);
    return () => window.clearInterval(t);
  }, [phase]);

  const rar = reward ? RARITY_CONFIG[reward.rarity] : null;

  /* The icon of the actually-obtained reward: characters show their emoji;
     coin prizes show a gem for high rarities, a coin otherwise. */
  const rewardIcon = reward
    ? reward.kind === 'character'
      ? reward.emoji
      : reward.rarity === 'legendary' || reward.rarity === 'epic'
        ? '💎'
        : '🪙'
    : '🪙';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
      style={{ animation: phase === 'landed' ? 'screen-shake 0.5s ease-out' : undefined }}
    >
      {/* White flash the instant the reel lands */}
      {phase !== 'spin' && (
        <div
          className="absolute inset-0 bg-white pointer-events-none"
          style={{ animation: 'land-flash 0.55s ease-out forwards' }}
        />
      )}

      {/* Glow behind reel / reward */}
      <div
        className="absolute w-96 h-96 rounded-full blur-3xl pointer-events-none transition-opacity duration-700"
        style={{
          background: phase !== 'spin' && rar ? rar.glow : crate.color + '55',
          opacity: phase === 'spin' ? 0.35 : 0.9,
          animation: phase !== 'spin' ? 'glow-burst 1.6s ease-in-out infinite' : undefined,
        }}
      />

      {/* Rising sparkles during spin & reveal */}
      {Array.from({ length: 22 }).map((_, i) => (
        <div
          key={i}
          className="absolute pointer-events-none text-lg select-none"
          style={{
            left: `${6 + ((i * 37) % 88)}%`,
            top: `${25 + ((i * 53) % 55)}%`,
            animation: `sparkle-rise ${1.4 + (i % 5) * 0.4}s linear ${i * 0.18}s infinite`,
          }}
        >
          {['✨', '⭐', '💎', '🌟'][i % 4]}
        </div>
      ))}

      <div className="relative text-center w-full max-w-md">
        <div className="text-xs font-bold text-slate-300 mb-3 flex items-center justify-center gap-2">
          <span className="text-2xl" style={{ filter: `drop-shadow(0 0 12px ${crate.color})` }}>{crate.emoji}</span>
          {crate.nameAr}
        </div>

        {phase === 'spin' && (
          <>
            {/* Slot-machine reel with center marker */}
            <div
              className="relative mx-auto h-24 w-full max-w-sm overflow-hidden rounded-2xl border-2 bg-[#0f172a]/95"
              style={{
                borderColor: crate.color,
                boxShadow: `0 0 30px ${crate.color}66, inset 0 0 30px rgba(0,0,0,0.7)`,
              }}
            >
              {/* Center selection marker */}
              <div
                className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-20 pointer-events-none z-10 rounded-lg border-2 animate-pulse"
                style={{ borderColor: crate.color, background: crate.color + '22' }}
              />
              {/* Fade edges */}
              <div className="absolute inset-y-0 left-0 w-14 bg-gradient-to-r from-[#0f172a] to-transparent z-10" />
              <div className="absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-[#0f172a] to-transparent z-10" />

              {/* Scrolling strip */}
              <div ref={reelRef} className="flex flex-col will-change-transform">
                {strip.map((em, i) => (
                  <div
                    key={i}
                    className="h-24 shrink-0 flex items-center justify-center text-4xl"
                    style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.25))' }}
                  >
                    {em}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-300 font-black animate-pulse">
              <Sparkles className="w-4 h-4 text-fuchsia-400" />
              <span>جارٍ تحديد جائزتك بالحظ...</span>
              <span className="font-mono text-fuchsia-300" style={{ animation: 'tick-flash 0.4s infinite' }}>
                {(tick % 100).toString().padStart(2, '0')}
              </span>
            </div>
          </>
        )}

        {phase !== 'spin' && reward && rar && (
          <div className="relative inline-block animate-in zoom-in duration-300">
            {/* Shockwave rings on landing */}
            {phase === 'landed' && (
              <>
                <div
                  className="absolute inset-0 rounded-full border-4 pointer-events-none"
                  style={{ borderColor: rar.color, animation: 'shock-ring 0.7s ease-out forwards' }}
                />
                <div
                  className="absolute inset-0 rounded-full border-2 pointer-events-none"
                  style={{ borderColor: '#ffffff88', animation: 'shock-ring 0.9s ease-out 0.15s forwards' }}
                />
              </>
            )}

            <div
              className="relative mx-auto w-64 rounded-3xl border-2 p-6 bg-[#1e293b]/95 backdrop-blur"
              style={{
                borderColor: rar.color,
                boxShadow: `0 0 45px ${rar.glow}`,
                animation: 'reward-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
              }}
            >
              {/* Pulsing rarity halo behind the item */}
              <div
                className="absolute inset-0 rounded-3xl border-2 pointer-events-none"
                style={{ borderColor: rar.color, animation: 'halo-pulse 1.4s ease-out infinite' }}
              />
              {/* Confetti burst on reveal */}
              {phase === 'reveal' &&
                Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 w-1.5 h-3 rounded-sm pointer-events-none"
                    style={{
                      left: `${8 + i * 7.5}%`,
                      background: i % 3 === 0 ? rar.color : i % 3 === 1 ? '#fbbf24' : '#22d3ee',
                      animation: `confetti-fall ${1.2 + (i % 4) * 0.35}s ease-in ${i * 0.08}s infinite`,
                    }}
                  />
                ))}
              <div
                className="text-[10px] font-black px-2 py-1 rounded-full inline-block mb-3"
                style={{ color: rar.color, background: rar.bg, border: `1px solid ${rar.color}66` }}
              >
                {rar.labelAr}
              </div>
              <div
                className="text-7xl mb-3"
                style={{
                  animation: phase === 'reveal' ? 'item-float 1.8s ease-in-out infinite, glow-burst 1.2s ease-in-out infinite' : undefined,
                  filter: `drop-shadow(0 0 18px ${rar.color})`,
                }}
              >
                {rewardIcon}
              </div>
              {reward.kind === 'character' ? (
                <>
                  <div className="flex items-center justify-center gap-1.5 text-lg font-black text-white">
                    <PartyPopper className="w-5 h-5 text-emerald-400" />
                    شخصية جديدة!
                  </div>
                  <div className="text-sm font-bold mt-1" style={{ color: rar.color }}>
                    {reward.nameAr}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-2">أُضيفت إلى مجموعة شخصياتك — يمكنك اختيارها من تبويب الشخصيات</div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-center gap-1.5 text-xl font-black text-amber-300 font-mono">
                    <Coins className="w-5 h-5" />
                    +{reward.amount.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {rewardIcon === '💎' ? 'جوهرة نادرة + مكافأة عملات!' : 'مكافأة عملات'}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {phase === 'reveal' ? (
          <button
            onClick={onClose}
            className="mt-6 px-8 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-black text-sm shadow-[0_0_20px_rgba(34,211,238,0.4)] transition cursor-pointer animate-pulse"
          >
            رائع! ✨
          </button>
        ) : phase === 'spin' ? null : (
          <div className="mt-4 text-xs font-black text-white" style={{ animation: 'tick-flash 0.3s infinite' }}>
            🎉
          </div>
        )}
      </div>
    </div>
  );
}
