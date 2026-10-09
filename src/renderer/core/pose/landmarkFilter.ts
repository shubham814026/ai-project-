/**
 * Landmark Filtering and Smoothing Engine
 * Implements 1€ (One Euro) Filter with EMA fallback and jitter measurement
 * Ref: Casiez, Roussel, & Vogel (CHI 2012)
 * Strictly follows Section A6 & A7
 */

import { NormalizedLandmark } from '../library/types';
import { FILTER_CONFIG } from '../settings/constants';

class LowPassFilter {
  private y: number | null = null;
  private s: number | null = null;

  filter(value: number, alpha: number): number {
    if (this.y === null) {
      this.s = value;
      this.y = value;
      return value;
    }
    this.y = alpha * value + (1.0 - alpha) * this.s!;
    this.s = this.y;
    return this.y;
  }

  hasLast(): boolean {
    return this.y !== null;
  }

  last(): number {
    return this.y ?? 0;
  }

  reset(): void {
    this.y = null;
    this.s = null;
  }
}

export class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xFilter: LowPassFilter = new LowPassFilter();
  private dxFilter: LowPassFilter = new LowPassFilter();
  private lastTime: number | null = null;

  constructor(
    minCutoff: number = FILTER_CONFIG.ONE_EURO_MIN_CUTOFF,
    beta: number = FILTER_CONFIG.ONE_EURO_BETA,
    dCutoff: number = FILTER_CONFIG.ONE_EURO_D_CUTOFF
  ) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  private alpha(rate: number, cutoff: number): number {
    const tau = 1.0 / (2.0 * Math.PI * cutoff);
    const te = 1.0 / rate;
    return 1.0 / (1.0 + tau / te);
  }

  filter(value: number, timestamp: number): number {
    if (this.lastTime === null) {
      this.lastTime = timestamp;
      return this.xFilter.filter(value, 1.0);
    }

    const dt = Math.max(1e-4, (timestamp - this.lastTime) / 1000.0);
    this.lastTime = timestamp;
    const rate = 1.0 / dt;

    // Estimate derivative
    const prevValue = this.xFilter.last();
    const dx = (value - prevValue) * rate;
    const edx = this.dxFilter.filter(dx, this.alpha(rate, this.dCutoff));

    // Dynamic cutoff based on movement speed
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.xFilter.filter(value, this.alpha(rate, cutoff));
  }

  reset(): void {
    this.xFilter.reset();
    this.dxFilter.reset();
    this.lastTime = null;
  }
}

export interface LandmarkFilterOptions {
  visibilityThreshold?: number;
  useOneEuro?: boolean;
  minCutoff?: number;
  beta?: number;
  emaAlpha?: number;
}

/**
 * Filter manager managing smoothing filters for all 33 MediaPipe body landmarks
 */
export class LandmarkFilterManager {
  private xFilters: OneEuroFilter[] = [];
  private yFilters: OneEuroFilter[] = [];
  private zFilters: OneEuroFilter[] = [];
  private prevEma: (NormalizedLandmark | null)[] = [];
  private options: Required<LandmarkFilterOptions>;

  constructor(options: LandmarkFilterOptions = {}) {
    this.options = {
      visibilityThreshold: options.visibilityThreshold ?? FILTER_CONFIG.VISIBILITY_THRESHOLD,
      useOneEuro: options.useOneEuro ?? true,
      minCutoff: options.minCutoff ?? FILTER_CONFIG.ONE_EURO_MIN_CUTOFF,
      beta: options.beta ?? FILTER_CONFIG.ONE_EURO_BETA,
      emaAlpha: options.emaAlpha ?? FILTER_CONFIG.EMA_ALPHA,
    };
    this.initFilters();
  }

  private initFilters(): void {
    this.xFilters = Array.from({ length: 33 }, () => new OneEuroFilter(this.options.minCutoff, this.options.beta));
    this.yFilters = Array.from({ length: 33 }, () => new OneEuroFilter(this.options.minCutoff, this.options.beta));
    this.zFilters = Array.from({ length: 33 }, () => new OneEuroFilter(this.options.minCutoff, this.options.beta));
    this.prevEma = Array.from({ length: 33 }, () => null);
  }

  filterLandmarks(landmarks: NormalizedLandmark[], timestamp: number = performance.now()): NormalizedLandmark[] {
    return landmarks.map((lm, idx) => {
      // Visibility threshold gate
      if (lm.visibility < this.options.visibilityThreshold) {
        return { ...lm };
      }

      if (this.options.useOneEuro) {
        const xF = this.xFilters[idx];
        const yF = this.yFilters[idx];
        const zF = this.zFilters[idx];
        return {
          x: xF.filter(lm.x, timestamp),
          y: yF.filter(lm.y, timestamp),
          z: lm.z !== undefined ? zF.filter(lm.z, timestamp) : undefined,
          visibility: lm.visibility,
        };
      } else {
        // Fallback EMA
        const prev = this.prevEma[idx];
        const alpha = this.options.emaAlpha;
        if (!prev) {
          this.prevEma[idx] = { ...lm };
          return { ...lm };
        }
        const smoothed: NormalizedLandmark = {
          x: alpha * lm.x + (1 - alpha) * prev.x,
          y: alpha * lm.y + (1 - alpha) * prev.y,
          z: lm.z !== undefined && prev.z !== undefined ? alpha * lm.z + (1 - alpha) * prev.z : lm.z,
          visibility: lm.visibility,
        };
        this.prevEma[idx] = smoothed;
        return smoothed;
      }
    });
  }

  reset(): void {
    this.xFilters.forEach((f) => f.reset());
    this.yFilters.forEach((f) => f.reset());
    this.zFilters.forEach((f) => f.reset());
    this.prevEma = Array.from({ length: 33 }, () => null);
  }
}

/**
 * Computes mean euclidean jitter (per-frame point displacement) over a window of frames.
 */
export function computeJitterMetric(series: NormalizedLandmark[][]): number {
  if (series.length < 2) return 0;
  let totalDisp = 0;
  let count = 0;

  for (let f = 1; f < series.length; f++) {
    const prev = series[f - 1];
    const curr = series[f];
    for (let i = 0; i < Math.min(prev.length, curr.length); i++) {
      if (prev[i].visibility >= 0.5 && curr[i].visibility >= 0.5) {
        const d = Math.hypot(curr[i].x - prev[i].x, curr[i].y - prev[i].y);
        totalDisp += d;
        count++;
      }
    }
  }

  return count > 0 ? totalDisp / count : 0;
}
