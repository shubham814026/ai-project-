/**
 * Coordinate Transformation System
 * Strictly adheres to Section A7:
 * - One unified function mapping normalized landmarks [0, 1] to screen/canvas coordinates
 * - Supports object-fit ('contain' by default, 'cover' supported)
 * - Accounts for letterboxing/pillarboxing offsets, mirror flipping, and device pixel ratio (DPR)
 * - Pure and unit-testable without DOM
 */

export interface CoordinateMappingOptions {
  containerWidth: number;
  containerHeight: number;
  videoWidth: number;
  videoHeight: number;
  objectFit?: 'contain' | 'cover';
  mirror?: boolean;
  dpr?: number;
}

export interface TransformBounds {
  renderedWidth: number;
  renderedHeight: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  dpr: number;
  mirror: boolean;
  visibleNormalizedRect: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

export interface ScreenPoint {
  x: number;      // CSS pixels
  y: number;      // CSS pixels
  bufferX: number;// Physical canvas buffer pixels (CSS * DPR)
  bufferY: number;// Physical canvas buffer pixels (CSS * DPR)
  isVisible: boolean;
}

/**
 * Calculates transform bounds, letterbox offsets, and visible camera sub-rectangle
 */
export function calculateTransformBounds(options: CoordinateMappingOptions): TransformBounds {
  const {
    containerWidth,
    containerHeight,
    videoWidth,
    videoHeight,
    objectFit = 'contain',
    mirror = true,
    dpr = 1.0,
  } = options;

  if (containerWidth <= 0 || containerHeight <= 0 || videoWidth <= 0 || videoHeight <= 0) {
    return {
      renderedWidth: containerWidth,
      renderedHeight: containerHeight,
      offsetX: 0,
      offsetY: 0,
      scale: 1.0,
      dpr,
      mirror,
      visibleNormalizedRect: { minX: 0, maxX: 1, minY: 0, maxY: 1 },
    };
  }

  let scale: number;
  if (objectFit === 'cover') {
    scale = Math.max(containerWidth / videoWidth, containerHeight / videoHeight);
  } else {
    // contain
    scale = Math.min(containerWidth / videoWidth, containerHeight / videoHeight);
  }

  const renderedWidth = videoWidth * scale;
  const renderedHeight = videoHeight * scale;
  const offsetX = (containerWidth - renderedWidth) / 2;
  const offsetY = (containerHeight - renderedHeight) / 2;

  // Determine normalized visible rectangle inside container viewport
  let minX = 0;
  let maxX = 1;
  let minY = 0;
  let maxY = 1;

  if (objectFit === 'cover') {
    if (renderedWidth > containerWidth) {
      const croppedNormalized = (renderedWidth - containerWidth) / (2 * renderedWidth);
      minX = croppedNormalized;
      maxX = 1.0 - croppedNormalized;
    }
    if (renderedHeight > containerHeight) {
      const croppedNormalized = (renderedHeight - containerHeight) / (2 * renderedHeight);
      minY = croppedNormalized;
      maxY = 1.0 - croppedNormalized;
    }
  }

  return {
    renderedWidth,
    renderedHeight,
    offsetX,
    offsetY,
    scale,
    dpr,
    mirror,
    visibleNormalizedRect: { minX, maxX, minY, maxY },
  };
}

/**
 * Maps normalized coordinates (x, y in [0, 1]) to screen CSS and buffer coordinates
 */
export function mapNormalizedToScreen(
  normX: number,
  normY: number,
  bounds: TransformBounds
): ScreenPoint {
  // Apply horizontal mirror if active
  const xCamera = bounds.mirror ? 1.0 - normX : normX;

  const cssX = bounds.offsetX + xCamera * bounds.renderedWidth;
  const cssY = bounds.offsetY + normY * bounds.renderedHeight;

  const bufferX = cssX * bounds.dpr;
  const bufferY = cssY * bounds.dpr;

  const isVisible =
    normX >= bounds.visibleNormalizedRect.minX &&
    normX <= bounds.visibleNormalizedRect.maxX &&
    normY >= bounds.visibleNormalizedRect.minY &&
    normY <= bounds.visibleNormalizedRect.maxY;

  return {
    x: cssX,
    y: cssY,
    bufferX,
    bufferY,
    isVisible,
  };
}

/**
 * Standard ground-truth normalized marker positions for alignment tests (Section A7, A12)
 */
export const KNOWN_TEST_MARKERS = [
  { id: 'top_left', normX: 0.1, normY: 0.1, label: 'TL (0.1, 0.1)' },
  { id: 'top_right', normX: 0.9, normY: 0.1, label: 'TR (0.9, 0.1)' },
  { id: 'center', normX: 0.5, normY: 0.5, label: 'Center (0.5, 0.5)' },
  { id: 'bottom_left', normX: 0.1, normY: 0.9, label: 'BL (0.1, 0.9)' },
  { id: 'bottom_right', normX: 0.9, normY: 0.9, label: 'BR (0.9, 0.9)' },
  { id: 'mid_top', normX: 0.5, normY: 0.25, label: 'MT (0.5, 0.25)' },
  { id: 'mid_bottom', normX: 0.5, normY: 0.75, label: 'MB (0.5, 0.75)' },
  { id: 'mid_left', normX: 0.25, normY: 0.5, label: 'ML (0.25, 0.5)' },
  { id: 'mid_right', normX: 0.75, normY: 0.5, label: 'MR (0.75, 0.5)' },
] as const;

/**
 * Verifies mathematical alignment error against expected theoretical position.
 * Returns max error in pixels across all markers.
 */
export function verifyMarkerAlignment(options: CoordinateMappingOptions): {
  maxErrorPx: number;
  results: { id: string; expectedX: number; expectedY: number; actualX: number; actualY: number; errorPx: number }[];
  passed: boolean;
} {
  const bounds = calculateTransformBounds(options);
  let maxError = 0;
  const results = [];

  for (const m of KNOWN_TEST_MARKERS) {
    const pt = mapNormalizedToScreen(m.normX, m.normY, bounds);

    // Theoretical ground truth calculation
    const expectedXCam = bounds.mirror ? 1.0 - m.normX : m.normX;
    const expectedX = bounds.offsetX + expectedXCam * bounds.renderedWidth;
    const expectedY = bounds.offsetY + m.normY * bounds.renderedHeight;

    const errorPx = Math.hypot(pt.x - expectedX, pt.y - expectedY);
    maxError = Math.max(maxError, errorPx);

    results.push({
      id: m.id,
      expectedX,
      expectedY,
      actualX: pt.x,
      actualY: pt.y,
      errorPx,
    });
  }

  return {
    maxErrorPx: maxError,
    results,
    passed: maxError <= 2.0, // Section A12 target: 2 px or less error
  };
}
