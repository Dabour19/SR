/**
 * Procedural Web Audio API Sound Synthesizer
 * Generates crisp 8-bit / modern arcade audio effects without external audio files.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private sfxVolume: number = 0.7;
  private musicVolume: number = 0.35;
  private isMuted: boolean = false;
  private isMusicMuted: boolean = false;
  private musicInterval: number | null = null;
  private musicStep: number = 0;
  private comboPitchOffset: number = 0;
  private comboResetTimer: number | null = null;

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public enableAudio() {
    this.initContext();
    if (!this.musicInterval && !this.isMusicMuted && !this.isMuted) {
      this.startAmbientMusic();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted && this.ctx) {
      if (this.musicInterval) {
        window.clearInterval(this.musicInterval);
        this.musicInterval = null;
      }
    } else if (!muted && !this.isMusicMuted) {
      this.startAmbientMusic();
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public setSfxVolume(vol: number) {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
  }

  public setMusicVolume(vol: number) {
    this.musicVolume = Math.max(0, Math.min(1, vol));
  }

  /**
   * Sound when Arcane Burst shoots
   */
  public playArcaneShoot() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.12);

      gain.gain.setValueAtTime(this.sfxVolume * 0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.13);
    } catch {
      // ignore audio context failures
    }
  }

  /**
   * Sound when Spinning Blade hits enemy
   */
  public playBladeHit() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.08);

      gain.gain.setValueAtTime(this.sfxVolume * 0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.09);
    } catch {}
  }

  /**
   * Sound when picking up an XP Gem (increases in pitch when collected in quick succession!)
   */
  public playGemPickup() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // Pentatonic ascending chime: C5, D5, E5, G5, A5, C6
      const baseNotes = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
      const note = baseNotes[this.comboPitchOffset % baseNotes.length];

      this.comboPitchOffset = (this.comboPitchOffset + 1) % 18;
      if (this.comboResetTimer) window.clearTimeout(this.comboResetTimer);
      this.comboResetTimer = window.setTimeout(() => {
        this.comboPitchOffset = 0;
      }, 750);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(note, now);
      osc.frequency.exponentialRampToValueAtTime(note * 1.25, now + 0.08);

      gain.gain.setValueAtTime(this.sfxVolume * 0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.11);
    } catch {}
  }

  /**
   * Level up fanfare
   */
  public playLevelUp() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const noteTime = now + idx * 0.1;
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, noteTime);

        gain.gain.setValueAtTime(0, noteTime);
        gain.gain.linearRampToValueAtTime(this.sfxVolume * 0.35, noteTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(noteTime);
        osc.stop(noteTime + 0.45);
      });
    } catch {}
  }

  /**
   * Enemy hurt/death
   */
  public playEnemyDeath(isBoss: boolean = false) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      const startFreq = isBoss ? 180 : 260;
      const endFreq = isBoss ? 40 : 80;
      const dur = isBoss ? 0.35 : 0.14;

      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur);

      gain.gain.setValueAtTime(this.sfxVolume * (isBoss ? 0.5 : 0.22), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + dur + 0.02);
    } catch {}
  }

  /**
   * Player hurt sound
   */
  public playPlayerHurt() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.18);

      gain.gain.setValueAtTime(this.sfxVolume * 0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.19);
    } catch {}
  }

  /**
   * Lightning weapon sound
   */
  public playLightning() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.25);

      gain.gain.setValueAtTime(this.sfxVolume * 0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.26);
    } catch {}
  }

  /**
   * Fire Wand explosion sound
   */
  public playExplosion() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.28);

      gain.gain.setValueAtTime(this.sfxVolume * 0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.29);
    } catch {}
  }

  /**
   * Fire wand shooting / fireball whoosh sound
   */
  public playFireWand() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(360, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.15);

      gain.gain.setValueAtTime(this.sfxVolume * 0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.16);
    } catch {}
  }

  /**
   * Generic enemy hit sound
   */
  public playEnemyHit() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.1);

      gain.gain.setValueAtTime(this.sfxVolume * 0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.11);
    } catch {}
  }

  /**
   * Subtle dynamic synth background pulse (creates intense, immersive Rogue-lite atmosphere)
   */
  public startAmbientMusic() {
    if (this.musicInterval) return;

    // Dark synth bassline progression (Am - F - C - G)
    const chords = [
      [110, 164.81], // A2, E3
      [87.31, 130.81], // F2, C3
      [130.81, 196.0], // C3, G3
      [98.0, 146.83], // G2, D3
    ];

    this.musicInterval = window.setInterval(() => {
      if (this.isMuted || this.isMusicMuted || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const chordIndex = Math.floor(this.musicStep / 4) % chords.length;
        const root = chords[chordIndex][0];
        const fifth = chords[chordIndex][1];

        // Bass pulse
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(this.musicStep % 2 === 0 ? root : fifth, now);

        gain.gain.setValueAtTime(this.musicVolume * 0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.23);

        this.musicStep = (this.musicStep + 1) % 16;
      } catch {}
    }, 250);
  }

  public stopAmbientMusic() {
    if (this.musicInterval) {
      window.clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }
}

export const soundEngine = new SoundEngine();
