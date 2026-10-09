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
      return {
        primaryInstruction: null,
        secondaryInstructions: [],
        allActiveInstructions: [],
        framingInstruction: 'Step back so full upper body is visible',
      };
    }

    if (matchResult.missingLandmarks.length > 0) {
      const missingUpper = matchResult.missingLandmarks.some((idx) => idx <= 16);
      const missingLower = matchResult.missingLandmarks.some((idx) => idx >= 23);
      let text = 'Adjust your position so all joints are visible';
      if (missingLower && !missingUpper) {
        text = 'Step back so your legs and feet are in frame';
      } else if (missingUpper) {
        text = 'Step back so your arms and hands are in frame';
      }
      return {
        primaryInstruction: null,
        secondaryInstructions: [],
        allActiveInstructions: [],
        framingInstruction: text,
      };
    }

    // 2. Filter unresolved features (r > 1.0)
    const rawViolations = matchResult.unresolvedFeatures.filter((f) => f.visible);

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
      direction = f.delta < 0 ? 'bend' : 'straighten';
      text = direction === 'bend'
        ? TEMPLATES.bend_elbow({ slightly: isSlightly, anatomicalSide: 'left', jointName, direction })
        : TEMPLATES.straighten_elbow({ slightly: isSlightly, anatomicalSide: 'left', jointName, direction });
    } else if (f.featureId.includes('right_elbow') || f.featureId.includes('right_arm')) {
      anatomicalSide = 'right';
      jointIndex = LANDMARK_INDEX.RIGHT_ELBOW;
      jointName = 'right elbow';
      direction = f.delta < 0 ? 'bend' : 'straighten';
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
    } else if (f.featureId.includes('knee') || f.featureId.includes('leg')) {
      anatomicalSide = f.featureId.includes('left') ? 'left' : 'right';
      jointIndex = anatomicalSide === 'left' ? LANDMARK_INDEX.LEFT_KNEE : LANDMARK_INDEX.RIGHT_KNEE;
      jointName = `${anatomicalSide} knee`;
      direction = f.delta < 0 ? 'bend' : 'straighten';
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
    let arrow: CorrectionInstruction['arrow'] = undefined;
    if (targetLandmarks && targetLandmarks[jointIndex] && userLandmarks[jointIndex]) {
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

    // Check existing active instructions for clearing (r < 0.8) and minimum display duration (1200ms)
    for (const [id, active] of Array.from(this.activeInstructions.entries())) {
      const featureMatch = allFeatureResults.find((f) => f.featureId === active.featureId);
      const isResolved = featureMatch ? featureMatch.r < GUIDANCE_CONFIG.CLEAR_TOLERANCE_R : false;
      const displayedDuration = currentTime - active.firstSeenTime;

      if (isResolved && displayedDuration >= GUIDANCE_CONFIG.MIN_DISPLAY_DURATION_MS) {
        // Clear resolved instruction
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
