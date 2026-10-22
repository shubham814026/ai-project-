/**
 * Web Audio API Synthesizer
 * 100% offline, zero-asset audio synthesis for DirectAI Studio.
 * Generates mechanical SLR camera shutter clicks, pleasant harmonic chimes, and countdown beeps.
 */

export class AudioSynthesizer {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;

  constructor() {
    // Lazy initialize to comply with browser autoplay gesture policies
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        try {
          this.ctx = new AudioCtxClass();
        } catch {
          this.ctx = null;
        }
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  /**
   * Synthesizes an authentic mechanical SLR camera shutter sound.
   * Consists of:
   * 1. Mirror release noise pop & mechanical click
   * 2. Brief 35ms curtain transit gap
   * 3. Curtain close snap with resonant camera body damping
   */
  public playShutterSound(): void {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const t0 = ctx.currentTime;

      // 1. Initial mirror flip pop (15ms)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(320, t0);
      osc1.frequency.exponentialRampToValueAtTime(80, t0 + 0.025);
      gain1.gain.setValueAtTime(0.5, t0);
      gain1.gain.exponentialRampToValueAtTime(0.001, t0 + 0.025);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(t0);
      osc1.stop(t0 + 0.025);

      // Noise burst for mechanical shutter blade 1
      this.createNoiseBurst(ctx, t0, 0.015, 2600, 0.4);

      // 2. Curtain snap closure (at t0 + 40ms)
      const tClose = t0 + 0.04;
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(190, tClose);
      osc2.frequency.exponentialRampToValueAtTime(50, tClose + 0.04);
      gain2.gain.setValueAtTime(0.6, tClose);
      gain2.gain.exponentialRampToValueAtTime(0.001, tClose + 0.04);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(tClose);
      osc2.stop(tClose + 0.04);

      // Noise burst for curtain slam
      this.createNoiseBurst(ctx, tClose, 0.025, 1800, 0.5);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  /**
   * Generates a filtered noise burst for mechanical acoustics
   */
  private createNoiseBurst(ctx: AudioContext, startTime: number, duration: number, centerFreq: number, volume: number): void {
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(centerFreq, startTime);
    filter.Q.setValueAtTime(1.8, startTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(startTime);
    noise.stop(startTime + duration);
  }

  /**
   * Synthesizes an ascending harmonic chime (C5 -> E5 -> G5) to celebrate pose convergence
   */
  public playSuccessChime(): void {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const t0 = ctx.currentTime;
      const notes = [
        { freq: 523.25, time: 0.00, dur: 0.18 }, // C5
        { freq: 659.25, time: 0.09, dur: 0.18 }, // E5
        { freq: 783.99, time: 0.18, dur: 0.35 }, // G5
      ];

      for (const n of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.freq, t0 + n.time);

        gain.gain.setValueAtTime(0.001, t0 + n.time);
        gain.gain.linearRampToValueAtTime(0.25, t0 + n.time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + n.time + n.dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t0 + n.time);
        osc.stop(t0 + n.time + n.dur);
      }
    } catch {
      // Ignore audio policy errors
    }
  }

  /**
   * Synthesizes a countdown pip for auto-shutter hold timer
   */
  public playCountdownBeep(frequency: number = 880, duration: number = 0.07): void {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, t0);

      gain.gain.setValueAtTime(0.2, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t0);
      osc.stop(t0 + duration);
    } catch {
      // Ignore audio policy errors
    }
  }
}
