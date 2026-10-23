/**
 * Pose Recommendation Engine
 * Strictly adheres to Section A6 Suggestion rules:
 * Ranks poses by:
 * 1. Compatibility with the framing currently visible
 * 2. Beginner difficulty first
 * 3. Closeness to the current pose
 * Shows clear, truthful reasons without claiming aesthetic taste.
 *
 * Enhanced with ML-driven Dual-Stage Retrieval across 12,001 reference poses:
 * - Embedding neural prediction from current video frame
 * - Biomechanical joint-angle alignment
 * - Seed pose fallback
 */

import { ReferencePose, NormalizedLandmark } from './types';
import { PoseMatcher } from '../matching/poseMatcher';
import { DatasetRecommender } from './datasetRecommender';
import { SEED_POSES } from './seedPoses';

export interface PoseRecommendation {
  pose: ReferencePose;
  score: number;
  matchPercentage: number;
  reason: string;
  isFramingCompatible: boolean;
}

export class RecommendationEngine {
  private matcher: PoseMatcher = new PoseMatcher();
  private datasetRecommender: DatasetRecommender = new DatasetRecommender();

  constructor() {
    // Proactively initialize dataset recommender asynchronously
    this.datasetRecommender.initialize().catch((err) => {
      console.warn('[RecommendationEngine] DatasetRecommender background init warning:', err);
    });
  }

  public getDatasetRecommender(): DatasetRecommender {
    return this.datasetRecommender;
  }

  /**
   * Evaluates current live video frame against the reference pose library
   * and returns the top candidates matching what the user is doing right now.
   */
  public findBestMatchesFromFrame(
    library: ReferencePose[] = SEED_POSES,
    currentLandmarks: NormalizedLandmark[] | null,
    currentFraming: 'full-body' | 'upper-body' | 'partial' = 'upper-body',
    topK: number = 4,
    categoryFilter?: string,
    personCount: number = 1
  ): PoseRecommendation[] {
    // Try ML dataset recommendation first if dataset is ready
    if (this.datasetRecommender.isReady()) {
      try {
        const candidates = this.datasetRecommender.predictBestPoses(
          currentLandmarks,
          currentFraming === 'partial' ? 'auto' : currentFraming,
          categoryFilter,
          topK,
          personCount
        );
        const validCandidates = candidates.filter(
          (c) => c.referencePose && c.referencePose.landmarks && c.referencePose.landmarks.length >= 33 && c.referencePose.features && c.referencePose.features.length > 1
        );
        if (validCandidates.length > 0) {
          return this.datasetRecommender.toPoseRecommendations(validCandidates);
        }
      } catch (err) {
        console.warn('[RecommendationEngine] Dataset prediction fallback to seed poses:', err);
      }
    }

    // Fallback to feature-weighted matching on provided library (e.g. SEED_POSES)
    if (!currentLandmarks || currentLandmarks.length === 0) {
      return this.rankPoses(library, null, currentFraming).slice(0, topK);
    }

    const scored = library.map((pose) => {
      const matchRes = this.matcher.scorePose(currentLandmarks, pose, true);
      const matchPct = Math.round(matchRes.overallScore);

      const isFramingCompatible =
        pose.framing === 'either' ||
        (pose.framing === 'full-body' && currentFraming === 'full-body') ||
        (pose.framing === 'upper-body' && (currentFraming === 'upper-body' || currentFraming === 'full-body'));

      const reasons: string[] = [];
      if (matchPct >= 80) {
        reasons.push(`${matchPct}% match to your current stance`);
      } else if (matchPct >= 60) {
        reasons.push(`${matchPct}% similarity`);
      } else {
        reasons.push(`${matchPct}% partial match`);
      }

      if (isFramingCompatible) {
        reasons.push(`fits ${currentFraming}`);
      }

      // Feature specific reason
      const bestFeature = matchRes.featureResults.reduce(
        (prev, curr) => (curr.score > (prev?.score ?? 0) ? curr : prev),
        matchRes.featureResults[0]
      );
      if (bestFeature && bestFeature.featureId && bestFeature.score > 0.8) {
        reasons.push(`matching ${bestFeature.featureId.replace(/_/g, ' ')}`);
      }

      return {
        pose,
        score: matchPct * 2.0 + (isFramingCompatible ? 25 : 0),
        matchPercentage: matchPct,
        reason: reasons.join(' • '),
        isFramingCompatible,
      };
    });

    // Sort strictly descending by match percentage
    return scored.sort((a, b) => b.matchPercentage - a.matchPercentage).slice(0, topK);
  }

  public rankPoses(
    library: ReferencePose[],
    currentLandmarks: NormalizedLandmark[] | null,
    currentFraming: 'full-body' | 'upper-body' | 'partial'
  ): PoseRecommendation[] {
    const scoredList: PoseRecommendation[] = library.map((pose) => {
      // 1. Framing compatibility
      const isFramingCompatible =
        pose.framing === 'either' ||
        (pose.framing === 'full-body' && currentFraming === 'full-body') ||
        (pose.framing === 'upper-body' && (currentFraming === 'upper-body' || currentFraming === 'full-body'));

      // 2. Proximity to current pose (0-100)
      let proximityScore = 0;
      if (currentLandmarks && currentLandmarks.length > 0) {
        const matchRes = this.matcher.scorePose(currentLandmarks, pose, true);
        proximityScore = Math.round(matchRes.overallScore);
      }

      // Difficulty weight bonus
      const difficultyBonus =
        pose.difficulty === 'beginner' ? 8 : pose.difficulty === 'intermediate' ? 5 : 2;

      // When live landmarks exist, proximity to user's body is the primary driver (2.5x multiplier)
      const totalScore = currentLandmarks && currentLandmarks.length > 0
        ? proximityScore * 2.5 + (isFramingCompatible ? 30 : 0) + difficultyBonus
        : (isFramingCompatible ? 100 : 20) + difficultyBonus;

      // Reason formulation
      const reasons: string[] = [];
      if (proximityScore >= 70) {
        reasons.push(`${proximityScore}% match to your current form`);
      } else if (proximityScore >= 45) {
        reasons.push(`${proximityScore}% form similarity`);
      }

      if (isFramingCompatible) {
        reasons.push(`matches ${currentFraming} framing`);
      } else {
        reasons.push(`requires ${pose.framing} view`);
      }

      return {
        pose,
        score: totalScore,
        matchPercentage: proximityScore,
        reason: reasons.join(' • '),
        isFramingCompatible,
      };
    });

    // Sort descending by recommendation score
    return scoredList.sort((a, b) => b.score - a.score);
  }
}
