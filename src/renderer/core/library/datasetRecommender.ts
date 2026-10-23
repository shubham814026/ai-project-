import { NormalizedLandmark } from './types';
import { PoseFeatureExtractor } from './poseFeatureExtractor';
import { PosePredictorModel } from './posePredictorModel';
import { EmbeddingIndex, ScoredMatch } from './embeddingIndex';
import { DatasetLoader } from './datasetLoader';
import { PosePredictionCandidate, PersonCountType, getPosePersonCount } from './datasetTypes';
import { PoseRecommendation } from './recommendationEngine';

export class DatasetRecommender {
  private featureExtractor: PoseFeatureExtractor = new PoseFeatureExtractor();
  private predictorModel: PosePredictorModel = new PosePredictorModel();
  private embeddingIndex: EmbeddingIndex = new EmbeddingIndex();
  private datasetLoader: DatasetLoader = new DatasetLoader();

  private isInitialized: boolean = false;
  private initPromise: Promise<boolean> | null = null;

  public async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        console.log('[DatasetRecommender] Initializing dataset recommender subsystems...');
        const [modelOk, indexOk, dataOk] = await Promise.all([
          this.predictorModel.loadModel(),
          this.embeddingIndex.loadFromBinaryFiles(),
          this.datasetLoader.loadDataset(),
        ]);

        this.isInitialized = dataOk && (indexOk || modelOk);
        console.log(
          `[DatasetRecommender] Initialization result: Model=${modelOk}, Index=${indexOk}, Dataset=${dataOk}`
        );
        return this.isInitialized;
      } catch (err) {
        console.warn('[DatasetRecommender] Initialization failed:', err);
        return false;
      }
    })();

    return this.initPromise;
  }

  public isReady(): boolean {
    return this.isInitialized;
  }

  public getLoader(): DatasetLoader {
    return this.datasetLoader;
  }

  /**
   * Predicts the best poses for the user's "right now frame"
   * strictly adhering to person count constraints:
   * - 1 person in frame -> Solo poses only
   * - 2 people in frame -> Duo / Couple poses only
   * - 3 people in frame -> Trio poses only
   * - 4+ people in frame -> Group poses
   *
   * @param currentLandmarks 33 normalized MediaPipe landmarks from current live frame
   * @param requestedFraming 'upper-body' | 'full-body' | 'auto'
   * @param categoryFilter Optional category name (e.g. 'Aesthetic Selfies', 'Graduation Poses')
   * @param topK Number of recommendations to return (default 4)
   * @param personCount Number of detected people (or PersonCountType)
   */
  /**
   * Predicts the best poses for the user's "right now frame"
   * strictly adhering to person count constraints:
   * - 1 person in frame -> Solo poses only
   * - 2 people in frame -> Duo / Couple poses only
   * - 3 people in frame -> Trio poses only
   * - 4+ people in frame -> Group poses
   *
   * Fully responsive to live bodily movement:
   * Uses direct biomechanical joint angle matching and 74-dim normalized spatial
   * keypoint analysis across all 12,001 reference poses with diversity deduplication.
   *
   * @param currentLandmarks 33 normalized MediaPipe landmarks from current live frame
   * @param requestedFraming 'upper-body' | 'full-body' | 'auto'
   * @param categoryFilter Optional category name (e.g. 'Aesthetic Selfies', 'Graduation Poses')
   * @param topK Number of recommendations to return (default 4)
   * @param personCount Number of detected people (or PersonCountType)
   */
  public predictBestPoses(
    currentLandmarks: NormalizedLandmark[] | null | undefined,
    requestedFraming: 'upper-body' | 'full-body' | 'auto' = 'auto',
    categoryFilter?: string,
    topK: number = 4,
    personCount: number | PersonCountType = 1
  ): PosePredictionCandidate[] {
    if (!this.datasetLoader.isDatasetLoaded()) {
      return [];
    }

    // Determine target person count type: 'solo' (1), 'duo' (2), 'trio' (3), 'group' (4+)
    let targetPersonType: PersonCountType = 'solo';
    if (typeof personCount === 'number') {
      if (personCount <= 1) targetPersonType = 'solo';
      else if (personCount === 2) targetPersonType = 'duo';
      else if (personCount === 3) targetPersonType = 'trio';
      else targetPersonType = 'group';
    } else {
      targetPersonType = personCount;
    }

    // Extract live pose features
    const live = this.featureExtractor.extract(currentLandmarks);
    const activeFraming =
      requestedFraming === 'auto' ? live.framing : requestedFraming;

    // Filter predicate for person count, framing & category
    const filterPredicate = (idx: number): boolean => {
      const pose = this.datasetLoader.getPoseByIndex(idx);
      if (!pose) return false;

      // Strict person count enforcement: 1 person gets solo poses, 2 gets duo poses, etc.
      const posePersonType = pose.personCount || getPosePersonCount(pose.category, pose.name);
      if (posePersonType !== targetPersonType) {
        return false;
      }

      // Category filter
      if (categoryFilter && categoryFilter !== 'all' && pose.category !== categoryFilter) {
        return false;
      }

      // Framing compatibility
      if (activeFraming === 'upper-body') {
        return pose.framing === 'upper-body' || pose.framing === 'either';
      } else if (activeFraming === 'full-body') {
        return pose.framing === 'full-body' || pose.framing === 'either';
      }

      return true;
    };

    let scoredMatches: ScoredMatch[] = [];

    // 1. Primary: Direct high-performance kinematic search across all 12,001 poses
    if (this.embeddingIndex.isIndexReady() && live.isKeypointsValid) {
      scoredMatches = this.embeddingIndex.searchByKinematics(
        live.anglesArray,
        live.features74,
        100,
        filterPredicate,
        0.65,
        0.35
      );
    } else if (live.isKeypointsValid) {
      // Fallback if binary index is not ready (e.g. In unit tests or mock mode)
      const poses = this.datasetLoader.getAllPoses();
      for (let i = 0; i < poses.length; i++) {
        if (!filterPredicate(i)) continue;
        const p = poses[i];
        let score = 50;
        if (p.angles) {
          let sum = 0;
          const pAngles = [
            p.angles.elbowLeft ?? 140,
            p.angles.elbowRight ?? 140,
            p.angles.shoulderLeft ?? 45,
            p.angles.shoulderRight ?? 45,
            p.angles.hipLeft ?? 160,
            p.angles.hipRight ?? 160,
            p.angles.kneeLeft ?? 160,
            p.angles.kneeRight ?? 160,
          ];
          for (let j = 0; j < 8; j++) {
            const diff = Math.abs(live.anglesArray[j] - pAngles[j]);
            const r = diff / 22.0;
            sum += 1.0 / (1.0 + r * r);
          }
          score = (sum / 8.0) * 100.0;
        }
        scoredMatches.push({ index: i, score });
      }
      scoredMatches.sort((a, b) => b.score - a.score);
    } else {
      // If person absent or keypoints invalid: scan for representative poses
      const poses = this.datasetLoader.getAllPoses();
      const limit = Math.min(300, poses.length);
      for (let i = 0; i < limit; i++) {
        if (filterPredicate(i)) {
          scoredMatches.push({ index: i, score: 70 });
        }
      }
    }

    // Helper: Normalize title to deduplicate similar poses
    const normalizePoseTitle = (name: string): string =>
      name
        .toLowerCase()
        .replace(/\b(pose|photoshoot|portrait|aesthetic|photography|stance|shot|candid|full body|upper body)\b/gi, '')
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    // Stance descriptor helper based on live body geometry
    const getStanceDescription = (): string => {
      if (!live.isKeypointsValid) return 'posture guide';
      const [elL, elR, shL, shR, hipL, hipR, knL, knR] = live.anglesArray;

      if (shL > 115 || shR > 115) return 'arms raised stance';
      if (elL < 75 || elR < 75) return 'hand near face / hair';
      if ((hipL < 125 && knL < 125) || (hipR < 125 && knR < 125)) return 'sitting / bench pose';
      if (shL < 50 && elL < 120 && shR < 50 && elR < 120) return 'hands at waist / pockets';
      if (activeFraming === 'upper-body') return 'upper-body portrait form';
      return 'balanced stance';
    };

    const stanceDesc = getStanceDescription();
    const scoredCandidates: PosePredictionCandidate[] = [];
    const seenTitles = new Set<string>();
    const categoryCounts = new Map<string, number>();

    for (const match of scoredMatches) {
      const pose = this.datasetLoader.getPoseByIndex(match.index);
      if (!pose) continue;

      // Title deduplication: avoid recommending identical titles
      const normTitle = normalizePoseTitle(pose.name);
      if (seenTitles.has(normTitle)) continue;

      // Category diversity: limit same category to 2 entries unless candidates are scarce
      const catCount = categoryCounts.get(pose.category) || 0;
      if (catCount >= 2 && scoredCandidates.length < topK) {
        continue;
      }

      // Framing bonus
      const isFramingCompatible =
        pose.framing === 'either' ||
        (pose.framing === 'full-body' && activeFraming === 'full-body') ||
        (pose.framing === 'upper-body' && (activeFraming === 'upper-body' || activeFraming === 'full-body'));

      const rawScore = live.isKeypointsValid
        ? match.score + (isFramingCompatible ? 6 : 0)
        : (isFramingCompatible ? 80 : 50) + (pose.difficulty === 'beginner' ? 10 : 5);

      const matchPct = Math.round(Math.max(25, Math.min(99, rawScore)));

      // Construct truthful, descriptive reasoning
      const reasons: string[] = [];
      reasons.push(`${matchPct}% match`);
      reasons.push(stanceDesc);
      if (isFramingCompatible) {
        reasons.push(`fits ${activeFraming}`);
      }

      const imageSrc = pose.hasLocalImage && pose.image
        ? `/assets/images/${pose.image}`
        : pose.imageUrl || '';

      const referencePose = this.datasetLoader.toReferencePose(pose);

      seenTitles.add(normTitle);
      categoryCounts.set(pose.category, catCount + 1);

      scoredCandidates.push({
        index: match.index,
        id: pose.id,
        name: pose.name,
        category: pose.category,
        difficulty: pose.difficulty,
        framing: pose.framing,
        personCount: targetPersonType,
        imageSrc,
        thumbnail: pose.thumbnail || referencePose.thumbnail,
        score: rawScore,
        matchPercentage: matchPct,
        reason: reasons.join(' • '),
        isFramingCompatible,
        referencePose,
      });

      if (scoredCandidates.length >= topK) {
        break;
      }
    }

    return scoredCandidates;
  }

  /**
   * Adapts dataset recommendations to standard PoseRecommendation format
   */
  public toPoseRecommendations(candidates: PosePredictionCandidate[]): PoseRecommendation[] {
    return candidates.map((c) => ({
      pose: c.referencePose,
      score: c.score,
      matchPercentage: c.matchPercentage,
      reason: c.reason,
      isFramingCompatible: c.isFramingCompatible,
    }));
  }
}
