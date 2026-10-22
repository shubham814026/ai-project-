import { describe, it, expect } from 'vitest';
import { CompositionAnalyzer } from '../../src/renderer/core/camera/compositionAnalyzer';
import { NormalizedLandmark } from '../../src/renderer/core/library/types';

describe('CompositionAnalyzer (Camera Guidance Engine)', () => {
  const analyzer = new CompositionAnalyzer();

  // Helper to build a standard skeleton
  function createTestSkeleton(opts: {
    centerX?: number;
    noseY?: number;
    includeLegs?: boolean;
    includeTorso?: boolean;
  } = {}): NormalizedLandmark[] {
    const cx = opts.centerX ?? 0.50;
    const ny = opts.noseY ?? 0.19; // Nose at 0.19 -> crown around 0.12 (optimal headroom)
    const includeLegs = opts.includeLegs ?? true;
    const includeTorso = opts.includeTorso ?? true;

    const landmarks: NormalizedLandmark[] = [];
    for (let i = 0; i < 33; i++) {
      landmarks.push({ x: cx, y: 0.5, z: 0, visibility: 0.9 });
    }

    // Head / Face
    landmarks[0] = { x: cx, y: ny, z: 0, visibility: 0.95 }; // Nose
    landmarks[2] = { x: cx - 0.03, y: ny - 0.02, z: 0, visibility: 0.95 }; // Left Eye
    landmarks[5] = { x: cx + 0.03, y: ny - 0.02, z: 0, visibility: 0.95 }; // Right Eye

    // Shoulders
    landmarks[11] = { x: cx - 0.12, y: ny + 0.14, z: 0, visibility: 0.95 };
    landmarks[12] = { x: cx + 0.12, y: ny + 0.14, z: 0, visibility: 0.95 };

    // Hips
    if (includeTorso) {
      landmarks[23] = { x: cx - 0.08, y: ny + 0.38, z: 0, visibility: 0.90 };
      landmarks[24] = { x: cx + 0.08, y: ny + 0.38, z: 0, visibility: 0.90 };
    } else {
      landmarks[23] = { x: cx, y: 0, z: 0, visibility: 0.1 };
      landmarks[24] = { x: cx, y: 0, z: 0, visibility: 0.1 };
    }

    // Knees & Ankles
    if (includeLegs) {
      landmarks[25] = { x: cx - 0.08, y: ny + 0.55, z: 0, visibility: 0.90 };
      landmarks[26] = { x: cx + 0.08, y: ny + 0.55, z: 0, visibility: 0.90 };
      landmarks[27] = { x: cx - 0.08, y: ny + 0.75, z: 0, visibility: 0.90 };
      landmarks[28] = { x: cx + 0.08, y: ny + 0.75, z: 0, visibility: 0.90 };
    } else {
      landmarks[25] = { x: cx, y: 0, z: 0, visibility: 0.1 };
      landmarks[26] = { x: cx, y: 0, z: 0, visibility: 0.1 };
      landmarks[27] = { x: cx, y: 0, z: 0, visibility: 0.1 };
      landmarks[28] = { x: cx, y: 0, z: 0, visibility: 0.1 };
    }

    return landmarks;
  }

  it('handles null or empty landmarks gracefully', () => {
    const res = analyzer.analyzeComposition(null);
    expect(res.framingScore).toBe(0);
    expect(res.status).toBe('needs-adjustment');
    expect(res.guidanceCue).toBe('Step into camera frame');
    expect(res.metrics.shotScale).toBe('out-of-frame');
  });

  it('evaluates optimal centered full-body framing with high score', () => {
    const skel = createTestSkeleton({ centerX: 0.50, noseY: 0.19, includeLegs: true });
    const res = analyzer.analyzeComposition(skel, 'full-body');

    expect(res.framingScore).toBeGreaterThanOrEqual(80);
    expect(res.metrics.shotScale).toBe('full-body');
    expect(res.isCompatibleWithTarget).toBe(true);
    expect(res.guidanceCue).toContain('optimal');
  });

  it('detects off-center placement and generates correction cue', () => {
    // Subject positioned far to the right (x = 0.75)
    const skel = createTestSkeleton({ centerX: 0.75, includeLegs: true });
    const res = analyzer.analyzeComposition(skel, 'either', true);

    expect(res.metrics.centerOffset).toBeGreaterThan(0.15);
    expect(res.guidanceCue).toContain('Shift right');
    expect(res.framingScore).toBeLessThan(75);
  });

  it('classifies medium-shot correctly when lower limbs are not visible', () => {
    const skel = createTestSkeleton({ centerX: 0.50, includeLegs: false, includeTorso: true });
    const res = analyzer.analyzeComposition(skel, 'upper-body');

    expect(res.metrics.shotScale).toBe('medium-shot');
    expect(res.isCompatibleWithTarget).toBe(true);
  });

  it('penalizes framing when full-body pose is selected but only upper-body is in frame', () => {
    const skel = createTestSkeleton({ centerX: 0.50, includeLegs: false, includeTorso: true });
    const res = analyzer.analyzeComposition(skel, 'full-body');

    expect(res.isCompatibleWithTarget).toBe(false);
    expect(res.guidanceCue).toContain('Step back: full-body stance required');
  });

  it('detects head cut off at top of frame', () => {
    const skel = createTestSkeleton({ centerX: 0.50, noseY: 0.05 });
    // Force nose right at top
    skel[0].y = 0.03;
    const res = analyzer.analyzeComposition(skel);

    expect(res.guidanceCue).toContain('Tilt camera up');
    expect(res.status).toBe('needs-adjustment');
  });
});
