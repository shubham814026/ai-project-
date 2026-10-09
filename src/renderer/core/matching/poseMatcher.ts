/**
 * Pose Matcher Engine
 * Implements:
 * 1. Proposed Angle & Feature Weighted Scorer (Section A8)
 *    r = |delta| / tolerance
 *    s = 1 / (1 + r^2)
 *    Weighted mean with visibility weighting and hysteresis
 * 2. Baseline Euclidean Distance Scorer (Section A8 comparison requirement)
 * Strictly adheres to Section A8 rules
 */

import { ReferencePose, NormalizedLandmark, PoseFeature } from '../library/types';
import { MATCHING_THRESHOLDS, FILTER_CONFIG } from '../settings/constants';
import { calculate2DAngle, calculateHorizontalTilt, calculate2DDistance } from '../geometry/angles';
import { normalizeLandmarks } from '../geometry/normalizer';

export interface FeatureMatchResult {
  featureId: string;
  kind: PoseFeature['kind'];
  measured: number;
  target: number;
  delta: number;
  tolerance: number;
  r: number;
  score: number;
  weight: number;
  critical: boolean;
  landmarks: number[];
  visible: boolean;
}

export interface PoseMatchResult {
  overallScore: number;
  visibleWeightRatio: number;
  coveragePassed: boolean;
  featureResults: FeatureMatchResult[];
  criticalViolations: FeatureMatchResult[];
  unresolvedFeatures: FeatureMatchResult[];
  isMatchedInstant: boolean;
  isMirroredUsed: boolean;
  missingLandmarks: number[];
}

export class PoseMatcher {
  private matchStartTime: number | null = null;
  private exitHysteresisStartTime: number | null = null;
  private isMatchedStable: boolean = false;

  /**
   * Evaluates feature value from normalized or image-plane landmarks
   */
  public evaluateFeature(feature: PoseFeature, landmarks: NormalizedLandmark[], normalized: NormalizedLandmark[]): { value: number; visible: boolean } {
    const lms = feature.landmarks;
    // Check landmark visibility
    const visible = lms.every((idx) => (landmarks[idx]?.visibility ?? 0) >= FILTER_CONFIG.VISIBILITY_THRESHOLD);
    if (!visible) {
      return { value: 0, visible: false };
    }

    let val = 0;
    if (feature.kind === 'angle' && lms.length >= 3) {
      val = calculate2DAngle(landmarks[lms[0]], landmarks[lms[1]], landmarks[lms[2]]);
    } else if (feature.kind === 'tilt' && lms.length >= 2) {
      val = calculateHorizontalTilt(landmarks[lms[0]], landmarks[lms[1]]);
    } else if (feature.kind === 'distance' && lms.length >= 2) {
      // Torso-scaled distance using normalized coordinates
      val = calculate2DDistance(normalized[lms[0]], normalized[lms[1]]);
    } else if (feature.kind === 'position' && lms.length >= 1) {
      // Y-height relative to image plane
      val = landmarks[lms[0]].y;
    }

    return { value: val, visible: true };
  }

  /**
   * Scores user landmarks against reference pose using angle & feature weighted model
   */
  public scorePose(
    userLandmarks: NormalizedLandmark[],
    referencePose: ReferencePose,
    allowMirrored: boolean = false
  ): PoseMatchResult {
    const { normalizedLandmarks: normUser } = normalizeLandmarks(userLandmarks);

    // Score strict
    const strictResult = this.computeScoreInternal(userLandmarks, normUser, referencePose);

    if (!allowMirrored || !referencePose.mirrorAllowed) {
      return strictResult;
    }

    // Anatomically mirror user landmarks (swap left-right pairs and invert x)
    const swapPairs: [number, number][] = [
      [1, 4], [2, 5], [3, 6], [7, 8], [9, 10],
      [11, 12], [13, 14], [15, 16], [17, 18], [19, 20], [21, 22],
      [23, 24], [25, 26], [27, 28], [29, 30], [31, 32],
    ];

    const flippedUser = userLandmarks.map((lm) => ({
      ...lm,
      x: 1.0 - lm.x,
    }));

    for (const [l, r] of swapPairs) {
      if (l < flippedUser.length && r < flippedUser.length) {
        const temp = flippedUser[l];
        flippedUser[l] = flippedUser[r];
        flippedUser[r] = temp;
      }
    }

    const { normalizedLandmarks: normFlipped } = normalizeLandmarks(flippedUser);
    const flippedResult = this.computeScoreInternal(flippedUser, normFlipped, referencePose);

    if (flippedResult.overallScore > strictResult.overallScore) {
      flippedResult.isMirroredUsed = true;
      return flippedResult;
    }

    return strictResult;
  }

  private computeScoreInternal(
    userLandmarks: NormalizedLandmark[],
    normUser: NormalizedLandmark[],
    referencePose: ReferencePose
  ): PoseMatchResult {
    let totalWeight = 0;
    let visibleWeight = 0;
    let weightedScoreSum = 0;
    const featureResults: FeatureMatchResult[] = [];
    const criticalViolations: FeatureMatchResult[] = [];
    const unresolvedFeatures: FeatureMatchResult[] = [];
    const missingLandmarks: number[] = [];

    // Verify required landmarks
    for (const reqIdx of referencePose.requiredLandmarks) {
      if ((userLandmarks[reqIdx]?.visibility ?? 0) < FILTER_CONFIG.VISIBILITY_THRESHOLD) {
        missingLandmarks.push(reqIdx);
      }
    }

    for (const f of referencePose.features) {
      const weightMultiplier = f.critical ? MATCHING_THRESHOLDS.WEIGHT_CRITICAL : f.weight;
      totalWeight += weightMultiplier;

      const { value: measured, visible } = this.evaluateFeature(f, userLandmarks, normUser);

      if (!visible) {
        featureResults.push({
          featureId: f.id,
          kind: f.kind,
          measured: 0,
          target: f.target,
          delta: 0,
          tolerance: f.tolerance,
          r: 999,
          score: 0,
          weight: weightMultiplier,
          critical: !!f.critical,
          landmarks: f.landmarks,
          visible: false,
        });
        continue;
      }

      // Feature passed visibility
      const minVis = Math.min(...f.landmarks.map((idx) => userLandmarks[idx]?.visibility ?? 1.0));
      const effectiveWeight = weightMultiplier * minVis;
      visibleWeight += effectiveWeight;

      const delta = measured - f.target;
      const r = Math.abs(delta) / Math.max(1e-4, f.tolerance);
      const s = 1.0 / (1.0 + r * r);

      weightedScoreSum += s * effectiveWeight;

      const featRes: FeatureMatchResult = {
        featureId: f.id,
        kind: f.kind,
        measured,
        target: f.target,
        delta,
        tolerance: f.tolerance,
        r,
        score: s,
        weight: effectiveWeight,
        critical: !!f.critical,
        landmarks: f.landmarks,
        visible: true,
      };

      featureResults.push(featRes);

      if (r > 1.0) {
        unresolvedFeatures.push(featRes);
      }

      if (f.critical && r > MATCHING_THRESHOLDS.MAX_CRITICAL_R_FOR_MATCH) {
        criticalViolations.push(featRes);
      }
    }

    const visibleWeightRatio = totalWeight > 0 ? visibleWeight / totalWeight : 0;
    const coveragePassed = visibleWeightRatio >= MATCHING_THRESHOLDS.MIN_REQUIRED_WEIGHT_COVERAGE_RATIO;
    const overallScore = coveragePassed && visibleWeight > 0 ? (weightedScoreSum / visibleWeight) * 100 : 0;

    const isMatchedInstant =
      coveragePassed &&
      overallScore >= MATCHING_THRESHOLDS.MATCH_SCORE_THRESHOLD &&
      criticalViolations.length === 0;

    return {
      overallScore: Math.round(overallScore * 10) / 10,
      visibleWeightRatio,
      coveragePassed,
      featureResults,
      criticalViolations,
      unresolvedFeatures,
      isMatchedInstant,
      isMirroredUsed: false,
      missingLandmarks,
    };
  }

  /**
   * Baseline Euclidean Distance Scorer (Section A8)
   * Calculates weighted MediaPipe normalized-landmark distance (Section A8: "weighted normalized-landmark distance").
   */
  public scoreBaselineEuclidean(userLandmarks: NormalizedLandmark[], referencePose: ReferencePose): number {
    if (!referencePose.landmarks) return 0;

    let totalDist = 0;
    let totalWeight = 0;

    for (const reqIdx of referencePose.requiredLandmarks) {
      const u = userLandmarks[reqIdx];
      const r = referencePose.landmarks[reqIdx];
      if (u && r && (u.visibility ?? 1.0) >= FILTER_CONFIG.VISIBILITY_THRESHOLD) {
        const d = calculate2DDistance(u, r);
        const weight = (u.visibility ?? 1.0);
        totalDist += d * weight;
        totalWeight += weight;
      }
    }

    if (totalWeight === 0) return 0;
    const meanDist = totalDist / totalWeight;
    // Map distance [0, 0.4] to score [100, 0]
    return Math.max(0, Math.min(100, (1.0 - meanDist / 0.35) * 100));
  }

  /**
   * Updates hold timer and returns stable match status with hysteresis
   */
  public updateHysteresis(isInstantMatched: boolean, score: number, criticalViolations: FeatureMatchResult[], timestamp: number): {
    isStableMatched: boolean;
    holdProgress: number; // [0, 1]
  } {
    // If currently matched
    if (this.isMatchedStable) {
      const hasSevereCritical = criticalViolations.some((v) => v.r > MATCHING_THRESHOLDS.MAX_CRITICAL_R_EXIT_HYSTERESIS);
      const isDroppingOut = score < MATCHING_THRESHOLDS.MATCH_HYSTERESIS_EXIT_SCORE || hasSevereCritical;

      if (isDroppingOut) {
        if (this.exitHysteresisStartTime === null) {
          this.exitHysteresisStartTime = timestamp;
        } else if (timestamp - this.exitHysteresisStartTime >= MATCHING_THRESHOLDS.EXIT_HYSTERESIS_DURATION_MS) {
          // Exit matched state
          this.isMatchedStable = false;
          this.exitHysteresisStartTime = null;
          this.matchStartTime = null;
        }
      } else {
        this.exitHysteresisStartTime = null;
      }

      return { isStableMatched: this.isMatchedStable, holdProgress: 1.0 };
    }

    // Not matched yet: check hold progress
    if (isInstantMatched) {
      if (this.matchStartTime === null) {
        this.matchStartTime = timestamp;
      }
      const elapsed = timestamp - this.matchStartTime;
      const progress = Math.min(1.0, elapsed / MATCHING_THRESHOLDS.HOLD_DURATION_MS);
      if (progress >= 1.0) {
        this.isMatchedStable = true;
      }
      return { isStableMatched: this.isMatchedStable, holdProgress: progress };
    } else {
      this.matchStartTime = null;
      return { isStableMatched: false, holdProgress: 0 };
    }
  }

  public reset(): void {
    this.matchStartTime = null;
    this.exitHysteresisStartTime = null;
    this.isMatchedStable = false;
  }
}
