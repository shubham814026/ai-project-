/**
 * Offline Voice Director
 * 100% offline, zero-network, local speech synthesis using standard Web Speech API.
 * Provides voice cues for solo creators with refractory rate-limiting.
 */

export class VoiceDirector {
  private enabled: boolean = true;
  private lastSpokenTime: number = 0;
  private lastSpokenText: string = '';
  private minIntervalMs: number = 4500; // Refractory period: at most one cue every 4.5s
  private selectedVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    this.initVoices();
  }

  private initVoices(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      // Prefer natural English voices (US, GB, or any English)
      const enVoice = voices.find(
        (v) => (v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Online') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Microsoft')))
      ) || voices.find((v) => v.lang.startsWith('en')) || voices[0] || null;

      this.selectedVoice = enVoice;
    };

    pickVoice();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = pickVoice;
    }
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  /**
   * Translates visual feedback to a concise spoken directive
   */
  public provideFeedback(
    framingInstruction: string | null,
    poseInstructionText: string | null,
    holdProgress: number,
    now: number = performance.now()
  ): void {
    if (!this.enabled || !this.isSupported()) return;

    // Directorial priority 1: Hold steady countdown cue
    if (holdProgress >= 0.25 && holdProgress < 0.6) {
      this.speak('Hold steady for capture', now, 3500);
      return;
    }

    // Directorial priority 2: Camera framing cues
    if (framingInstruction) {
      const spoken = this.sanitizeFramingCue(framingInstruction);
      if (spoken) {
        this.speak(spoken, now);
        return;
      }
    }

    // Directorial priority 3: Pose correction cues
    if (poseInstructionText) {
      const spoken = this.sanitizePoseCue(poseInstructionText);
      if (spoken) {
        this.speak(spoken, now);
      }
    }
  }

  /**
   * Speaks a congratulatory cue when a high-resolution snapshot is captured
   */
  public notifyCapture(poseName: string): void {
    if (!this.enabled || !this.isSupported()) return;
    const now = performance.now();
    this.speak(`Captured ${poseName}. Great posture!`, now, 2000, true);
  }

  public speak(text: string, now: number = performance.now(), customIntervalMs?: number, force: boolean = false): void {
    if (!this.enabled || !this.isSupported()) return;

    const interval = customIntervalMs || this.minIntervalMs;
    // Enforce refractory interval unless forced
    if (!force && now - this.lastSpokenTime < interval) return;

    // Suppress repeating identical instruction within 8 seconds
    if (!force && text === this.lastSpokenText && now - this.lastSpokenTime < 8000) return;

    try {
      window.speechSynthesis.cancel(); // Stop any pending utterance
      const utterance = new SpeechSynthesisUtterance(text);
      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }
      utterance.rate = 1.05; // Slightly brisk, clear pace
      utterance.pitch = 1.0;
      utterance.volume = 0.85;

      this.lastSpokenTime = now;
      this.lastSpokenText = text;

      window.speechSynthesis.speak(utterance);
    } catch {
      // SpeechSynthesis error fallback
    }
  }

  private sanitizeFramingCue(cue: string): string {
    const lower = cue.toLowerCase();
    if (lower.includes('move back') || lower.includes('too close')) return 'Please move back slightly';
    if (lower.includes('move closer') || lower.includes('too far')) return 'Move a bit closer to camera';
    if (lower.includes('shift left')) return 'Shift slightly to your left';
    if (lower.includes('shift right')) return 'Shift slightly to your right';
    if (lower.includes('tilt camera up') || lower.includes('headroom')) return 'Tilt camera up slightly';
    if (lower.includes('tilt camera down')) return 'Tilt camera down slightly';
    if (lower.includes('center')) return 'Center yourself in frame';
    return cue;
  }

  private sanitizePoseCue(text: string): string {
    // Simplify technical joint instructions into natural spoken words
    return text
      .replace(/by \d+°/g, '')
      .replace(/approx\.?/gi, '')
      .trim();
  }
}
