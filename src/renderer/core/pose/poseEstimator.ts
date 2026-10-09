/**
 * Pose Estimator Engine
 * Integrates self-hosted MediaPipe PoseLandmarker with WASM
 * Supports primary person selection (largest/most central with sticky hysteresis)
 * Strictly adheres to Sections A2, A6, A7
 */

import {
  PoseLandmarker,
  FilesetResolver,
  PoseLandmarkerResult,
} from '@mediapipe/tasks-vision';
import { NormalizedLandmark } from '../library/types';
import { INFERENCE_CONFIG } from '../settings/constants';

export interface PoseEstimatorOptions {
  modelVariant?: 'lite' | 'full' | 'heavy';
  numPoses?: number;
  minPoseDetectionConfidence?: number;
  minPosePresenceConfidence?: number;
  minTrackingConfidence?: number;
}

export interface DetectedPerson {
  landmarks: NormalizedLandmark[];
  worldLandmarks?: NormalizedLandmark[];
  boundingBox: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    area: number;
    centerX: number;
    centerY: number;
  };
  score: number;
}

export class PoseEstimator {
  private landmarker: PoseLandmarker | null = null;
  private isInitializing: boolean = false;
  private currentModelVariant: 'lite' | 'full' | 'heavy' = 'lite';
  private primaryPersonIndex: number = 0;
  private lastTimestampMs: number = -1;

  public async initialize(options: PoseEstimatorOptions = {}): Promise<void> {
    if (this.landmarker || this.isInitializing) return;
    this.isInitializing = true;

    try {
      this.currentModelVariant = options.modelVariant ?? 'lite';
      const modelFile =
        this.currentModelVariant === 'lite'
          ? INFERENCE_CONFIG.FALLBACK_MODEL
          : this.currentModelVariant === 'heavy'
          ? 'pose_landmarker_heavy.task'
          : INFERENCE_CONFIG.PRIMARY_MODEL;

      // Self-hosted WASM resolver
      const vision = await FilesetResolver.forVisionTasks(INFERENCE_CONFIG.WASM_PATH);

      this.landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `/models/${modelFile}`,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: options.numPoses ?? 2,
        minPoseDetectionConfidence: options.minPoseDetectionConfidence ?? 0.35,
        minPosePresenceConfidence: options.minPosePresenceConfidence ?? 0.35,
        minTrackingConfidence: options.minTrackingConfidence ?? 0.35,
      });

      console.log(`[PoseEstimator] Initialized MediaPipe PoseLandmarker (${this.currentModelVariant})`);
    } catch (e) {
      console.warn('[PoseEstimator] GPU delegate failed, falling back to CPU:', e);
      // Fallback to CPU delegate
      const vision = await FilesetResolver.forVisionTasks(INFERENCE_CONFIG.WASM_PATH);
      const modelFile = this.currentModelVariant === 'lite' ? INFERENCE_CONFIG.FALLBACK_MODEL : INFERENCE_CONFIG.PRIMARY_MODEL;
      this.landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `/models/${modelFile}`,
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        numPoses: options.numPoses ?? 2,
        minPoseDetectionConfidence: options.minPoseDetectionConfidence ?? 0.35,
        minPosePresenceConfidence: options.minPosePresenceConfidence ?? 0.35,
        minTrackingConfidence: options.minTrackingConfidence ?? 0.35,
      });
    } finally {
      this.isInitializing = false;
    }
  }

  public isReady(): boolean {
    return this.landmarker !== null;
  }

  public detectForVideo(videoElement: HTMLVideoElement, timestampMs: number): {
    primaryPerson: DetectedPerson | null;
    allPersons: DetectedPerson[];
    inferenceTimeMs: number;
    multiplePersonsDetected: boolean;
  } {
    if (!this.landmarker) {
      return { primaryPerson: null, allPersons: [], inferenceTimeMs: 0, multiplePersonsDetected: false };
    }

    // MediaPipe requires strictly monotonically increasing integer timestamps
    let validTimestamp = Math.round(timestampMs);
    if (validTimestamp <= this.lastTimestampMs) {
      validTimestamp = this.lastTimestampMs + 1;
    }
    this.lastTimestampMs = validTimestamp;

    const t0 = performance.now();
    let result: PoseLandmarkerResult;
    try {
      result = this.landmarker.detectForVideo(videoElement, validTimestamp);
    } catch (e) {
      console.warn('[PoseEstimator] detectForVideo exception:', e);
      return { primaryPerson: null, allPersons: [], inferenceTimeMs: 0, multiplePersonsDetected: false };
    }
    const inferenceTimeMs = performance.now() - t0;

    if (!result.landmarks || result.landmarks.length === 0) {
      return { primaryPerson: null, allPersons: [], inferenceTimeMs, multiplePersonsDetected: false };
    }

    // Process all detected persons
    const detected: DetectedPerson[] = result.landmarks.map((lms, idx) => {
      const worldLms = result.worldLandmarks?.[idx];
      let minX = 1, minY = 1, maxX = 0, maxY = 0;
      let visibleCount = 0;

      const mappedLandmarks: NormalizedLandmark[] = lms.map((p) => {
        const vis = p.visibility ?? 1.0;
        if (vis >= 0.4) {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
          visibleCount++;
        }
        return {
          x: p.x,
          y: p.y,
          z: p.z,
          visibility: vis,
        };
      });

      const width = Math.max(0, maxX - minX);
      const height = Math.max(0, maxY - minY);
      const area = width * height;
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      // Bounding box area and landmark visibility (equal tracking anywhere across camera frame)
      const avgVis = visibleCount > 0 ? lms.reduce((acc, p) => acc + (p.visibility ?? 0.5), 0) / lms.length : 0;
      const trackingScore = (area * 0.75) + (avgVis * 0.25);

      return {
        landmarks: mappedLandmarks,
        worldLandmarks: worldLms?.map((w) => ({ x: w.x, y: w.y, z: w.z, visibility: w.visibility ?? 1.0 })),
        boundingBox: { minX, minY, maxX, maxY, area, centerX, centerY },
        score: trackingScore,
      };
    });

    // Primary person selection with sticky hysteresis (Section A6)
    if (this.primaryPersonIndex >= detected.length) {
      this.primaryPersonIndex = 0;
    }

    if (detected.length === 1) {
      this.primaryPersonIndex = 0;
    } else if (detected.length > 1) {
      let bestIdx = 0;
      let bestScore = -1;
      detected.forEach((p, idx) => {
        if (p.score > bestScore) {
          bestScore = p.score;
          bestIdx = idx;
        }
      });

      const currentScore = detected[this.primaryPersonIndex]?.score ?? 0;
      if (bestScore > currentScore * 1.25 || currentScore === 0) {
        this.primaryPersonIndex = bestIdx;
      }
    }

    const primaryPerson = detected[this.primaryPersonIndex] ?? detected[0] ?? null;

    return {
      primaryPerson,
      allPersons: detected,
      inferenceTimeMs,
      multiplePersonsDetected: detected.length > 1,
    };
  }

  public setPrimaryPersonIndex(index: number): void {
    this.primaryPersonIndex = index;
  }

  public getModelVariant(): 'lite' | 'full' | 'heavy' {
    return this.currentModelVariant;
  }

  public close(): void {
    if (this.landmarker) {
      this.landmarker.close();
      this.landmarker = null;
    }
  }
}
