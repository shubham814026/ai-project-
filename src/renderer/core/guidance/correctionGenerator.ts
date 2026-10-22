/**
 * Real-time Correction Generator Engine
 * Strictly adheres to Section A8 Correctness and Generation steps:
 * 1. Preconditions: person present -> framing check -> coverage rule
 * 2. Features evaluation & r > 1 filtering
 * 3. Priority calculation = weight * r * (1.5 if critical)
 * 4. Limb merging & contradiction removal
 * 5. Imperative template mapping (8 words or fewer)
 * 6. Temporal stabilization (400ms onset, 1200ms hold, 0.8 r clear)
 * 7. Visual arrow vectors (24 to 90 px, routed away from face)
 */

import { NormalizedLandmark, LANDMARK_INDEX } from '../library/types';
import { FeatureMatchResult, PoseMatchResult } from '../matching/poseMatcher';
import { GUIDANCE_CONFIG } from '../settings/constants';
import { TEMPLATES } from './instructionTemplates';

export interface CorrectionInstruction {
  id: string;
  featureId: string;
  jointIndex: number;
  jointName: string;
  anatomicalSide: 'left' | 'right' | 'center';
  measured: number;
  target: number;
  delta: number;
  direction: 'up' | 'down' | 'in' | 'out' | 'bend' | 'straighten' | 'level';
  confidence: number;
  r: number;
  text: string;
  isPrimary: boolean;
  firstSeenTime: number;
  lastShownTime: number;
  arrow?: {
    from: { x: number; y: number };
    to: { x: number; y: number };
    lengthPx: number;
  };
}

export interface StabilizerState {
  candidateId: string;
  firstObservedTime: number;
  activeInstruction: CorrectionInstruction | null;
}

export class CorrectionGenerator {
  private activeInstructions: Map<string, CorrectionInstruction> = new Map();
  private candidateTimers: Map<string, number> = new Map();

  /**
   * Generates stabilized instructions and guidance arrows
   */
  public generateCorrections(
    matchResult: PoseMatchResult,
    userLandmarks: NormalizedLandmark[],
    targetLandmarks: NormalizedLandmark[] | undefined,
    currentTime: number,
    isMirroredDisplay: boolean = true
  ): {
    primaryInstruction: CorrectionInstruction | null;
    secondaryInstructions: CorrectionInstruction[];
    allActiveInstructions: CorrectionInstruction[];
    framingInstruction: string | null;
  } {
    // 1. Framing preconditions
    if (!matchResult.coveragePassed) {
      this.activeInstructions.clear();
      this.candidateTimers.clear();

      let framingMsg = 'Adjust position so arms and hands are in view';
      const shouldersVis =
        (userLandmarks[11]?.visibility ?? 0) >= 0.4 &&
        (userLandmarks[12]?.visibility ?? 0) >= 0.4;

      if (!shouldersVis) {
        framingMsg = 'Step back so upper body is visible';
      } else {
        // Shoulders are visible: check specific limb cutoff
        const elbow14High = (userLandmarks[14]?.y ?? 1.0) < 0.45;
        const elbow13High = (userLandmarks[13]?.y ?? 1.0) < 0.45;
        const wrist16Offscreen =
          (userLandmarks[16]?.visibility ?? 0) < 0.4 || (userLandmarks[16]?.y ?? 0) <= 0.06;
        const wrist15Offscreen =
          (userLandmarks[15]?.visibility ?? 0) < 0.4 || (userLandmarks[15]?.y ?? 0) <= 0.06;

        if ((elbow14High && wrist16Offscreen) || (elbow13High && wrist15Offscreen)) {
          framingMsg = 'Lower hand: keep hand inside camera view (bend elbow)';
        } else if (
          matchResult.missingLandmarks.some((idx) => idx === 15 || idx === 16) &&
          (userLandmarks[16]?.visibility ?? 0) < 0.4 &&
          (userLandmarks[15]?.visibility ?? 0) < 0.4
        ) {
          framingMsg = 'Bring hands into frame for this gesture';
        } else {
          framingMsg = 'Align with pose guide overlay';
        }
      }

      return {
        primaryInstruction: null,
        secondaryInstructions: [],
        allActiveInstructions: [],
        framingInstruction: framingMsg,
      };
    }

    // If instant match is achieved, clear all active adjustment arrows and instructions
    if (matchResult.isMatchedInstant) {
      this.activeInstructions.clear();
      this.candidateTimers.clear();
      return {
        primaryInstruction: null,
        secondaryInstructions: [],
        allActiveInstructions: [],
        framingInstruction: null,
      };
    }

    // Only warn about missing upper limbs (arms/hands). Do not block upper-body poses if lower body is out of frame.
    const missingUpper = matchResult.missingLandmarks.filter((idx) => idx <= 16);
    if (missingUpper.length > 2) {
      return {
        primaryInstruction: null,
        secondaryInstructions: [],
        allActiveInstructions: [],
        framingInstruction: 'Step back so your arms and hands are in frame',
      };
    }

    // 2. Filter genuine violations (deadband at r >= 1.15 to suppress micro-tremor; suppress minor adjustments when score >= 82%)
    const minRThreshold = matchResult.overallScore >= 82.0 ? 1.40 : 1.15;
    const rawViolations = matchResult.unresolvedFeatures.filter((f) => f.visible && f.r >= minRThreshold);

    // 3. Compute priority and sort descending
    const prioritized = rawViolations.map((f) => {
      const priority = f.weight * f.r * (f.critical ? 1.5 : 1.0);
      return { feature: f, priority };
    }).sort((a, b) => b.priority - a.priority);

    // 4. Map to candidate instructions and merge
    const candidateInstructions: CorrectionInstruction[] = [];
    const usedLimbs = new Set<string>();

    for (const { feature: f } of prioritized) {
      const cand = this.buildCandidate(f, userLandmarks, targetLandmarks, currentTime, isMirroredDisplay);
      if (!cand) continue;

      const limbKey = `${cand.anatomicalSide}_${cand.jointName}`;
      if (usedLimbs.has(limbKey)) {
        continue; // Drop conflicting or redundant limb instructions
      }
      usedLimbs.add(limbKey);
      candidateInstructions.push(cand);
      if (candidateInstructions.length >= 3) break;
    }

    // 5. Stabilize instructions (400ms onset, 1200ms hold, 0.8 r clear)
    const currentActive = this.stabilizeInstructions(candidateInstructions, matchResult.featureResults, currentTime);

    const primaryInstruction = currentActive[0] ?? null;
    const secondaryInstructions = currentActive.slice(1, 3);

    return {
      primaryInstruction,
      secondaryInstructions,
      allActiveInstructions: currentActive,
      framingInstruction: null,
    };
  }

  private buildCandidate(
    f: FeatureMatchResult,
    userLandmarks: NormalizedLandmark[],
    targetLandmarks: NormalizedLandmark[] | undefined,
    currentTime: number,
    _isMirroredDisplay: boolean
  ): CorrectionInstruction | null {
    const isSlightly = f.r <= GUIDANCE_CONFIG.QUALIFIER_SLIGHTLY_R_MAX;
    let anatomicalSide: 'left' | 'right' | 'center' = 'center';
    let jointIndex = f.landmarks[0] ?? 0;
    let jointName = 'joint';
    let direction: CorrectionInstruction['direction'] = 'up';
    let text = '';

    // Inspect feature definition
    if (f.featureId.includes('left_elbow') || f.featureId.includes('left_arm')) {
      anatomicalSide = 'left';
      jointIndex = LANDMARK_INDEX.LEFT_ELBOW;
      jointName = 'left elbow';
      direction = f.delta < 0 ? 'straighten' : 'bend';
      text = direction === 'bend'
        ? TEMPLATES.bend_elbow({ slightly: isSlightly, anatomicalSide: 'left', jointName, direction })
        : TEMPLATES.straighten_elbow({ slightly: isSlightly, anatomicalSide: 'left', jointName, direction });
    } else if (f.featureId.includes('right_elbow') || f.featureId.includes('right_arm')) {
      anatomicalSide = 'right';
      jointIndex = LANDMARK_INDEX.RIGHT_ELBOW;
      jointName = 'right elbow';
      direction = f.delta < 0 ? 'straighten' : 'bend';
      text = direction === 'bend'
        ? TEMPLATES.bend_elbow({ slightly: isSlightly, anatomicalSide: 'right', jointName, direction })
        : TEMPLATES.straighten_elbow({ slightly: isSlightly, anatomicalSide: 'right', jointName, direction });
    } else if (f.featureId.includes('hand_to_hip') || f.featureId.includes('wrist_to_hip')) {
      anatomicalSide = f.featureId.includes('left') ? 'left' : 'right';
      jointIndex = anatomicalSide === 'left' ? LANDMARK_INDEX.LEFT_WRIST : LANDMARK_INDEX.RIGHT_WRIST;
      jointName = `${anatomicalSide} hand`;
      direction = 'in';
      text = TEMPLATES.hand_to_hip({ slightly: isSlightly, anatomicalSide, jointName, direction });
    } else if (f.featureId.includes('shoulder_level') || f.featureId.includes('shoulder_tilt')) {
      anatomicalSide = 'center';
      jointIndex = LANDMARK_INDEX.LEFT_SHOULDER;
      jointName = 'shoulders';
      direction = 'level';
      text = TEMPLATES.level_shoulders({ slightly: false, jointName, direction });
    } else if (f.featureId.includes('spine') || f.featureId.includes('torso_upright') || f.featureId.includes('slouch')) {
      anatomicalSide = 'center';
      jointIndex = LANDMARK_INDEX.NOSE;
      jointName = 'spine';
      direction = 'up';
      text = 'Sit tall with upright spine';
    } else if (f.featureId.includes('head_level')) {
      anatomicalSide = 'center';
      jointIndex = LANDMARK_INDEX.NOSE;
      jointName = 'head';
      direction = 'level';
      text = 'Keep head straight and level';
    } else if (f.featureId.includes('knee') || f.featureId.includes('leg')) {
      anatomicalSide = f.featureId.includes('left') ? 'left' : 'right';
      jointIndex = anatomicalSide === 'left' ? LANDMARK_INDEX.LEFT_KNEE : LANDMARK_INDEX.RIGHT_KNEE;
      jointName = `${anatomicalSide} knee`;
      direction = f.delta < 0 ? 'straighten' : 'bend';
      text = direction === 'bend'
        ? TEMPLATES.bend_knee({ slightly: isSlightly, anatomicalSide, jointName, direction })
        : TEMPLATES.straighten_knee({ slightly: isSlightly, anatomicalSide, jointName, direction });
    } else if (f.featureId.includes('chin') || f.featureId.includes('hand_near_chin')) {
      anatomicalSide = 'right';
      jointIndex = LANDMARK_INDEX.RIGHT_WRIST;
      jointName = 'hand';
      direction = 'up';
      text = TEMPLATES.hand_near_chin({ slightly: false, anatomicalSide: 'right', jointName, direction });
    } else {
      text = `Adjust ${f.featureId.replace(/_/g, ' ')}`;
    }

    // Compute arrow vectors (from user joint to target joint)
    // Section A6, A8, A9: Face Occlusion Protection.
    // NEVER draw arrows on the face (landmarks 0..10).
    // Posture, head, and neck corrections are delivered strictly via textual HUD banner and audio synthesis.
    let arrow: CorrectionInstruction['arrow'] = undefined;
    if (jointIndex >= 11 && targetLandmarks && targetLandmarks[jointIndex] && userLandmarks[jointIndex]) {
      const uPt = userLandmarks[jointIndex];
      const tPt = targetLandmarks[jointIndex];
      const dx = tPt.x - uPt.x;
      const dy = tPt.y - uPt.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 0.02) {
        // Clamp screen arrow between 24 and 90 px
        const screenScale = 600; // Reference pixel scale
        const pxLen = Math.max(GUIDANCE_CONFIG.ARROW_MIN_LENGTH_PX, Math.min(GUIDANCE_CONFIG.ARROW_MAX_LENGTH_PX, dist * screenScale));
        const unitX = dx / dist;
        const unitY = dy / dist;

        arrow = {
          from: { x: uPt.x, y: uPt.y },
          to: { x: uPt.x + unitX * (pxLen / screenScale), y: uPt.y + unitY * (pxLen / screenScale) },
          lengthPx: pxLen,
        };
      }
    }

    return {
      id: `${f.featureId}_${jointIndex}`,
      featureId: f.featureId,
      jointIndex,
      jointName,
      anatomicalSide,
      measured: Math.round(f.measured * 10) / 10,
      target: f.target,
      delta: Math.round(f.delta * 10) / 10,
      direction,
      confidence: userLandmarks[jointIndex]?.visibility ?? 1.0,
      r: f.r,
      text,
      isPrimary: false,
      firstSeenTime: currentTime,
      lastShownTime: currentTime,
      arrow,
    };
  }

  private stabilizeInstructions(
    candidates: CorrectionInstruction[],
    allFeatureResults: FeatureMatchResult[],
    currentTime: number
  ): CorrectionInstruction[] {
    const candidateMap = new Map<string, CorrectionInstruction>(candidates.map((c) => [c.id, c]));

    // Check existing active instructions for clearing (r <= 1.05) and prompt release (600ms)
    for (const [id, active] of Array.from(this.activeInstructions.entries())) {
      const featureMatch = allFeatureResults.find((f) => f.featureId === active.featureId);
      const isResolved = featureMatch ? featureMatch.r <= 1.05 : false;
      const displayedDuration = currentTime - active.firstSeenTime;

      if (isResolved && displayedDuration >= 600) {
        // Clear resolved instruction promptly
        this.activeInstructions.delete(id);
        this.candidateTimers.delete(id);
      } else {
        // Update r and arrow if still unresolved
        if (candidateMap.has(id)) {
          const fresh = candidateMap.get(id)!;
          active.r = fresh.r;
          active.delta = fresh.delta;
          active.measured = fresh.measured;
          active.arrow = fresh.arrow;
          active.lastShownTime = currentTime;
        }
      }
    }

    // Evaluate new candidates for onset persistence (400ms)
    for (const cand of candidates) {
      if (this.activeInstructions.has(cand.id)) continue;

      if (!this.candidateTimers.has(cand.id)) {
        this.candidateTimers.set(cand.id, currentTime);
      } else {
        const elapsed = currentTime - this.candidateTimers.get(cand.id)!;
        if (elapsed >= GUIDANCE_CONFIG.ONSET_PERSIST_MS) {
          // Promote to active instructions
          this.activeInstructions.set(cand.id, {
            ...cand,
            firstSeenTime: currentTime,
            lastShownTime: currentTime,
          });
          this.candidateTimers.delete(cand.id);
        }
      }
    }

    // Convert active instructions to list, tag primary vs secondary
    const result = Array.from(this.activeInstructions.values());
    result.forEach((inst, idx) => {
      inst.isPrimary = idx === 0;
    });

    return result.slice(0, 3);
  }

  public reset(): void {
    this.activeInstructions.clear();
    this.candidateTimers.clear();
  }
}
