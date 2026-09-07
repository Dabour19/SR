import React from 'react';
import { Play, RotateCcw, Home, Volume2, VolumeX, Smartphone, Monitor, Sliders } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onQuitToHub: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  joystickOpacity?: number;
  onChangeJoystickOpacity?: (newOpacity: number) => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestart,
  onQuitToHub,
  isMuted,
  onToggleMute,
  joystickOpacity = 0.4,
  onChangeJoystickOpacity,
}) => {
  return (
    <div
      id="pause-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-md p-4 animate-in fade-in duration-150"
    >
      <div className="w-full max-w-md bg-[#1e293b] border-2 border-cyan-400/40 rounded-3xl p-5 sm:p-7 shadow-[0_10px_30px_rgba(34,211,238,0.2)] text-center relative overflow-hidden max-h-[95vh] overflow-y-auto">
        <h2 className="text-2xl sm:text-3xl font-black italic tracking-tight text-white mb-1">
          ⏸️ اللعبة متوقفة مؤقتاً
        </h2>
        <p className="text-xs font-mono font-semibold uppercase tracking-widest text-cyan-400 mb-5">GAME PAUSED</p>

        {/* Action Buttons */}
        <div className="space-y-2.5 mb-5">
          <button
            id="btn-resume-game"
            onClick={onResume}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-base uppercase tracking-tight shadow-[0_0_20px_rgba(34,211,238,0.35)] transition cursor-pointer"
          >
            <Play className="w-5 h-5 fill-current" />
            استئناف اللعب (Resume)
          </button>

          <button
            id="btn-restart-game"
            onClick={onRestart}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#0f172a] hover:bg-[#334155] text-slate-200 font-bold text-sm sm:text-base border border-[#334155] transition cursor-pointer shadow-md"
          >
            <RotateCcw className="w-4 h-4" />
            إعادة المحاولة (Restart)
          </button>

          <button
            id="btn-quit-to-hub"
            onClick={onQuitToHub}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#0f172a] hover:bg-[#334155] text-slate-200 font-bold text-sm sm:text-base border border-[#334155] transition cursor-pointer shadow-md"
          >
            <Home className="w-4 h-4 text-amber-400" />
            العودة للساحة (Hub)
          </button>

          <button
            id="btn-pause-mute-toggle"
            onClick={onToggleMute}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-[#0f172a] hover:bg-[#334155] text-slate-300 text-xs sm:text-sm border border-[#334155] transition shadow-md cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
            {isMuted ? 'تفعيل المؤثرات الصوتية والموسيقى' : 'كتم الصوت والموسيقى'}
          </button>
        </div>

        {/* Joystick Opacity Tuning Section */}
        {onChangeJoystickOpacity && (
          <div className="bg-[#0f172a] rounded-2xl p-3.5 border border-[#334155] mb-4 text-right shadow-inner">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/80 border border-cyan-400/30 px-2.5 py-0.5 rounded-full">
                {Math.round(joystickOpacity * 100)}%
              </span>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span>شفافية عصا التحكم (الجوستيك)</span>
              </div>
            </div>

            {/* Slider */}
            <div className="flex items-center gap-2.5 mb-2.5">
              <span className="text-[10px] text-slate-400 font-mono">10%</span>
              <input
                id="slider-joystick-opacity"
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={joystickOpacity}
                onChange={(e) => onChangeJoystickOpacity(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <span className="text-[10px] text-slate-400 font-mono">100%</span>
            </div>

            {/* Quick Presets */}
            <div className="grid grid-cols-4 gap-1 mb-2.5">
              {[
                { label: 'خفيفة', val: 0.2 },
                { label: 'متوازنة', val: 0.4 },
                { label: 'واضحة', val: 0.65 },
                { label: 'داكنة', val: 0.9 },
              ].map((preset) => (
                <button
                  key={preset.val}
                  type="button"
                  id={`btn-preset-opacity-${Math.round(preset.val * 100)}`}
                  onClick={() => onChangeJoystickOpacity(preset.val)}
                  className={`py-1 px-0.5 rounded-xl text-[10px] font-bold border transition cursor-pointer ${
                    Math.abs(joystickOpacity - preset.val) < 0.1
                      ? 'bg-cyan-500/25 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                      : 'bg-slate-900/90 border-[#334155] text-slate-400 hover:text-slate-200 hover:border-slate-500'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Mini Joystick Live Preview */}
            <div className="relative h-12 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-center overflow-hidden">
              <span className="absolute left-2 text-[10px] text-slate-500 font-medium">معاينة:</span>
              <div
                style={{ opacity: joystickOpacity }}
                className="w-10 h-10 rounded-full border-2 border-cyan-400/50 bg-slate-900/40 flex items-center justify-center"
              >
                <div className="w-5 h-5 rounded-full border border-cyan-300/80 bg-gradient-to-br from-cyan-400 to-blue-600 shadow-[0_0_8px_#22d3ee] flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Controls Info Guide */}
        <div className="bg-[#0f172a] rounded-2xl p-3 border border-[#334155] text-right text-xs text-slate-400 space-y-1.5 shadow-inner">
          <div className="flex items-center gap-2 font-bold text-slate-200">
            <Smartphone className="w-4 h-4 text-cyan-400" />
            <span>الموبايل / اللمس:</span>
          </div>
          <p className="pr-6 text-[11px]">حرك عصا التحكم في أي مكان على الشاشة. تم ضبط شفافيتها لعدم حجب الرؤية.</p>

          <div className="flex items-center gap-2 font-bold text-slate-200 pt-1">
            <Monitor className="w-4 h-4 text-emerald-400" />
            <span>الحاسوب:</span>
          </div>
          <p className="pr-6 text-[11px]">أزرار الحركة: WASD أو الأسهم. الهجوم تلقائي تماماً نحو أقرب وحش!</p>
        </div>
      </div>
    </div>
  );
};
