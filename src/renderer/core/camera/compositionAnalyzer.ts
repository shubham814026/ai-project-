/**
 * Camera Composition & Framing Analyzer (Engine 1: Camera Guidance)
 * 
 * Implements Computer Vision Heuristic Principles:
 * 1. Headroom Ratio: y_crown / H (Target: 10% - 16%)
 * 2. Horizontal Centering Offset: |x_center - 0.5| (Target: <= 0.08)
 * 3. Rule of Thirds Eye-Line Alignment: distance to y = 0.333
 * 4. Shot Scale Classification: 'full-body' | 'medium-shot' | 'portrait' | 'partial' | 'out-of-frame'
 * 5. Target Pose Framing Compatibility: Penalizes distance mismatches
 * 6. Actionable Natural Language Directorial Cues
 * 
 * Algorithmic Principles:
 * - Hierarchical Optimization: Framing verified prior to fine kinematic matching
 * - Cauchy-based Continuous Loss Formulation for multi-objective framing alignment
 * - Production Rule Directorial System: Maps geometric deviations to real-time guidance cues
 */

import { NormalizedLandmark } from '../library/types';

export type ShotScale = 'full-body' | 'medium-shot' | 'portrait' | 'partial' | 'out-of-frame';

export interface CompositionMetrics {
  headroomRatio: number;
  centerOffset: number;
  eyeLineY: number;
  subjectAreaFraction: number;
  shotScale: ShotScale;
  ruleOfThirdsOffset: number;
}

export interface CompositionResult {
  metrics: CompositionMetrics;
  framingScore: number; // 0 to 100
  status: 'optimal' | 'acceptable' | 'needs-adjustment';
  guidanceCue: string;
  isCompatibleWithTarget: boolean;
  gridLines: {
    ruleOfThirdsX: [number, number];
    ruleOfThirdsY: [number, number];
  };
  boundingBox: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    centerX: number;
    centerY: number;
  };
}

export class CompositionAnalyzer {
  public static readonly OPTIMAL_HEADROOM = 0.16;
  public static readonly OPTIMAL_HEADROOM_TOLERANCE = 0.14;
  public static readonly OPTIMAL_CENTER_TOLERANCE = 0.14;
  public static readonly RULE_OF_THIRDS_TOP = 0.32;

  /**
   * Analyzes camera composition and framing from detected 3D landmarks
   */
  public analyzeComposition(
    landmarks: NormalizedLandmark[] | null,
    targetFramingRequirement: 'full-body' | 'upper-body' | 'either' = 'either',
    isMirrored: boolean = true
  ): CompositionResult {
    // Default grid lines
    const gridLines = {
      ruleOfThirdsX: [0.333, 0.667] as [number, number],
      ruleOfThirdsY: [0.333, 0.667] as [number, number],
    };

    // Fallback if no landmarks detected or tracking lost
    if (!landmarks || landmarks.length < 33) {
      return {
        metrics: {
          headroomRatio: 0,
          centerOffset: 0.5,
          eyeLineY: 0,
          subjectAreaFraction: 0,
          shotScale: 'out-of-frame',
          ruleOfThirdsOffset: 0.5,
        },
        framingScore: 0,
        status: 'needs-adjustment',
        guidanceCue: 'Step into camera frame',
        isCompatibleWithTarget: false,
        gridLines,
        boundingBox: { minX: 0, minY: 0, maxX: 0, maxY: 0, centerX: 0.5, centerY: 0.5 },
      };
    }

    // 1. Compute bounding box over visible landmarks (visibility >= 0.35)
    let minX = 1.0;
    let maxX = 0.0;
    let minY = 1.0;
    let maxY = 0.0;
    let visibleCount = 0;

    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];
      if ((lm.visibility ?? 1.0) >= 0.35) {
        visibleCount++;
        if (lm.x < minX) minX = lm.x;
        if (lm.x > maxX) maxX = lm.x;
        if (lm.y < minY) minY = lm.y;
        if (lm.y > maxY) maxY = lm.y;
      }
    }

    if (visibleCount < 6) {
      return {
        metrics: {
          headroomRatio: 0,
          centerOffset: 0.5,
          eyeLineY: 0,
          subjectAreaFraction: 0,
          shotScale: 'partial',
          ruleOfThirdsOffset: 0.5,
        },
        framingScore: 15,
        status: 'needs-adjustment',
        guidanceCue: 'Insufficient lighting or partially out of frame',
        isCompatibleWithTarget: false,
        gridLines,
        boundingBox: { minX, minY, maxX, maxY, centerX: 0.5, centerY: 0.5 },
      };
    }

    // Clamp coordinates to [0, 1]
    minX = Math.max(0, Math.min(1, minX));
    maxX = Math.max(0, Math.min(1, maxX));
    minY = Math.max(0, Math.min(1, minY));
    maxY = Math.max(0, Math.min(1, maxY));

    const centerX = (minX + maxX) / 2.0;
    const centerY = (minY + maxY) / 2.0;
    const width = maxX - minX;
    const height = maxY - minY;
    const subjectAreaFraction = Math.max(0.001, width * height);

    // 2. Classify Shot Scale
    const isVisible = (idx: number) => (landmarks[idx]?.visibility ?? 1.0) >= 0.40;
    const anklesVis = isVisible(27) || isVisible(28);
    const kneesVis = isVisible(25) || isVisible(26);
    const hipsVis = isVisible(23) || isVisible(24);
    const shouldersVis = isVisible(11) || isVisible(12);

    let shotScale: ShotScale = 'partial';
    if (anklesVis && kneesVis && hipsVis) {
      shotScale = 'full-body';
    } else if (hipsVis && shouldersVis) {
      shotScale = 'medium-shot';
    } else if (shouldersVis) {
      shotScale = 'portrait';
    }

    // 3. Estimate Crown Height and Headroom Ratio
    const nose = landmarks[0];
    const leftEye = landmarks[2];
    const rightEye = landmarks[5];
    const avgEyeY = (leftEye && rightEye) ? (leftEye.y + rightEye.y) / 2.0 : (nose ? nose.y : minY);

    // Crown estimate: roughly 6-8% above nose in normalized coordinates
    const crownY = Math.max(0.0, (nose ? nose.y - 0.07 : minY));
    const headroomRatio = crownY; // distance from top of frame

    // 4. Centering Offset from Canvas Midpoint (0.50)
    const midShoulderX = shouldersVis
      ? (landmarks[11].x + landmarks[12].x) / 2.0
      : centerX;
    const centerOffset = midShoulderX - 0.5;
    const absCenterOffset = Math.abs(centerOffset);

    // 5. Rule of Thirds Eye Alignment
    const ruleOfThirdsOffset = Math.abs(avgEyeY - CompositionAnalyzer.RULE_OF_THIRDS_TOP);

    // 6. Compute Heuristic Scores (Lorentzian/Cauchy loss)
    const sCenter = 1.0 / (1.0 + Math.pow(absCenterOffset / CompositionAnalyzer.OPTIMAL_CENTER_TOLERANCE, 2));
    const headroomDiff = Math.abs(headroomRatio - CompositionAnalyzer.OPTIMAL_HEADROOM);
    const sHeadroom = 1.0 / (1.0 + Math.pow(headroomDiff / CompositionAnalyzer.OPTIMAL_HEADROOM_TOLERANCE, 2));
    const sThirds = 1.0 / (1.0 + Math.pow(ruleOfThirdsOffset / 0.22, 2));

    // Target compatibility multiplier: For solo creators/podcasters, 'portrait' and 'medium-shot' are 100% optimal for upper-body
    let compatibilityMultiplier = 1.0;
    let isCompatibleWithTarget = true;

    if (targetFramingRequirement === 'full-body' && shotScale !== 'full-body') {
      compatibilityMultiplier = 0.65;
      isCompatibleWithTarget = false;
    } else if (targetFramingRequirement === 'upper-body' && shotScale === 'partial') {
      compatibilityMultiplier = 0.75;
      isCompatibleWithTarget = false;
    }

    // Weighted composite framing score
    const rawScore = (0.45 * sCenter + 0.35 * sHeadroom + 0.20 * sThirds) * compatibilityMultiplier;
    const framingScore = Math.max(0, Math.min(100, Math.round(rawScore * 100)));

    // 7. Formulate Directorial Guidance Cues (Rule-Based Production System)
    let guidanceCue = 'Camera framing optimal (Rule of Thirds)';
    let status: 'optimal' | 'acceptable' | 'needs-adjustment' = 'optimal';

    if (crownY < 0.02) {
      guidanceCue = 'Tilt camera up: head cut off at top';
      status = 'needs-adjustment';
    } else if (targetFramingRequirement === 'full-body' && shotScale !== 'full-body') {
      guidanceCue = 'Step back: full-body stance required';
      status = 'needs-adjustment';
    } else if (absCenterOffset > 0.15) {
      if (isMirrored) {
        guidanceCue = centerOffset < 0 ? 'Shift left to center' : 'Shift right to center';
      } else {
        guidanceCue = centerOffset < 0 ? 'Shift right to center' : 'Shift left to center';
      }
      status = 'needs-adjustment';
    } else if (headroomRatio > 0.24) {
      guidanceCue = 'Sit taller: spine slouched or head too low';
      status = 'needs-adjustment';
    } else if (headroomRatio > 0.19) {
      guidanceCue = 'Straighten posture slightly';
      status = 'acceptable';
    } else if (subjectAreaFraction < 0.04) {
      guidanceCue = 'Move closer to the microphone & camera';
      status = 'acceptable';
    } else if (framingScore >= 80) {
      guidanceCue = 'Camera framing optimal';
      status = 'optimal';
    } else if (framingScore >= 65) {
      guidanceCue = 'Framing acceptable';
      status = 'acceptable';
    } else {
      guidanceCue = 'Align with framing guidelines';
      status = 'needs-adjustment';
    }

    return {
      metrics: {
        headroomRatio,
        centerOffset,
        eyeLineY: avgEyeY,
        subjectAreaFraction,
        shotScale,
        ruleOfThirdsOffset,
      },
      framingScore,
      status,
      guidanceCue,
      isCompatibleWithTarget,
      gridLines,
      boundingBox: {
        minX,
        minY,
        maxX,
        maxY,
        centerX,
        centerY,
      },
    };
  }
}
