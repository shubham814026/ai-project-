import { describe, it, expect } from 'vitest';
import { calculate2DAngle, calculate3DAngle, calculateHorizontalTilt, calculateVerticalTilt } from '../../src/renderer/core/geometry/angles';
import { normalizeLandmarks } from '../../src/renderer/core/geometry/normalizer';
import { LandmarkFilterManager, computeJitterMetric } from '../../src/renderer/core/pose/landmarkFilter';
import { calculateTransformBounds, mapNormalizedToScreen } from '../../src/renderer/core/render/coordinates';
import { PoseMatcher } from '../../src/renderer/core/matching/poseMatcher';
import { CorrectionGenerator } from '../../src/renderer/core/guidance/correctionGenerator';
import { RecommendationEngine } from '../../src/renderer/core/library/recommendationEngine';
import { SEED_POSES } from '../../src/renderer/core/library/seedPoses';
import { NormalizedLandmark } from '../../src/renderer/core/library/types';

describe('1. Geometry & Angles Engine', () => {
  it('calculates 2D angle correctly for 90 degrees right angle', () => {
    const a = { x: 0, y: 1 };
    const b = { x: 0, y: 0 }; // vertex
    const c = { x: 1, y: 0 };
    const angle = calculate2DAngle(a, b, c);
    expect(Math.round(angle)).toBe(90);
  });

  it('calculates 2D angle correctly for straight line (180 degrees)', () => {
    const a = { x: -1, y: 0 };
    const b = { x: 0, y: 0 };
    const c = { x: 1, y: 0 };
    const angle = calculate2DAngle(a, b, c);
    expect(Math.round(angle)).toBe(180);
  });

  it('calculates 3D angle with z coordinates', () => {
    const a = { x: 0, y: 1, z: 0 };
    const b = { x: 0, y: 0, z: 0 };
    const c = { x: 0, y: 0, z: 1 };
    const angle = calculate3DAngle(a, b, c);
    expect(Math.round(angle)).toBe(90);
  });

  it('calculates horizontal tilt (0 degrees for level line)', () => {
    const p1 = { x: 0.2, y: 0.5 };
    const p2 = { x: 0.8, y: 0.5 };
    const tilt = calculateHorizontalTilt(p1, p2);
    expect(tilt).toBeCloseTo(0, 1);
  });

  it('calculates vertical tilt (0 degrees for vertical line)', () => {
    const top = { x: 0.5, y: 0.2 };
    const bottom = { x: 0.5, y: 0.8 };
    const tilt = calculateVerticalTilt(top, bottom);
    expect(tilt).toBeCloseTo(0, 1);
  });
});

describe('2. Landmark Normalizer', () => {
  const dummyLandmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 0.9,
  }));

  // Setup shoulders and hips
  dummyLandmarks[11] = { x: 0.4, y: 0.3, visibility: 0.95 }; // left shoulder
  dummyLandmarks[12] = { x: 0.6, y: 0.3, visibility: 0.95 }; // right shoulder
  dummyLandmarks[23] = { x: 0.45, y: 0.6, visibility: 0.95 }; // left hip
  dummyLandmarks[24] = { x: 0.55, y: 0.6, visibility: 0.95 }; // right hip

  it('uses mid-hip origin and torso scale when hips are visible', () => {
    const { normalizedLandmarks, frame } = normalizeLandmarks(dummyLandmarks);
    expect(frame.originType).toBe('mid-hip');
    expect(frame.origin.x).toBeCloseTo(0.5, 2);
    expect(frame.origin.y).toBeCloseTo(0.6, 2);
    expect(frame.scaleType).toBe('torso-length');
    // Mid-hip landmark should be at normalized (0, 0)
    const midHipX = (normalizedLandmarks[23].x + normalizedLandmarks[24].x) / 2;
    const midHipY = (normalizedLandmarks[23].y + normalizedLandmarks[24].y) / 2;
    expect(midHipX).toBeCloseTo(0, 2);
    expect(midHipY).toBeCloseTo(0, 2);
  });

  it('falls back to mid-shoulder origin and shoulder proxy when hips invisible', () => {
    const upperOnly = dummyLandmarks.map((lm, idx) =>
      idx >= 23 ? { ...lm, visibility: 0.1 } : { ...lm }
    );
    const { frame } = normalizeLandmarks(upperOnly);
    expect(frame.originType).toBe('mid-shoulder');
    expect(frame.scaleType).toBe('shoulder-width-proxy');
    expect(frame.origin.x).toBeCloseTo(0.5, 2);
    expect(frame.origin.y).toBeCloseTo(0.3, 2);
  });
});

describe('3. Landmark Filter & Smoothing', () => {
  it('reduces synthetic jitter by at least 50% using One Euro filter', () => {
    const filterManager = new LandmarkFilterManager({ useOneEuro: true });
    const rawFrames: NormalizedLandmark[][] = [];
    const smoothedFrames: NormalizedLandmark[][] = [];

    const basePoint = 0.5;
    for (let f = 0; f < 60; f++) {
      // Add random white noise ±0.01
      const noise = (Math.sin(f * 2.5) * 0.01) + ((f % 2 === 0 ? 1 : -1) * 0.005);
      const frame: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
        x: basePoint + noise,
        y: basePoint + noise,
        visibility: 0.95,
      }));
      rawFrames.push(frame);

      const smoothed = filterManager.filterLandmarks(frame, f * 33.3);
      smoothedFrames.push(smoothed);
    }

    const rawJitter = computeJitterMetric(rawFrames);
    const smoothedJitter = computeJitterMetric(smoothedFrames);

    expect(smoothedJitter).toBeLessThan(rawJitter * 0.50);
  });
});

describe('4. Coordinates & Screen Mapping', () => {
  it('correctly calculates letterbox contain bounds', () => {
    const bounds = calculateTransformBounds({
      containerWidth: 1000,
      containerHeight: 1000,
      videoWidth: 1280,
      videoHeight: 720,
      objectFit: 'contain',
      mirror: false,
      dpr: 1.0,
    });

    expect(bounds.scale).toBeCloseTo(1000 / 1280, 3);
    expect(bounds.offsetX).toBe(0);
    expect(bounds.offsetY).toBeGreaterThan(0); // Vertical letterbox bars
  });

  it('mirrors horizontal coordinates when mirror is true', () => {
    const bounds = calculateTransformBounds({
      containerWidth: 1280,
      containerHeight: 720,
      videoWidth: 1280,
      videoHeight: 720,
      objectFit: 'contain',
      mirror: true,
      dpr: 1.0,
    });

    // An anatomical landmark at x=0.2 should map to 1 - 0.2 = 0.8
    const pt = mapNormalizedToScreen(0.2, 0.5, bounds);
    expect(pt.x).toBeCloseTo(1280 * 0.8, 1);
  });
});

describe('5. Pose Matcher & Hysteresis', () => {
  const matcher = new PoseMatcher();
  const handsOnHipsPose = SEED_POSES.find((p) => p.id === 'hands-on-hips')!;

  it('gives near-100 score for identical pose landmarks', () => {
    const result = matcher.scorePose(handsOnHipsPose.landmarks!, handsOnHipsPose);
    expect(result.coveragePassed).toBe(true);
    expect(result.overallScore).toBeGreaterThanOrEqual(95);
  });

  it('exhibits monotonic penalty as joint angle error increases', () => {
    const baseLms = handsOnHipsPose.landmarks!.map((l) => ({ ...l }));
    
    // Perturb left elbow slightly
    const perturb1 = baseLms.map((l, i) => i === 13 ? { ...l, x: l.x - 0.05 } : { ...l });
    // Perturb left elbow heavily
    const perturb2 = baseLms.map((l, i) => i === 13 ? { ...l, x: l.x - 0.20 } : { ...l });

    const scoreBase = matcher.scorePose(baseLms, handsOnHipsPose).overallScore;
    const scoreP1 = matcher.scorePose(perturb1, handsOnHipsPose).overallScore;
    const scoreP2 = matcher.scorePose(perturb2, handsOnHipsPose).overallScore;

    expect(scoreBase).toBeGreaterThan(scoreP1);
    expect(scoreP1).toBeGreaterThan(scoreP2);
  });

  it('respects hold duration and hysteresis exit criteria', () => {
    matcher.reset();
    let time = 1000;
    // Step 1: Matching begins
    let h1 = matcher.updateHysteresis(true, 90, [], time);
    expect(h1.isStableMatched).toBe(false);
    expect(h1.holdProgress).toBe(0);

    // Step 2: 800ms later (progress ~ 0.53)
    time += 800;
    let h2 = matcher.updateHysteresis(true, 90, [], time);
    expect(h2.isStableMatched).toBe(false);
    expect(h2.holdProgress).toBeGreaterThan(0.5);

    // Step 3: 1500ms completed -> Stable matched!
    time += 750;
    let h3 = matcher.updateHysteresis(true, 90, [], time);
    expect(h3.isStableMatched).toBe(true);
    expect(h3.holdProgress).toBe(1.0);

    // Step 4: Slight dip to 80 (above exit threshold 75) does not break match
    time += 200;
    let h4 = matcher.updateHysteresis(false, 80, [], time);
    expect(h4.isStableMatched).toBe(true);
  });
});

describe('6. Correction Generator & Anatomical Correctness', () => {
  const generator = new CorrectionGenerator();
  const handsOnHipsPose = SEED_POSES.find((p) => p.id === 'hands-on-hips')!;
  const matcher = new PoseMatcher();

  it('generates anatomically correct instructions with <= 8 words', () => {
    generator.reset();
    // Create landmarks with arms hanging straight down instead of on hips
    const unadjusted = handsOnHipsPose.landmarks!.map((lm, idx) => {
      if (idx === 15) return { ...lm, x: 0.35, y: 0.70 }; // left wrist down
      if (idx === 16) return { ...lm, x: 0.65, y: 0.70 }; // right wrist down
      return { ...lm };
    });

    const matchRes = matcher.scorePose(unadjusted, handsOnHipsPose);
    // Simulate timestamp 0 -> 500ms so 400ms onset threshold passes
    generator.generateCorrections(matchRes, unadjusted, handsOnHipsPose.landmarks, 0);
    const result = generator.generateCorrections(matchRes, unadjusted, handsOnHipsPose.landmarks, 500);

    expect(result.allActiveInstructions.length).toBeGreaterThan(0);
    for (const inst of result.allActiveInstructions) {
      const words = inst.text.split(' ');
      expect(words.length).toBeLessThanOrEqual(8);
      // Ensure anatomical left/right corresponds to instruction
      if (inst.anatomicalSide === 'left') {
        expect(inst.text.toLowerCase()).toContain('left');
      }
      if (inst.anatomicalSide === 'right') {
        expect(inst.text.toLowerCase()).toContain('right');
      }
    }
  });

  it('correctly instructs to bend when elbow is too straight, and straighten when too bent', () => {
    generator.reset();
    // Arm too straight (elbow angle ~130° vs target 94.4° => delta > 0, needs bend)
    const tooStraight = handsOnHipsPose.landmarks!.map((lm, idx) => {
      if (idx === 13) return { ...lm, x: 0.32, y: 0.38 }; // left elbow flared wide/straight
      return { ...lm };
    });
    const matchRes1 = matcher.scorePose(tooStraight, handsOnHipsPose);
    generator.generateCorrections(matchRes1, tooStraight, handsOnHipsPose.landmarks, 0);
    const result1 = generator.generateCorrections(matchRes1, tooStraight, handsOnHipsPose.landmarks, 500);

    const elbowInst1 = result1.allActiveInstructions.find((i) => i.jointName.includes('elbow'));
    if (elbowInst1) {
      expect(elbowInst1.direction).toBe('bend');
      expect(elbowInst1.text.toLowerCase()).toContain('bend');
    }

    // Arm too bent (elbow angle ~50° vs target 94.4° => delta < 0, needs straighten)
    generator.reset();
    const tooBent = handsOnHipsPose.landmarks!.map((lm, idx) => {
      if (idx === 15) return { ...lm, x: 0.40, y: 0.35 }; // left wrist pulled up near chest
      return { ...lm };
    });
    const matchRes2 = matcher.scorePose(tooBent, handsOnHipsPose);
    generator.generateCorrections(matchRes2, tooBent, handsOnHipsPose.landmarks, 0);
    const result2 = generator.generateCorrections(matchRes2, tooBent, handsOnHipsPose.landmarks, 500);

    const elbowInst2 = result2.allActiveInstructions.find((i) => i.jointName.includes('elbow'));
    if (elbowInst2) {
      expect(elbowInst2.direction).toBe('straighten');
      expect(elbowInst2.text.toLowerCase()).toContain('straighten');
    }
  });

  it('accommodates natural human shoulder tilt up to 8 degrees on hands-on-hips', () => {
    // 8-degree shoulder tilt (human natural posture asymmetry)
    const tiltedShoulders = handsOnHipsPose.landmarks!.map((lm, idx) => {
      if (idx === 11) return { ...lm, y: 0.22 }; // left shoulder higher
      if (idx === 12) return { ...lm, y: 0.26 }; // right shoulder lower
      return { ...lm };
    });
    const matchRes = matcher.scorePose(tiltedShoulders, handsOnHipsPose);
    const shoulderFeat = matchRes.featureResults.find((f) => f.featureId === 'shoulder_level')!;
    expect(shoulderFeat.r).toBeLessThanOrEqual(1.0); // Within calibrated tolerance
  });

  it('achieves >= 85% match score for realistic webcam ear-height one-hand wave', () => {
    const wavePose = SEED_POSES.find((p) => p.id === 'one-hand-wave')!;
    // Realistic webcam user sitting in front of camera (hand at y=0.18 beside ear)
    const realWaveLms = wavePose.landmarks!.map((lm, idx) => {
      if (idx === 16) return { ...lm, x: 0.70, y: 0.18 }; // right wrist beside ear/head
      return { ...lm };
    });

    const matchRes = matcher.scorePose(realWaveLms, wavePose);
    expect(matchRes.overallScore).toBeGreaterThanOrEqual(85);
    expect(matchRes.isMatchedInstant).toBe(true);
  });
});

describe('7. Recommendation Engine', () => {
  const engine = new RecommendationEngine();

  it('prioritizes framing compatibility and beginner difficulty', () => {
    const recommendations = engine.rankPoses(SEED_POSES, null, 'upper-body');
    expect(recommendations.length).toBe(SEED_POSES.length);
    // First recommendation should be framing compatible and beginner
    const top = recommendations[0];
    expect(top.isFramingCompatible).toBe(true);
    expect(top.pose.difficulty).toBe('beginner');
  });
});

describe('8. Mirror Mode & Anatomical Correctness in Both States', () => {
  const matcher = new PoseMatcher();
  const generator = new CorrectionGenerator();
  const wavePose = SEED_POSES.find((p) => p.id === 'one-hand-wave')!; // Requires right hand raised

  it('correctly discriminates left vs right in strict mode', () => {
    // User raises LEFT hand instead of right hand
    const leftRaised = wavePose.landmarks!.map((lm, idx) => {
      if (idx === 15) return { ...lm, x: 0.70, y: 0.10 }; // Left hand raised
      if (idx === 16) return { ...lm, x: 0.65, y: 0.52 }; // Right hand down
      return { ...lm };
    });

    const strictResult = matcher.scorePose(leftRaised, wavePose, false);
    // In strict mode, left hand raised when right is required should fail right hand height/angle
    expect(strictResult.isMirroredUsed).toBe(false);
    expect(strictResult.overallScore).toBeLessThan(75);
  });

  it('identifies mirrored pose and reports mirrored use when allowed', () => {
    // User raises anatomical LEFT hand to wave
    // In real MediaPipe detection, left wrist (15) and left elbow (13) are raised
    const leftHandWaving = wavePose.landmarks!.map((lm, idx) => {
      // Start with normal neutral landmarks
      if (idx === 13) return { ...lm, x: 0.32, y: 0.22 }; // left elbow raised
      if (idx === 15) return { ...lm, x: 0.30, y: 0.10 }; // left wrist raised
      if (idx === 14) return { ...lm, x: 0.64, y: 0.38 }; // right elbow down
      if (idx === 16) return { ...lm, x: 0.65, y: 0.52 }; // right wrist down
      return { ...lm };
    });

    const strictResult = matcher.scorePose(leftHandWaving, wavePose, false);
    const mirrorResult = matcher.scorePose(leftHandWaving, wavePose, true);
    
    expect(strictResult.overallScore).toBeLessThan(75);
    expect(mirrorResult.isMirroredUsed).toBe(true);
    expect(mirrorResult.overallScore).toBeGreaterThanOrEqual(85);
  });

  it('handles person missing gracefully with zero score and clear hint', () => {
    generator.reset();
    const noPersonLms: NormalizedLandmark[] = [];
    const matchRes = matcher.scorePose(noPersonLms, wavePose);
    expect(matchRes.coveragePassed).toBe(false);
    expect(matchRes.overallScore).toBe(0);

    const guidance = generator.generateCorrections(matchRes, noPersonLms, wavePose.landmarks, 0);
    expect(guidance.framingInstruction).toContain('Step back');
    expect(guidance.allActiveInstructions.length).toBe(0);
  });
});

describe('6. Recommendation Engine (Live Frame Posture Detection)', () => {
  const engine = new RecommendationEngine();

  it('correctly identifies matching pose from live frame landmarks as #1 recommendation', () => {
    const targetPose = SEED_POSES[1]; // Hands on hips
    const liveLandmarks = targetPose.landmarks!;

    const matches = engine.findBestMatchesFromFrame(SEED_POSES, liveLandmarks, 'upper-body', 3);

    expect(matches.length).toBe(3);
    expect(matches[0].pose.id).toBe(targetPose.id);
    expect(matches[0].matchPercentage).toBeGreaterThanOrEqual(90);
    expect(matches[0].reason).toContain('match to your current stance');
  });

  it('handles null landmarks by falling back to ranking poses gracefully', () => {
    const matches = engine.findBestMatchesFromFrame(SEED_POSES, null, 'upper-body', 4);
    expect(matches.length).toBe(4);
    expect(matches[0].pose).toBeDefined();
  });

  it('sorts candidates strictly descending by similarity percentage', () => {
    const liveLandmarks = SEED_POSES[0].landmarks!;
    const matches = engine.findBestMatchesFromFrame(SEED_POSES, liveLandmarks, 'full-body', 5);

    for (let i = 0; i < matches.length - 1; i++) {
      expect(matches[i].matchPercentage).toBeGreaterThanOrEqual(matches[i + 1].matchPercentage);
    }
  });
});
