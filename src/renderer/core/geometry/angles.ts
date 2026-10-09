/**
 * Geometric angle and vector calculation engine
 * Adheres strictly to Section A8:
 * - Angles computed via dot product with clipping to [-1, 1]
 * - World landmarks used for 3D depth-sensitive angles
 * - Image-plane coordinates used for 2D position, tilt, and alignment
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface Point3D {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

/**
 * Calculates the interior angle (in degrees) formed by points A - B - C, with B as the vertex.
 * Returns angle in degrees [0, 180].
 */
export function calculate2DAngle(a: Point2D, b: Point2D, c: Point2D): number {
  const abX = a.x - b.x;
  const abY = a.y - b.y;
  const cbX = c.x - b.x;
  const cbY = c.y - b.y;

  const dot = abX * cbX + abY * cbY;
  const magAB = Math.hypot(abX, abY);
  const magCB = Math.hypot(cbX, cbY);

  if (magAB === 0 || magCB === 0) return 0;

  const cosine = Math.max(-1.0, Math.min(1.0, dot / (magAB * magCB)));
  return (Math.acos(cosine) * 180.0) / Math.PI;
}

/**
 * Calculates the 3D angle (in degrees) formed by points A - B - C using world landmarks.
 * Returns angle in degrees [0, 180].
 */
export function calculate3DAngle(a: Point3D, b: Point3D, c: Point3D): number {
  const ab = {
    x: a.x - b.x,
    y: a.y - b.y,
    z: (a.z ?? 0) - (b.z ?? 0),
  };
  const cb = {
    x: c.x - b.x,
    y: c.y - b.y,
    z: (c.z ?? 0) - (b.z ?? 0),
  };

  const dot = ab.x * cb.x + ab.y * cb.y + ab.z * cb.z;
  const magAB = Math.sqrt(ab.x * ab.x + ab.y * ab.y + ab.z * ab.z);
  const magCB = Math.sqrt(cb.x * cb.x + cb.y * cb.y + cb.z * cb.z);

  if (magAB === 0 || magCB === 0) return 0;

  const cosine = Math.max(-1.0, Math.min(1.0, dot / (magAB * magCB)));
  return (Math.acos(cosine) * 180.0) / Math.PI;
}

/**
 * Calculates tilt (in degrees) of a segment (p1 -> p2) relative to the horizontal axis.
 * E.g., for shoulders or hips line: 0 degrees = perfectly level.
 */
export function calculateHorizontalTilt(p1: Point2D, p2: Point2D): number {
  const dy = p2.y - p1.y;
  const dx = p2.x - p1.x;
  const angleRad = Math.atan2(dy, dx);
  let angleDeg = (angleRad * 180.0) / Math.PI;
  // Normalize around 0
  if (angleDeg > 90) angleDeg -= 180;
  if (angleDeg < -90) angleDeg += 180;
  return Math.abs(angleDeg);
}

/**
 * Calculates tilt (in degrees) of a segment relative to vertical axis.
 * E.g., torso vertical alignment: 0 degrees = vertical spine.
 */
export function calculateVerticalTilt(top: Point2D, bottom: Point2D): number {
  const dx = top.x - bottom.x;
  const dy = bottom.y - top.y; // In screen space, y increases downwards
  const angleRad = Math.atan2(dx, dy);
  return (Math.abs(angleRad) * 180.0) / Math.PI;
}

/**
 * Euclidean distance in 2D normalized space
 */
export function calculate2DDistance(p1: Point2D, p2: Point2D): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}
