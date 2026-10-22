/**
 * Mutable High-Frequency Render Store
 * Read by the requestAnimationFrame loop at display rate (60 fps)
 * Eliminates React per-frame re-renders (Section A7).
 * Features smooth exponential easing (tau ~ 100ms) between inference steps.
 */

import { NormalizedLandmark } from '../library/types';
import { CorrectionInstruction } from '../guidance/correctionGenerator';
import { CompositionResult } from '../camera/compositionAnalyzer';

export class RenderStore {
  // Target raw landmarks from latest inference
  public targetUserLandmarks: NormalizedLandmark[] | null = null;
  // Eased landmarks drawn to canvas
  public currentEasedLandmarks: NormalizedLandmark[] | null = null;
  // Target pose guide landmarks
  public targetGuideLandmarks: NormalizedLandmark[] | null = null;

  // Camera Guidance Composition (Engine 1)
  public cameraComposition: CompositionResult | null = null;
  public showRuleOfThirds: boolean = true;

  // Visual states
  public corrections: CorrectionInstruction[] = [];
  public matchedJoints: Set<number> = new Set();
  public needsAdjustmentJoints: Set<number> = new Set();

  public holdProgress: number = 0;
  public isStableMatched: boolean = false;
  public trackingLost: boolean = true;
  public fadeOpacity: number = 0; // [0, 1]

  public lastInferenceTimestamp: number = 0;
  public lastEasingTimestamp: number = performance.now();

  private tauMs: number = 100.0; // 100ms time constant for easing

  /**
   * Called by rAF loop at 60 fps to advance exponential easing toward latest landmarks
   */
  public updateEasing(currentTime: number): void {
    const dt = Math.max(1, currentTime - this.lastEasingTimestamp);
    this.lastEasingTimestamp = currentTime;

    // Fade in/out logic (300ms transition)
    const fadeSpeed = dt / 300.0;
    if (this.trackingLost) {
      this.fadeOpacity = Math.max(0, this.fadeOpacity - fadeSpeed);
    } else {
      this.fadeOpacity = Math.min(1, this.fadeOpacity + fadeSpeed);
    }

    if (!this.targetUserLandmarks) {
      return;
    }

    if (!this.currentEasedLandmarks) {
      this.currentEasedLandmarks = this.targetUserLandmarks.map((lm) => ({ ...lm }));
      return;
    }

    // Exponential smoothing factor: alpha = 1 - exp(-dt / tau)
    const alpha = 1.0 - Math.exp(-dt / this.tauMs);

    for (let i = 0; i < this.targetUserLandmarks.length; i++) {
      const tgt = this.targetUserLandmarks[i];
      const cur = this.currentEasedLandmarks[i];
      if (tgt && cur) {
        cur.x += (tgt.x - cur.x) * alpha;
        cur.y += (tgt.y - cur.y) * alpha;
        if (tgt.z !== undefined && cur.z !== undefined) {
          cur.z += (tgt.z - cur.z) * alpha;
        }
        cur.visibility = tgt.visibility;
      }
    }
  }

  // Secondary persons landmarks (when multiple people are detected)
  public secondaryPersonsLandmarks: NormalizedLandmark[][] = [];

  public setInferenceResult(
    landmarks: NormalizedLandmark[] | null,
    corrections: CorrectionInstruction[],
    matchedJoints: Set<number>,
    needsAdjustmentJoints: Set<number>,
    holdProgress: number,
    isStableMatched: boolean,
    timestamp: number,
    secondaryLandmarks: NormalizedLandmark[][] = []
  ): void {
    this.targetUserLandmarks = landmarks;
    this.secondaryPersonsLandmarks = secondaryLandmarks;
    this.corrections = corrections;
    this.matchedJoints = matchedJoints;
    this.needsAdjustmentJoints = needsAdjustmentJoints;
    this.holdProgress = holdProgress;
    this.isStableMatched = isStableMatched;
    this.lastInferenceTimestamp = timestamp;
    this.trackingLost = !landmarks || landmarks.length === 0;
  }

  public setCameraComposition(composition: CompositionResult | null): void {
    this.cameraComposition = composition;
  }

  public reset(): void {
    this.targetUserLandmarks = null;
    this.currentEasedLandmarks = null;
    this.cameraComposition = null;
    this.secondaryPersonsLandmarks = [];
    this.corrections = [];
    this.matchedJoints.clear();
    this.needsAdjustmentJoints.clear();
    this.holdProgress = 0;
    this.isStableMatched = false;
    this.trackingLost = true;
    this.fadeOpacity = 0;
  }
}
