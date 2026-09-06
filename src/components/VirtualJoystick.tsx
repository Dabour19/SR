import React, { useEffect, useRef, useState } from 'react';

interface VirtualJoystickProps {
  onMove: (x: number, y: number) => void;
  opacity?: number;
  onChangeOpacity?: (newOpacity: number) => void;
}

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({
  onMove,
  opacity = 0.4,
  onChangeOpacity,
}) => {
  const [active, setActive] = useState(false);
  const [basePos, setBasePos] = useState({ x: 100, y: 500 });
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const activePointerIdRef = useRef<number | null>(null);
  const basePosRef = useRef({ x: 100, y: 500 });
  const maxRadius = 55;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Check if the touched element is an interactive button or control
    const target = e.target as HTMLElement | null;
    if (target) {
      const interactiveEl = target.closest('button, a, input, select, [data-interactive="true"]');
      if (interactiveEl) {
        return;
      }
    }

    // Only track one active touch at a time for movement
    if (activePointerIdRef.current !== null) return;

    activePointerIdRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const pos = { x: e.clientX, y: e.clientY };
    basePosRef.current = pos;
    setBasePos(pos);
    setKnobPos({ x: 0, y: 0 });
    setActive(true);
    onMove(0, 0);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!active || activePointerIdRef.current !== e.pointerId) return;

    const dx = e.clientX - basePosRef.current.x;
    const dy = e.clientY - basePosRef.current.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 2) {
      setKnobPos({ x: 0, y: 0 });
      onMove(0, 0);
      return;
    }

    const clampedDist = Math.min(maxRadius, dist);
    const nx = dx / dist;
    const ny = dy / dist;

    setKnobPos({
      x: nx * clampedDist,
      y: ny * clampedDist,
    });

    onMove(nx * (clampedDist / maxRadius), ny * (clampedDist / maxRadius));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current === e.pointerId) {
      activePointerIdRef.current = null;
      setActive(false);
      setKnobPos({ x: 0, y: 0 });
      onMove(0, 0);
    }
  };

  useEffect(() => {
    const handleGlobalEnd = () => {
      if (activePointerIdRef.current !== null) {
        activePointerIdRef.current = null;
        setActive(false);
        setKnobPos({ x: 0, y: 0 });
        onMove(0, 0);
      }
    };
    window.addEventListener('pointerup', handleGlobalEnd);
    window.addEventListener('pointercancel', handleGlobalEnd);
    window.addEventListener('touchend', handleGlobalEnd);
    return () => {
      window.removeEventListener('pointerup', handleGlobalEnd);
      window.removeEventListener('pointercancel', handleGlobalEnd);
      window.removeEventListener('touchend', handleGlobalEnd);
    };
  }, [onMove]);

  return (
    <div
      id="virtual-joystick-fullscreen-zone"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="fixed inset-0 z-10 select-none touch-none pointer-events-auto"
      style={{ touchAction: 'none' }}
    >
      {/* Active Floating Joystick at touch location */}
      {active ? (
        <div
          id="virtual-joystick-active-base"
          style={{
            left: `${basePos.x}px`,
            top: `${basePos.y}px`,
            transform: 'translate(-50%, -50%)',
            opacity: opacity,
          }}
          className="pointer-events-none absolute w-28 h-28 rounded-full border-2 border-cyan-400/50 bg-slate-950/40 backdrop-blur-[2px] shadow-[0_0_20px_rgba(34,211,238,0.25)] flex items-center justify-center animate-in fade-in zoom-in-90 duration-100"
        >
          {/* Inner concentric rings and crosshairs */}
          <div className="absolute w-full h-[1px] bg-cyan-400/20" />
          <div className="absolute h-full w-[1px] bg-cyan-400/20" />
          <div className="w-14 h-14 rounded-full border border-cyan-400/25" />

          {/* Dynamic Knob */}
          <div
            id="virtual-joystick-knob"
            style={{
              transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
            }}
            className="w-13 h-13 rounded-full border-2 border-cyan-300/80 bg-gradient-to-br from-cyan-400/85 to-blue-600/85 shadow-[0_0_15px_rgba(34,211,238,0.35)] flex items-center justify-center"
          >
            <div className="w-3.5 h-3.5 rounded-full bg-white/90 shadow-[0_0_6px_#ffffff]" />
          </div>
        </div>
      ) : (
        /* Subtle idle indicator on mobile screen with quick opacity adjustment button */
        <div
          id="virtual-joystick-idle-guide"
          style={{ opacity: Math.max(0.45, Math.min(0.85, opacity + 0.15)) }}
          className="pointer-events-auto absolute bottom-6 left-6 flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-[#0f172a]/75 backdrop-blur-md border border-cyan-400/30 text-cyan-300 text-xs font-bold shadow-lg md:hidden"
        >
          <div className="w-5 h-5 rounded-full border border-cyan-400/50 flex items-center justify-center text-[10px]">
            🕹️
          </div>
          <span>المس واسحب للتحرك</span>

          {onChangeOpacity && (
            <button
              id="btn-quick-joystick-opacity"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                // Cycle through 20% -> 40% -> 65% -> 90% -> 20%
                const presets = [0.2, 0.4, 0.65, 0.9];
                const currentIndex = presets.findIndex((p) => Math.abs(p - opacity) < 0.13);
                const nextIndex = (currentIndex + 1) % presets.length;
                onChangeOpacity(presets[nextIndex]);
              }}
              className="mr-1 px-2 py-0.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-400/40 text-[10px] text-cyan-200 font-mono transition cursor-pointer flex items-center gap-1"
              title="تعديل شفافية عصا التحكم (الجوستيك)"
            >
              <span>شفافية:</span>
              <span className="font-bold">{Math.round(opacity * 100)}%</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
