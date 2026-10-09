import { describe, it, expect, beforeEach } from 'vitest';
import { RenderStore } from '../../src/renderer/core/render/renderStore';
import { PerformanceMonitor } from '../../src/renderer/core/perf/performanceMonitor';
import { SettingsManager } from '../../src/renderer/core/settings/settingsManager';
import { calculateTransformBounds, mapNormalizedToScreen } from '../../src/renderer/core/render/coordinates';
import { TEMPLATES } from '../../src/renderer/core/guidance/instructionTemplates';
import { LandmarkFilterManager } from '../../src/renderer/core/pose/landmarkFilter';

describe('RenderStore Unit Tests', () => {
  let store: RenderStore;

  beforeEach(() => {
    store = new RenderStore();
  });

  it('initializes with default empty and tracking lost state', () => {
    expect(store.trackingLost).toBe(true);
    expect(store.fadeOpacity).toBe(0);
    expect(store.targetUserLandmarks).toBeNull();
  });

  it('applies exponential easing toward target landmarks', () => {
    const lms = [{ x: 0.8, y: 0.8, visibility: 0.9 }];
    store.setInferenceResult(lms, [], new Set(), new Set(), 0.5, false, 100);

    // Initial easing step creates currentEasedLandmarks
    store.updateEasing(100);
    expect(store.currentEasedLandmarks).not.toBeNull();
    expect(store.currentEasedLandmarks![0].x).toBeCloseTo(0.8);

    // Update target to 0.4
    store.setInferenceResult([{ x: 0.4, y: 0.4, visibility: 0.9 }], [], new Set(), new Set(), 0.5, false, 200);
    // 50ms easing step moves halfway
    store.updateEasing(150);
    expect(store.currentEasedLandmarks![0].x).toBeLessThan(0.8);
    expect(store.currentEasedLandmarks![0].x).toBeGreaterThan(0.4);
  });

  it('resets cleanly', () => {
    store.setInferenceResult([{ x: 0.5, y: 0.5, visibility: 0.9 }], [], new Set(), new Set(), 1.0, true, 100);
    store.reset();
    expect(store.targetUserLandmarks).toBeNull();
    expect(store.isStableMatched).toBe(false);
    expect(store.trackingLost).toBe(true);
  });
});

describe('PerformanceMonitor Unit Tests', () => {
  it('tracks render FPS and latency percentiles accurately', () => {
    const monitor = new PerformanceMonitor();
    const now = performance.now();

    for (let i = 0; i < 30; i++) {
      monitor.recordRenderFrame(3.5, now - 1000 + i * 33);
      monitor.recordInference(25.0, now - 1000 + i * 33);
    }

    const stats = monitor.getStats();
    expect(stats.renderFps).toBeGreaterThanOrEqual(15);
    expect(stats.inferenceRateHz).toBeGreaterThanOrEqual(15);
    expect(stats.inferenceMedianMs).toBeCloseTo(25, 1);
    expect(stats.renderP95Ms).toBeCloseTo(3.5, 1);
  });

  it('triggers degraded mode callback after budget misses for 5s', () => {
    let degradedState = false;
    const monitor = new PerformanceMonitor((degraded) => {
      degradedState = degraded;
    });

    let time = 1000;
    // Feed high inference time > 50ms for 6000ms
    for (let i = 0; i < 60; i++) {
      monitor.recordInference(75.0, time);
      time += 100;
    }

    expect(degradedState).toBe(true);
    expect(monitor.getStats().isDegradedMode).toBe(true);
  });
});

describe('SettingsManager Unit Tests', () => {
  it('loads default settings when localStorage is empty', () => {
    const manager = new SettingsManager();
    const s = manager.getSettings();
    expect(s.mirror).toBe(true);
    expect(s.showSkeleton).toBe(true);
    expect(s.selectedResolution.width).toBe(1280);
  });

  it('updates and persists settings', () => {
    const manager = new SettingsManager();
    const updated = manager.update({ mirror: false, framingMode: 'full-body' });
    expect(updated.mirror).toBe(false);
    expect(updated.framingMode).toBe('full-body');
  });
});

describe('Coordinates Edge Cases (Cover Mode & DPR)', () => {
  it('handles object-fit cover with horizontal cropping', () => {
    const bounds = calculateTransformBounds({
      containerWidth: 800,
      containerHeight: 1000, // taller container
      videoWidth: 1280,
      videoHeight: 720,
      objectFit: 'cover',
      mirror: false,
      dpr: 2.0,
    });

    expect(bounds.scale).toBeCloseTo(1000 / 720, 3);
    expect(bounds.offsetX).toBeLessThan(0); // cropped horizontally
    expect(bounds.dpr).toBe(2.0);

    const pt = mapNormalizedToScreen(0.5, 0.5, bounds);
    expect(pt.bufferX).toBeCloseTo(pt.x * 2.0);
  });
});

describe('Instruction Templates Unit Tests', () => {
  it('formats templates with and without slightly qualifier', () => {
    const t1 = TEMPLATES.raise_arm({ jointName: 'arm', direction: 'up', slightly: true, anatomicalSide: 'left' });
    expect(t1).toBe('Slightly raise your left arm');

    const t2 = TEMPLATES.lower_arm({ jointName: 'arm', direction: 'down', slightly: false, anatomicalSide: 'right' });
    expect(t2).toBe('Lower your right arm');

    const t3 = TEMPLATES.hands_crossed({ jointName: 'chest', direction: 'in', slightly: false });
    expect(t3).toBe('Fold arms across your chest');
  });
});

describe('EMA Fallback Filter', () => {
  it('smooths values using EMA fallback', () => {
    const filter = new LandmarkFilterManager({ useOneEuro: false, emaAlpha: 0.5 });
    const f1 = [{ x: 0.0, y: 0.0, visibility: 0.9 }];
    const f2 = [{ x: 1.0, y: 1.0, visibility: 0.9 }];

    filter.filterLandmarks(f1, 0);
    const smoothed = filter.filterLandmarks(f2, 33);
    expect(smoothed[0].x).toBeCloseTo(0.5);
    expect(smoothed[0].y).toBeCloseTo(0.5);
  });
});
