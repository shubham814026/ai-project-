import { describe, it, expect } from 'vitest';
import { verifyMarkerAlignment, KNOWN_TEST_MARKERS, calculateTransformBounds, mapNormalizedToScreen } from '../../src/renderer/core/render/coordinates';

describe('Coordinate Transform & Marker Alignment Verification (Section A7, A12)', () => {
  const WINDOW_SIZES = [
    { width: 1920, height: 1080, name: '1080p FHD' },
    { width: 1440, height: 900, name: '1440x900 Laptop' },
    { width: 1280, height: 720, name: '720p HD' },
    { width: 1024, height: 768, name: '1024x768 4:3' },
    { width: 640, height: 480, name: '640x480 Compact' },
  ];

  const VIDEO_ASPECT_RATIOS = [
    { width: 1280, height: 720, ratio: '16:9' },
    { width: 640, height: 480, ratio: '4:3' },
    { width: 800, height: 800, ratio: '1:1 Square' },
  ];

  const DPR_VALUES = [1.0, 1.5, 2.0];
  const MIRROR_STATES = [false, true];

  it('proves alignment error <= 2 px across all 5 window sizes, 3 aspect ratios, 3 DPRs, and 2 mirror states', () => {
    let totalCombinations = 0;
    let maxObservedError = 0;
    const errorLog: { config: string; maxErrorPx: number }[] = [];

    for (const win of WINDOW_SIZES) {
      for (const vid of VIDEO_ASPECT_RATIOS) {
        for (const dpr of DPR_VALUES) {
          for (const mirror of MIRROR_STATES) {
            totalCombinations++;
            const configName = `${win.name} | Vid ${vid.ratio} | DPR ${dpr} | Mirror ${mirror ? 'ON' : 'OFF'}`;

            const check = verifyMarkerAlignment({
              containerWidth: win.width,
              containerHeight: win.height,
              videoWidth: vid.width,
              videoHeight: vid.height,
              objectFit: 'contain',
              mirror,
              dpr,
            });

            maxObservedError = Math.max(maxObservedError, check.maxErrorPx);
            errorLog.push({ config: configName, maxErrorPx: check.maxErrorPx });

            // Section A12 Criterion: 2 px or less error against known marker positions
            expect(check.passed).toBe(true);
            expect(check.maxErrorPx).toBeLessThanOrEqual(2.0);
          }
        }
      }
    }

    console.log(`[TEST] Verified ${totalCombinations} coordinate combinations. Maximum error observed: ${maxObservedError.toFixed(4)} px (Target <= 2 px).`);
  });

  it('maintains strict horizontal mirror symmetry (mirror on vs off sum to container bounds)', () => {
    const win = { width: 1280, height: 720 };
    const boundsNormal = calculateTransformBounds({
      containerWidth: win.width,
      containerHeight: win.height,
      videoWidth: 1280,
      videoHeight: 720,
      mirror: false,
    });
    const boundsMirrored = calculateTransformBounds({
      containerWidth: win.width,
      containerHeight: win.height,
      videoWidth: 1280,
      videoHeight: 720,
      mirror: true,
    });

    for (const m of KNOWN_TEST_MARKERS) {
      const ptNormal = mapNormalizedToScreen(m.normX, m.normY, boundsNormal);
      const ptMirrored = mapNormalizedToScreen(m.normX, m.normY, boundsMirrored);

      // Y coordinates must be identical
      expect(ptNormal.y).toBeCloseTo(ptMirrored.y, 4);

      // In mirrored mode, screen position of x and 1-x are symmetric around center
      expect(ptNormal.x + ptMirrored.x).toBeCloseTo(win.width, 4);
    }
  });

  it('correctly handles objectFit cover mode without distortion', () => {
    const check = verifyMarkerAlignment({
      containerWidth: 800,
      containerHeight: 1200,
      videoWidth: 1280,
      videoHeight: 720,
      objectFit: 'cover',
      mirror: false,
      dpr: 1.5,
    });

    expect(check.passed).toBe(true);
    expect(check.maxErrorPx).toBeLessThanOrEqual(2.0);
  });
});
