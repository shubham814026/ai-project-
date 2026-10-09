/**
 * Reference Pose and Pose Feature Schema
 * Defined strictly according to specification Section A8
 */

export interface PoseFeature {
  id: string;
  kind: 'angle' | 'position' | 'tilt' | 'distance';
  landmarks: number[]; // MediaPipe landmark indices involved
  target: number;      // Target value (degrees for angle/tilt, torso-normalized units for position/distance)
  tolerance: number;   // Acceptable delta threshold
  weight: number;      // 2 for critical, 1 for normal, 0.5 for optional
  critical?: boolean;
}

export interface NormalizedLandmark {
  x: number;
  y: number;
  z?: number;
  visibility: number;
}

export interface ReferencePose {
  id: string;
  name: string;
  category: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  framing: 'upper-body' | 'full-body' | 'either';
  description: string;
  instructions: string[];
  requiredLandmarks: number[]; // MediaPipe landmark indices (0-32)
  features: PoseFeature[];
  landmarks?: NormalizedLandmark[]; // 33 normalized target landmarks for drawing target guide
  mirrorAllowed: boolean;
  source: 'authored' | 'dataset';
  sourceImage?: string;
  thumbnail: string; // Generated SVG string or data URI
  reviewed: boolean; // true only after user approval
  experimental?: boolean;
}

/**
 * MediaPipe Pose Landmark Indices Reference:
 * 0: nose
 * 11: left_shoulder, 12: right_shoulder
 * 13: left_elbow,    14: right_elbow
 * 15: left_wrist,    16: right_wrist
 * 23: left_hip,      24: right_hip
 * 25: left_knee,     26: right_knee
 * 27: left_ankle,    28: right_ankle
 */
export const LANDMARK_INDEX = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

export const STANDARD_CONNECTIONS: [number, number][] = [
  // Face
  [LANDMARK_INDEX.NOSE, LANDMARK_INDEX.LEFT_EYE],
  [LANDMARK_INDEX.NOSE, LANDMARK_INDEX.RIGHT_EYE],
  [LANDMARK_INDEX.LEFT_EYE, LANDMARK_INDEX.LEFT_EAR],
  [LANDMARK_INDEX.RIGHT_EYE, LANDMARK_INDEX.RIGHT_EAR],
  // Upper body
  [LANDMARK_INDEX.LEFT_SHOULDER, LANDMARK_INDEX.RIGHT_SHOULDER],
  [LANDMARK_INDEX.LEFT_SHOULDER, LANDMARK_INDEX.LEFT_ELBOW],
  [LANDMARK_INDEX.LEFT_ELBOW, LANDMARK_INDEX.LEFT_WRIST],
  [LANDMARK_INDEX.RIGHT_SHOULDER, LANDMARK_INDEX.RIGHT_ELBOW],
  [LANDMARK_INDEX.RIGHT_ELBOW, LANDMARK_INDEX.RIGHT_WRIST],
  [LANDMARK_INDEX.LEFT_SHOULDER, LANDMARK_INDEX.LEFT_HIP],
  [LANDMARK_INDEX.RIGHT_SHOULDER, LANDMARK_INDEX.RIGHT_HIP],
  [LANDMARK_INDEX.LEFT_HIP, LANDMARK_INDEX.RIGHT_HIP],
  // Lower body
  [LANDMARK_INDEX.LEFT_HIP, LANDMARK_INDEX.LEFT_KNEE],
  [LANDMARK_INDEX.LEFT_KNEE, LANDMARK_INDEX.LEFT_ANKLE],
  [LANDMARK_INDEX.RIGHT_HIP, LANDMARK_INDEX.RIGHT_KNEE],
  [LANDMARK_INDEX.RIGHT_KNEE, LANDMARK_INDEX.RIGHT_ANKLE],
];
