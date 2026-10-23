import { NormalizedLandmark, LANDMARK_INDEX } from './types';
import { calculate2DAngle } from '../geometry/angles';

export const JOINTS_ORDER = [
  'elbowLeft',
  'elbowRight',
  'shoulderLeft',
  'shoulderRight',
  'hipLeft',
  'hipRight',
  'kneeLeft',
  'kneeRight',
] as const;

export type JointName = (typeof JOINTS_ORDER)[number];

export interface LivePoseFeatures {
  features74: Float32Array; // 74 normalized features (8 angles + 66 coords)
  angles: Record<JointName, number>; // Raw degrees [0, 180]
  anglesArray: Float32Array; // 8 angles in degrees
  framing: 'upper-body' | 'full-body' | 'partial';
  isKeypointsValid: boolean;
}

export class PoseFeatureExtractor {
  private featuresBuffer = new Float32Array(74);
  private anglesBuffer = new Float32Array(8);

  public extract(landmarks: NormalizedLandmark[] | null | undefined): LivePoseFeatures {
    if (!landmarks || landmarks.length < 33) {
      this.featuresBuffer.fill(0);
      this.anglesBuffer.fill(90);
      return {
        features74: this.featuresBuffer,
        angles: {
          elbowLeft: 90,
          elbowRight: 90,
          shoulderLeft: 90,
          shoulderRight: 90,
          hipLeft: 90,
          hipRight: 90,
          kneeLeft: 90,
          kneeRight: 90,
        },
        anglesArray: this.anglesBuffer,
        framing: 'partial',
        isKeypointsValid: false,
      };
    }

    const s11 = landmarks[LANDMARK_INDEX.LEFT_SHOULDER];
    const s12 = landmarks[LANDMARK_INDEX.RIGHT_SHOULDER];
    const e13 = landmarks[LANDMARK_INDEX.LEFT_ELBOW];
    const e14 = landmarks[LANDMARK_INDEX.RIGHT_ELBOW];
    const w15 = landmarks[LANDMARK_INDEX.LEFT_WRIST];
    const w16 = landmarks[LANDMARK_INDEX.RIGHT_WRIST];
    const h23 = landmarks[LANDMARK_INDEX.LEFT_HIP];
    const h24 = landmarks[LANDMARK_INDEX.RIGHT_HIP];
    const k25 = landmarks[LANDMARK_INDEX.LEFT_KNEE];
    const k26 = landmarks[LANDMARK_INDEX.RIGHT_KNEE];
    const a27 = landmarks[LANDMARK_INDEX.LEFT_ANKLE];
    const a28 = landmarks[LANDMARK_INDEX.RIGHT_ANKLE];

    // Compute 8 Biomechanical Joint Angles
    const elbowL = s11 && e13 && w15 ? calculate2DAngle(s11, e13, w15) : 90;
    const elbowR = s12 && e14 && w16 ? calculate2DAngle(s12, e14, w16) : 90;
    const shoulderL = e13 && s11 && h23 ? calculate2DAngle(e13, s11, h23) : 90;
    const shoulderR = e14 && s12 && h24 ? calculate2DAngle(e14, s12, h24) : 90;
    const hipL = s11 && h23 && k25 ? calculate2DAngle(s11, h23, k25) : 90;
    const hipR = s12 && h24 && k26 ? calculate2DAngle(s12, h24, k26) : 90;
    const kneeL = h23 && k25 && a27 ? calculate2DAngle(h23, k25, a27) : 90;
    const kneeR = h24 && k26 && a28 ? calculate2DAngle(h24, k26, a28) : 90;

    this.anglesBuffer[0] = elbowL;
    this.anglesBuffer[1] = elbowR;
    this.anglesBuffer[2] = shoulderL;
    this.anglesBuffer[3] = shoulderR;
    this.anglesBuffer[4] = hipL;
    this.anglesBuffer[5] = hipR;
    this.anglesBuffer[6] = kneeL;
    this.anglesBuffer[7] = kneeR;

    // Normalization origin & scale: mid-shoulder & shoulder width
    const mx = s11 && s12 ? (s11.x + s12.x) / 2 : 0.5;
    const my = s11 && s12 ? (s11.y + s12.y) / 2 : 0.25;
    const sw =
      s11 && s12 ? Math.max(0.01, Math.hypot(s11.x - s12.x, s11.y - s12.y)) : 0.2;

    // Fill first 8 elements with normalized angles [0, 1]
    for (let j = 0; j < 8; j++) {
      this.featuresBuffer[j] = this.anglesBuffer[j] / 180.0;
    }

    // Fill next 66 elements with shoulder-normalized (x, y) coordinates
    let fIdx = 8;
    for (let i = 0; i < 33; i++) {
      const lm = landmarks[i];
      if (lm) {
        this.featuresBuffer[fIdx++] = (lm.x - mx) / sw;
        this.featuresBuffer[fIdx++] = (lm.y - my) / sw;
      } else {
        this.featuresBuffer[fIdx++] = 0;
        this.featuresBuffer[fIdx++] = 0;
      }
    }

    // Determine framing from visibility
    const anklesVis = (a27?.visibility ?? 0) > 0.4 || (a28?.visibility ?? 0) > 0.4;
    const kneesVis = (k25?.visibility ?? 0) > 0.4 || (k26?.visibility ?? 0) > 0.4;
    const hipsVis = (h23?.visibility ?? 0) > 0.4 || (h24?.visibility ?? 0) > 0.4;
    const shouldersVis = (s11?.visibility ?? 0) > 0.4 || (s12?.visibility ?? 0) > 0.4;

    let framing: 'upper-body' | 'full-body' | 'partial' = 'partial';
    if (anklesVis && kneesVis && hipsVis) {
      framing = 'full-body';
    } else if (hipsVis && shouldersVis) {
      framing = 'upper-body';
    } else if (shouldersVis) {
      framing = 'upper-body';
    }

    return {
      features74: this.featuresBuffer,
      angles: {
        elbowLeft: elbowL,
        elbowRight: elbowR,
        shoulderLeft: shoulderL,
        shoulderRight: shoulderR,
        hipLeft: hipL,
        hipRight: hipR,
        kneeLeft: kneeL,
        kneeRight: kneeR,
      },
      anglesArray: this.anglesBuffer,
      framing,
      isKeypointsValid: shouldersVis,
    };
  }
}
