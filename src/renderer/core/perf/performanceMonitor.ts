/**
 * Performance Monitor Engine
 * Tracks render FPS, inference latency, p95 timings, memory usage,
 * and manages automatic adaptive throttling / degraded state recovery.
 * Strictly adheres to Section A7, A9, A12
 */

import { INFERENCE_CONFIG } from '../settings/constants';

export interface PerformanceStats {
  renderFps: number;
  inferenceRateHz: number;
  inferenceP95Ms: number;
  inferenceMedianMs: number;
  renderP95Ms: number;
  memoryMb: number;
  isDegradedMode: boolean;
}

export class PerformanceMonitor {
  private renderTimestamps: number[] = [];
  private renderTimesMs: number[] = [];
  private inferenceTimestamps: number[] = [];
  private inferenceTimesMs: number[] = [];

  private degradedStartTime: number | null = null;
  private healthyStartTime: number | null = null;
  private isDegraded: boolean = false;

  private onDegradedModeChange?: (degraded: boolean) => void;

  constructor(onDegradedModeChange?: (degraded: boolean) => void) {
    this.onDegradedModeChange = onDegradedModeChange;
  }

  public recordRenderFrame(durationMs: number, timestamp: number = performance.now()): void {
    this.renderTimestamps.push(timestamp);
    this.renderTimesMs.push(durationMs);

    // Keep rolling 2-second window
    const cutoff = timestamp - 2000;
    while (this.renderTimestamps.length > 0 && this.renderTimestamps[0] < cutoff) {
      this.renderTimestamps.shift();
      this.renderTimesMs.shift();
    }
  }

  public recordInference(durationMs: number, timestamp: number = performance.now()): void {
    this.inferenceTimestamps.push(timestamp);
    this.inferenceTimesMs.push(durationMs);

    // Keep rolling 5-second window
    const cutoff = timestamp - 5000;
    while (this.inferenceTimestamps.length > 0 && this.inferenceTimestamps[0] < cutoff) {
      this.inferenceTimestamps.shift();
      this.inferenceTimesMs.shift();
    }

    this.checkAdaptivePerformance(timestamp);
  }

  private checkAdaptivePerformance(timestamp: number): void {
    if (this.inferenceTimesMs.length < 10) return;

    const p95 = this.calculatePercentile(this.inferenceTimesMs, 0.95);

    // Section A7: "if p95 inference misses its budget for 5 s, switch to lite or lower rate"
    if (p95 > INFERENCE_CONFIG.P95_BUDGET_MS) {
      this.healthyStartTime = null;
      if (this.degradedStartTime === null) {
        this.degradedStartTime = timestamp;
      } else if (timestamp - this.degradedStartTime >= INFERENCE_CONFIG.DEGRADE_AFTER_MISS_MS) {
        if (!this.isDegraded) {
          this.isDegraded = true;
          this.onDegradedModeChange?.(true);
        }
      }
    } else {
      this.degradedStartTime = null;
      if (this.isDegraded) {
        if (this.healthyStartTime === null) {
          this.healthyStartTime = timestamp;
        } else if (timestamp - this.healthyStartTime >= INFERENCE_CONFIG.RECOVER_AFTER_HEALTHY_MS) {
          this.isDegraded = false;
          this.healthyStartTime = null;
          this.onDegradedModeChange?.(false);
        }
      }
    }
  }

  public getStats(): PerformanceStats {
    const now = performance.now();
    const renderCount = this.renderTimestamps.filter((t) => t > now - 1000).length;
    const inferenceCount = this.inferenceTimestamps.filter((t) => t > now - 1000).length;

    const p95Inf = this.calculatePercentile(this.inferenceTimesMs, 0.95);
    const medInf = this.calculatePercentile(this.inferenceTimesMs, 0.50);
    const p95Ren = this.calculatePercentile(this.renderTimesMs, 0.95);

    // Memory query fallback
    let memoryMb = 0;
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      memoryMb = Math.round((performance as any).memory.usedJSHeapSize / (1024 * 1024));
    }

    return {
      renderFps: renderCount,
      inferenceRateHz: inferenceCount,
      inferenceP95Ms: Math.round(p95Inf * 10) / 10,
      inferenceMedianMs: Math.round(medInf * 10) / 10,
      renderP95Ms: Math.round(p95Ren * 10) / 10,
      memoryMb,
      isDegradedMode: this.isDegraded,
    };
  }

  private calculatePercentile(data: number[], percentile: number): number {
    if (data.length === 0) return 0;
    const sorted = [...data].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.floor(sorted.length * percentile));
    return sorted[index];
  }
}
