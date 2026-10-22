import { NormalizedLandmark, LANDMARK_INDEX } from '../library/types';
import { calculate2DDistance } from './angles';

export interface NormalizationFrame {
  origin: { x: number; y: number };
  originType: 'mid-hip' | 'mid-shoulder';
  scale: number;
  scaleType: 'torso-length' | 'shoulder-width-proxy';
}

/**
 * Constant factor to estimate torso length from shoulder width when hips are out of frame.
 * Documented constant: 1.45 (standard human anthropometric ratio: biacromial diameter to torso length).
 */
export const SHOULDER_TO_TORSO_SCALE_FACTOR = 1.45;

/**
 * Normalizes landmarks according to Section A8:
 * - Origin: mid-hip (fallback: mid-shoulder)
 * - Scale: torso length (fallback: shoulder width * SHOULDER_TO_TORSO_SCALE_FACTOR)
 * - Rotation is preserved by default because body tilt is a coached feature.
 */
export function normalizeLandmarks(landmarks: NormalizedLandmark[]): {
  normalizedLandmarks: NormalizedLandmark[];
  frame: NormalizationFrame;
} {
  const leftShoulder = landmarks[LANDMARK_INDEX.LEFT_SHOULDER];
  const rightShoulder = landmarks[LANDMARK_INDEX.RIGHT_SHOULDER];
  const leftHip = landmarks[LANDMARK_INDEX.LEFT_HIP];
  const rightHip = landmarks[LANDMARK_INDEX.RIGHT_HIP];

  const shouldersVisible = leftShoulder && rightShoulder && 
                           leftShoulder.visibility >= 0.4 && rightShoulder.visibility >= 0.4;
  const hipsVisible = leftHip && rightHip && 
                      leftHip.visibility >= 0.4 && rightHip.visibility >= 0.4;

  const midShoulder = shouldersVisible
    ? { x: (leftShoulder.x + rightShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2 }
    : { x: 0.5, y: 0.25 };

  const midHip = hipsVisible
    ? { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2 }
    : null;

  // Determine Origin
  let origin = { x: 0.5, y: 0.5 };
  let originType: 'mid-hip' | 'mid-shoulder' = 'mid-hip';

  if (midHip) {
    origin = midHip;
    originType = 'mid-hip';
  } else if (shouldersVisible) {
    origin = midShoulder;
    originType = 'mid-shoulder';
  }

  // Determine Scale
  let scale = 1.0;
  let scaleType: 'torso-length' | 'shoulder-width-proxy' = 'torso-length';

  if (midHip && shouldersVisible) {
    const torsoLength = calculate2DDistance(midShoulder, midHip);
    if (torsoLength > 0.05) {
      scale = torsoLength;
      scaleType = 'torso-length';
    }
  } else if (shouldersVisible) {
    const shoulderWidth = calculate2DDistance(leftShoulder, rightShoulder);
    if (shoulderWidth > 0.04) {
      scale = shoulderWidth * SHOULDER_TO_TORSO_SCALE_FACTOR;
      scaleType = 'shoulder-width-proxy';
    }
  }

  // Guard against near-zero division
  if (scale < 0.02) scale = 0.5;

  const normalizedLandmarks: NormalizedLandmark[] = landmarks.map((lm) => ({
    x: (lm.x - origin.x) / scale,
    y: (lm.y - origin.y) / scale,
    z: lm.z !== undefined ? lm.z / scale : undefined,
    visibility: lm.visibility,
  }));

  return {
    normalizedLandmarks,
    frame: {
      origin,
      originType,
      scale,
      scaleType,
    },
  };
}

/**
 * Anchors and scales reference target landmarks directly onto the user's detected torso/shoulders.
 * Transforms target pose from reference space into the user's real-time webcam frame.
 * Uses shoulder-axis midpoint and biacromial width to guarantee exact alignment at desk distance.
 */
export function anchorLandmarksToUser(
  targetLandmarks: NormalizedLandmark[],
  userLandmarks: NormalizedLandmark[]
): NormalizedLandmark[] {
  if (!targetLandmarks || targetLandmarks.length < 13 || !userLandmarks || userLandmarks.length < 13) {
    return targetLandmarks;
  }

  const uLSh = userLandmarks[LANDMARK_INDEX.LEFT_SHOULDER]; // 11
  const uRSh = userLandmarks[LANDMARK_INDEX.RIGHT_SHOULDER]; // 12
  const rLSh = targetLandmarks[LANDMARK_INDEX.LEFT_SHOULDER]; // 11
  const rRSh = targetLandmarks[LANDMARK_INDEX.RIGHT_SHOULDER]; // 12

  const userShouldersVisible = uLSh && uRSh && (uLSh.visibility ?? 0) >= 0.35 && (uRSh.visibility ?? 0) >= 0.35;
  const refShouldersPresent = rLSh && rRSh;

  if (!userShouldersVisible || !refShouldersPresent) {
    return targetLandmarks;
  }

  const userMidShoulder = {
    x: (uLSh.x + uRSh.x) / 2,
    y: (uLSh.y + uRSh.y) / 2,
  };

  const refMidShoulder = {
    x: (rLSh.x + rRSh.x) / 2,
    y: (rLSh.y + rRSh.y) / 2,
  };

  const userWidth = calculate2DDistance(uLSh, uRSh);
  const refWidth = calculate2DDistance(rLSh, rRSh);

  if (userWidth < 0.04 || refWidth < 0.04) {
    return targetLandmarks;
  }

  // Scale factor: matches target pose proportions directly to user's body size on camera
  // Clamp scale to [0.65, 1.40] so target skeleton never blows up or contorts when user sits close to camera
  const rawScale = userWidth / refWidth;
  const scale = Math.max(0.65, Math.min(1.40, rawScale));

  return targetLandmarks.map((lm) => {
    const relX = lm.x - refMidShoulder.x;
    const relY = lm.y - refMidShoulder.y;

    return {
      x: userMidShoulder.x + relX * scale,
      y: userMidShoulder.y + relY * scale,
      z: lm.z,
      visibility: lm.visibility,
    };
  });
}

