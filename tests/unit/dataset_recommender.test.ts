import { describe, it, expect } from 'vitest';
import { PoseFeatureExtractor } from '../../src/renderer/core/library/poseFeatureExtractor';
import { PosePredictorModel } from '../../src/renderer/core/library/posePredictorModel';
import { EmbeddingIndex } from '../../src/renderer/core/library/embeddingIndex';
import { DatasetLoader } from '../../src/renderer/core/library/datasetLoader';
import { DatasetRecommender } from '../../src/renderer/core/library/datasetRecommender';
import { NormalizedLandmark } from '../../src/renderer/core/library/types';
import { DatasetPoseEntry, RecommenderModelWeights } from '../../src/renderer/core/library/datasetTypes';

describe('PoseFeatureExtractor', () => {
  const extractor = new PoseFeatureExtractor();

  it('handles null or empty landmarks gracefully', () => {
    const res = extractor.extract(null);
    expect(res.features74.length).toBe(74);
    expect(res.anglesArray.length).toBe(8);
    expect(res.isKeypointsValid).toBe(false);
    expect(res.framing).toBe('partial');
  });

  it('extracts normalized 74-dim vector from standard 33 landmarks', () => {
    // Synthetic standard pose
    const landmarks: NormalizedLandmark[] = Array.from({ length: 33 }, (_, i) => ({
      x: 0.5 + (i % 2 === 0 ? 0.05 : -0.05),
      y: 0.1 + (i * 0.025),
      visibility: 0.95,
    }));

    // Shoulders
    landmarks[11] = { x: 0.40, y: 0.25, visibility: 0.99 };
    landmarks[12] = { x: 0.60, y: 0.25, visibility: 0.99 };
    // Hips
    landmarks[23] = { x: 0.42, y: 0.55, visibility: 0.95 };
    landmarks[24] = { x: 0.58, y: 0.55, visibility: 0.95 };
    // Ankles
    landmarks[27] = { x: 0.41, y: 0.90, visibility: 0.90 };
    landmarks[28] = { x: 0.59, y: 0.90, visibility: 0.90 };

    const res = extractor.extract(landmarks);
    expect(res.isKeypointsValid).toBe(true);
    expect(res.framing).toBe('full-body');
    expect(res.features74.length).toBe(74);
    // Normalized angles in [0, 1]
    for (let j = 0; j < 8; j++) {
      expect(res.features74[j]).toBeGreaterThanOrEqual(0);
      expect(res.features74[j]).toBeLessThanOrEqual(1.0);
    }
  });
});

describe('PosePredictorModel', () => {
  it('computes forward pass and outputs unit normalized 64-dim embedding', () => {
    const model = new PosePredictorModel();

    // Create synthetic weights (74 -> 128 -> 96 -> 64)
    const fakeWeights: RecommenderModelWeights = {
      architecture: {
        inputDim: 74,
        hiddenDims: [128, 96],
        outputDim: 64,
        activation: 'relu',
      },
      layers: [
        {
          weights: Array.from({ length: 74 }, () => Array(128).fill(0.01)),
          biases: Array(128).fill(0.1),
        },
        {
          weights: Array.from({ length: 128 }, () => Array(96).fill(0.01)),
          biases: Array(96).fill(0.1),
        },
        {
          weights: Array.from({ length: 96 }, () => Array(64).fill(0.01)),
          biases: Array(64).fill(0.1),
        },
      ],
    };

    model.initFromWeights(fakeWeights);
    expect(model.isModelReady()).toBe(true);

    const testInput = new Float32Array(74).fill(0.5);
    const embedding = model.predictEmbedding(testInput);

    expect(embedding.length).toBe(64);
    // Verify L2 norm = 1.0
    let normSq = 0;
    for (let i = 0; i < 64; i++) normSq += embedding[i] * embedding[i];
    expect(Math.abs(Math.sqrt(normSq) - 1.0)).toBeLessThan(1e-4);
  });
});

describe('EmbeddingIndex', () => {
  it('performs nearest-neighbor search and biomechanical joint angle scoring', () => {
    const index = new EmbeddingIndex();

    // Create index for 5 poses
    const count = 5;
    const embs = new Float32Array(count * 64);
    const feats = new Float32Array(count * 74);
    const angles = new Float32Array(count * 8);

    // Pose 2 matches target vector
    for (let j = 0; j < 64; j++) embs[2 * 64 + j] = 1.0 / 8.0; // norm = 1
    // Angles for pose 2: [120, 110, 80, 80, 120, 120, 140, 140]
    const pose2Angles = [120, 110, 80, 80, 120, 120, 140, 140];
    for (let j = 0; j < 8; j++) angles[2 * 8 + j] = pose2Angles[j];

    index.initFromBuffers(embs, feats, angles, count);
    expect(index.getPoseCount()).toBe(5);

    // Query embedding identical to pose 2
    const queryEmb = new Float32Array(64).fill(1.0 / 8.0);
    const matches = index.searchByEmbedding(queryEmb, 3);

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].index).toBe(2);
    expect(matches[0].score).toBeCloseTo(1.0, 3);

    // Biomechanical score against pose 2
    const queryAngles = new Float32Array([120, 110, 80, 80, 120, 120, 140, 140]);
    const score = index.scoreJointAngles(queryAngles, 2);
    expect(score).toBeGreaterThan(99.0);
  });
});

describe('DatasetLoader', () => {
  it('indexes entries and converts to active ReferencePose', () => {
    const loader = new DatasetLoader();
    const mockEntries: DatasetPoseEntry[] = [
      {
        id: 'pose_test_001',
        name: 'Test Graduation Stance',
        category: 'Graduation Poses',
        difficulty: 'beginner',
        framing: 'upper-body',
        image: 'pose_test_001.jpg',
        hasLocalImage: true,
        angles: {
          elbowLeft: 125,
          elbowRight: 110,
          shoulderLeft: 75,
          shoulderRight: 85,
        },
        keypoints: Array.from({ length: 33 }, () => [0.5, 0.5, 0.95]),
        thumbnail: '<svg></svg>',
      },
    ];

    loader.init(mockEntries);
    expect(loader.getTotalCount()).toBe(1);
    expect(loader.getCategories()).toContain('Graduation Poses');

    const refPose = loader.toReferencePose(mockEntries[0]);
    expect(refPose.id).toBe('pose_test_001');
    expect(refPose.category).toBe('Graduation Poses');
    expect(refPose.sourceImage).toBe('/assets/images/pose_test_001.jpg');
    expect(refPose.features.length).toBeGreaterThan(0);
    expect(refPose.landmarks?.length).toBe(33);
  });
});

describe('DatasetRecommender Integration', () => {
  it('predicts best poses from live frame landmarks', () => {
    const recommender = new DatasetRecommender();

    const mockEntries: DatasetPoseEntry[] = [
      {
        id: 'pose_rec_01',
        name: 'Streetwear Attitude Pose',
        category: 'Standing & Streetwear',
        difficulty: 'beginner',
        framing: 'upper-body',
        angles: { elbowLeft: 120, elbowRight: 110 },
      },
      {
        id: 'pose_rec_02',
        name: 'Aesthetic Coffee Shop Stance',
        category: 'Aesthetic Selfies',
        difficulty: 'beginner',
        framing: 'upper-body',
        angles: { elbowLeft: 90, elbowRight: 90 },
      },
    ];

    recommender.getLoader().init(mockEntries);

    const liveLandmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      visibility: 0.95,
    }));
    liveLandmarks[11] = { x: 0.4, y: 0.3, visibility: 0.95 };
    liveLandmarks[12] = { x: 0.6, y: 0.3, visibility: 0.95 };

    const predictions = recommender.predictBestPoses(liveLandmarks, 'upper-body', 'all', 2);
    expect(predictions.length).toBe(2);
    expect(predictions[0].score).toBeGreaterThan(0);
    expect(predictions[0].matchPercentage).toBeGreaterThan(0);
    expect(predictions[0].referencePose.id).toBeDefined();

    const adapted = recommender.toPoseRecommendations(predictions);
    expect(adapted.length).toBe(2);
    expect(adapted[0].pose).toBeDefined();
  });

  it('strictly filters recommendations by person count: 1 person gets solo poses, 2 gets duo, 3 gets trio', () => {
    const recommender = new DatasetRecommender();

    const multiPersonEntries: DatasetPoseEntry[] = [
      {
        id: 'pose_solo_01',
        name: 'Solo Creator Stance',
        category: 'Solo Male Aesthetic',
        difficulty: 'beginner',
        framing: 'upper-body',
        personCount: 'solo',
        angles: { elbowLeft: 120, elbowRight: 110 },
      },
      {
        id: 'pose_duo_01',
        name: 'Romantic Couple Sunset',
        category: 'Romantic Couples',
        difficulty: 'beginner',
        framing: 'upper-body',
        personCount: 'duo',
        angles: { elbowLeft: 120, elbowRight: 110 },
      },
      {
        id: 'pose_trio_01',
        name: 'Three Best Friends Studio',
        category: 'Trio (3 People) Poses',
        difficulty: 'beginner',
        framing: 'upper-body',
        personCount: 'trio',
        angles: { elbowLeft: 120, elbowRight: 110 },
      },
    ];

    recommender.getLoader().init(multiPersonEntries);

    const liveLandmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      visibility: 0.95,
    }));
    liveLandmarks[11] = { x: 0.4, y: 0.3, visibility: 0.95 };
    liveLandmarks[12] = { x: 0.6, y: 0.3, visibility: 0.95 };

    // Test 1: Exactly 1 person -> Only solo poses
    const soloRecs = recommender.predictBestPoses(liveLandmarks, 'upper-body', 'all', 4, 1);
    expect(soloRecs.length).toBe(1);
    expect(soloRecs[0].id).toBe('pose_solo_01');
    expect(soloRecs[0].personCount).toBe('solo');

    // Test 2: Exactly 2 people -> Only duo poses
    const duoRecs = recommender.predictBestPoses(liveLandmarks, 'upper-body', 'all', 4, 2);
    expect(duoRecs.length).toBe(1);
    expect(duoRecs[0].id).toBe('pose_duo_01');
    expect(duoRecs[0].personCount).toBe('duo');

    // Test 3: Exactly 3 people -> Only trio poses
    const trioRecs = recommender.predictBestPoses(liveLandmarks, 'upper-body', 'all', 4, 3);
    expect(trioRecs.length).toBe(1);
    expect(trioRecs[0].id).toBe('pose_trio_01');
    expect(trioRecs[0].personCount).toBe('trio');
  });

  it('suggests different poses for different live postures (arms raised vs sitting vs standing)', () => {
    const recommender = new DatasetRecommender();

    const diverseEntries: DatasetPoseEntry[] = [
      {
        id: 'pose_arms_raised',
        name: 'Music Festival Arms Celebration Pose',
        category: 'Festivals, Parties & Nightlife',
        difficulty: 'beginner',
        framing: 'full-body',
        personCount: 'solo',
        angles: {
          elbowLeft: 160,
          elbowRight: 160,
          shoulderLeft: 160,
          shoulderRight: 160,
          hipLeft: 175,
          hipRight: 175,
          kneeLeft: 175,
          kneeRight: 175,
        },
      },
      {
        id: 'pose_sitting',
        name: 'Sitting Coffee Shop Table Pose',
        category: 'Bench & Sitting Poses',
        difficulty: 'beginner',
        framing: 'full-body',
        personCount: 'solo',
        angles: {
          elbowLeft: 90,
          elbowRight: 90,
          shoulderLeft: 45,
          shoulderRight: 45,
          hipLeft: 90,
          hipRight: 90,
          kneeLeft: 90,
          kneeRight: 90,
        },
      },
      {
        id: 'pose_standing_down',
        name: 'Graduation Portrait Holding Diploma',
        category: 'Graduation Poses',
        difficulty: 'beginner',
        framing: 'full-body',
        personCount: 'solo',
        angles: {
          elbowLeft: 170,
          elbowRight: 170,
          shoulderLeft: 20,
          shoulderRight: 20,
          hipLeft: 175,
          hipRight: 175,
          kneeLeft: 175,
          kneeRight: 175,
        },
      },
    ];

    recommender.getLoader().init(diverseEntries);

    // Frame A: Arms Raised Overhead
    const raisedLandmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      visibility: 0.95,
    }));
    // Shoulders
    raisedLandmarks[11] = { x: 0.45, y: 0.40, visibility: 0.99 };
    raisedLandmarks[12] = { x: 0.55, y: 0.40, visibility: 0.99 };
    // Elbows raised
    raisedLandmarks[13] = { x: 0.42, y: 0.25, visibility: 0.99 };
    raisedLandmarks[14] = { x: 0.58, y: 0.25, visibility: 0.99 };
    // Wrists above head
    raisedLandmarks[15] = { x: 0.40, y: 0.10, visibility: 0.99 };
    raisedLandmarks[16] = { x: 0.60, y: 0.10, visibility: 0.99 };
    // Hips
    raisedLandmarks[23] = { x: 0.46, y: 0.65, visibility: 0.95 };
    raisedLandmarks[24] = { x: 0.54, y: 0.65, visibility: 0.95 };
    // Knees
    raisedLandmarks[25] = { x: 0.46, y: 0.80, visibility: 0.95 };
    raisedLandmarks[26] = { x: 0.54, y: 0.80, visibility: 0.95 };
    // Ankles
    raisedLandmarks[27] = { x: 0.46, y: 0.95, visibility: 0.95 };
    raisedLandmarks[28] = { x: 0.54, y: 0.95, visibility: 0.95 };

    const recsRaised = recommender.predictBestPoses(raisedLandmarks, 'full-body', 'all', 2, 1);
    expect(recsRaised[0].id).toBe('pose_arms_raised');
    expect(recsRaised[0].reason).toContain('arms raised');

    // Frame B: Sitting (hips and knees bent at 90 deg)
    const sittingLandmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      visibility: 0.95,
    }));
    sittingLandmarks[11] = { x: 0.45, y: 0.30, visibility: 0.99 };
    sittingLandmarks[12] = { x: 0.55, y: 0.30, visibility: 0.99 };
    sittingLandmarks[13] = { x: 0.45, y: 0.45, visibility: 0.99 };
    sittingLandmarks[14] = { x: 0.55, y: 0.45, visibility: 0.99 };
    sittingLandmarks[15] = { x: 0.50, y: 0.45, visibility: 0.99 };
    sittingLandmarks[16] = { x: 0.50, y: 0.45, visibility: 0.99 };
    sittingLandmarks[23] = { x: 0.45, y: 0.60, visibility: 0.99 }; // hips
    sittingLandmarks[24] = { x: 0.55, y: 0.60, visibility: 0.99 };
    sittingLandmarks[25] = { x: 0.65, y: 0.60, visibility: 0.99 }; // knees horizontal
    sittingLandmarks[26] = { x: 0.65, y: 0.60, visibility: 0.99 };
    sittingLandmarks[27] = { x: 0.65, y: 0.85, visibility: 0.99 }; // ankles down
    sittingLandmarks[28] = { x: 0.65, y: 0.85, visibility: 0.99 };

    const recsSitting = recommender.predictBestPoses(sittingLandmarks, 'full-body', 'all', 2, 1);
    expect(recsSitting[0].id).toBe('pose_sitting');
  });

  it('deduplicates identical pose titles to ensure diverse recommendations', () => {
    const recommender = new DatasetRecommender();

    const duplicateEntries: DatasetPoseEntry[] = [
      {
        id: 'pose_dup_01',
        name: 'Music Festival Dancing Celebration Pose',
        category: 'Festivals, Parties & Nightlife',
        difficulty: 'beginner',
        framing: 'full-body',
        personCount: 'solo',
        angles: { shoulderLeft: 150, shoulderRight: 150 },
      },
      {
        id: 'pose_dup_02',
        name: 'Music Festival Dancing Celebration Pose',
        category: 'Festivals, Parties & Nightlife',
        difficulty: 'beginner',
        framing: 'full-body',
        personCount: 'solo',
        angles: { shoulderLeft: 148, shoulderRight: 148 },
      },
      {
        id: 'pose_diff_03',
        name: 'Hiking Summit Mountain Peak Stance',
        category: 'Mountains & Nature Hiking',
        difficulty: 'beginner',
        framing: 'full-body',
        personCount: 'solo',
        angles: { shoulderLeft: 145, shoulderRight: 145 },
      },
    ];

    recommender.getLoader().init(duplicateEntries);

    const testLandmarks: NormalizedLandmark[] = Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      visibility: 0.95,
    }));
    testLandmarks[11] = { x: 0.45, y: 0.40, visibility: 0.99 };
    testLandmarks[12] = { x: 0.55, y: 0.40, visibility: 0.99 };
    testLandmarks[13] = { x: 0.42, y: 0.25, visibility: 0.99 };
    testLandmarks[14] = { x: 0.58, y: 0.25, visibility: 0.99 };
    testLandmarks[15] = { x: 0.40, y: 0.15, visibility: 0.99 };
    testLandmarks[16] = { x: 0.60, y: 0.15, visibility: 0.99 };

    const recs = recommender.predictBestPoses(testLandmarks, 'full-body', 'all', 3, 1);
    // Should NOT contain duplicate celebration poses; must include hiking summit
    expect(recs.length).toBe(2);
    const ids = recs.map((r) => r.id);
    const dupCount = ids.filter((id) => id.startsWith('pose_dup')).length;
    expect(dupCount).toBe(1);
    expect(ids).toContain('pose_diff_03');
  });
});
