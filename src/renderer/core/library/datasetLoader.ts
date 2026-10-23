import { DatasetPoseEntry, PersonCountType, getPosePersonCount } from './datasetTypes';
import { ReferencePose, NormalizedLandmark, PoseFeature } from './types';

export class DatasetLoader {
  private poses: DatasetPoseEntry[] = [];
  private poseMap: Map<string, DatasetPoseEntry> = new Map();
  private categoryMap: Map<string, DatasetPoseEntry[]> = new Map();
  private personCountMap: Map<PersonCountType, DatasetPoseEntry[]> = new Map();
  private categoriesList: string[] = [];
  private isLoaded: boolean = false;
  private loadPromise: Promise<boolean> | null = null;

  public async loadDataset(
    summaryUrl = '/data/reference_poses_summary.json'
  ): Promise<boolean> {
    if (this.isLoaded) return true;
    if (this.loadPromise) return this.loadPromise;
    if (typeof window === 'undefined' || !window.location) return false;

    this.loadPromise = (async () => {
      try {
        let resp = await fetch(summaryUrl);
        if (!resp.ok) {
          resp = await fetch('/data/reference_dataset.json');
        }
        if (!resp.ok) {
          console.warn('[DatasetLoader] Could not fetch dataset from', summaryUrl);
          return false;
        }

        const data: DatasetPoseEntry[] = await resp.json();
        this.init(data);
        return true;
      } catch (err) {
        console.warn('[DatasetLoader] Error loading dataset:', err);
        return false;
      }
    })();

    return this.loadPromise;
  }

  public init(entries: DatasetPoseEntry[]): void {
    this.poses = entries;
    this.poseMap.clear();
    this.categoryMap.clear();
    this.personCountMap.clear();

    const catSet = new Set<string>();

    for (let i = 0; i < entries.length; i++) {
      const p = entries[i];
      if (!p.personCount) {
        p.personCount = getPosePersonCount(p.category, p.name);
      }
      this.poseMap.set(p.id, p);

      const cat = p.category || 'General';
      catSet.add(cat);
      let list = this.categoryMap.get(cat);
      if (!list) {
        list = [];
        this.categoryMap.set(cat, list);
      }
      list.push(p);

      let pList = this.personCountMap.get(p.personCount);
      if (!pList) {
        pList = [];
        this.personCountMap.set(p.personCount, pList);
      }
      pList.push(p);
    }

    this.categoriesList = Array.from(catSet).sort();
    this.isLoaded = true;
    console.log(`[DatasetLoader] Indexed ${entries.length} reference poses across ${this.categoriesList.length} categories.`);
  }

  public getPosesByPersonCount(personCount: PersonCountType): DatasetPoseEntry[] {
    return this.personCountMap.get(personCount) || [];
  }

  public isDatasetLoaded(): boolean {
    return this.isLoaded;
  }

  public getAllPoses(): DatasetPoseEntry[] {
    return this.poses;
  }

  public getPoseById(id: string): DatasetPoseEntry | undefined {
    return this.poseMap.get(id);
  }

  public getPoseByIndex(index: number): DatasetPoseEntry | undefined {
    return this.poses[index];
  }

  public getCategories(): string[] {
    return this.categoriesList;
  }

  public getPosesByCategory(category: string): DatasetPoseEntry[] {
    return this.categoryMap.get(category) || [];
  }

  public getTotalCount(): number {
    return this.poses.length;
  }

  /**
   * Converts a dataset entry into an active coaching ReferencePose.
   * Synthesizes biomechanical features for live scoring and target guide rendering.
   */
  public toReferencePose(entry: DatasetPoseEntry): ReferencePose {
    // Convert 33 keypoints
    let targetLandmarks: NormalizedLandmark[] | undefined;
    if (entry.keypoints && entry.keypoints.length >= 33) {
      targetLandmarks = entry.keypoints.map((pt) => ({
        x: pt[0],
        y: pt[1],
        visibility: pt[2] ?? 1.0,
      }));
    }

    // Build synthesized PoseFeatures from angles
    const features: PoseFeature[] = [];

    // Critical spine vertical alignment
    features.push({
      id: 'spine_alignment',
      kind: 'tilt',
      landmarks: [0, 11, 12],
      target: 0,
      tolerance: 9,
      weight: 2,
      critical: true,
    });

    if (entry.angles) {
      if (typeof entry.angles.elbowLeft === 'number') {
        features.push({
          id: 'left_elbow',
          kind: 'angle',
          landmarks: [11, 13, 15],
          target: Math.round(entry.angles.elbowLeft),
          tolerance: 24,
          weight: 1,
        });
      }
      if (typeof entry.angles.elbowRight === 'number') {
        features.push({
          id: 'right_elbow',
          kind: 'angle',
          landmarks: [12, 14, 16],
          target: Math.round(entry.angles.elbowRight),
          tolerance: 24,
          weight: 1,
        });
      }
      if (typeof entry.angles.shoulderLeft === 'number') {
        features.push({
          id: 'left_shoulder',
          kind: 'angle',
          landmarks: [13, 11, 23],
          target: Math.round(entry.angles.shoulderLeft),
          tolerance: 22,
          weight: 1,
        });
      }
      if (typeof entry.angles.shoulderRight === 'number') {
        features.push({
          id: 'right_shoulder',
          kind: 'angle',
          landmarks: [14, 12, 24],
          target: Math.round(entry.angles.shoulderRight),
          tolerance: 22,
          weight: 1,
        });
      }
      if (entry.framing === 'full-body') {
        if (typeof entry.angles.kneeLeft === 'number') {
          features.push({
            id: 'left_knee',
            kind: 'angle',
            landmarks: [23, 25, 27],
            target: Math.round(entry.angles.kneeLeft),
            tolerance: 25,
            weight: 1,
          });
        }
        if (typeof entry.angles.kneeRight === 'number') {
          features.push({
            id: 'right_knee',
            kind: 'angle',
            landmarks: [24, 26, 28],
            target: Math.round(entry.angles.kneeRight),
            tolerance: 25,
            weight: 1,
          });
        }
      }
    }

    const imageSrc = entry.hasLocalImage && entry.image
      ? `/assets/images/${entry.image}`
      : entry.imageUrl || '';

    const personCount = entry.personCount || getPosePersonCount(entry.category, entry.name);

    return {
      id: entry.id,
      name: entry.name,
      category: entry.category,
      tags: [entry.category.toLowerCase(), entry.framing, entry.difficulty, personCount],
      difficulty: entry.difficulty,
      framing: entry.framing,
      description: `Photography reference pose from the DirectAI ${entry.category} collection.`,
      instructions: [
        'Align your posture with the golden skeleton guide',
        'Match the arm and shoulder elevation shown in the reference photo',
        'Hold the form steadily for automatic studio capture',
      ],
      requiredLandmarks:
        entry.framing === 'full-body'
          ? [11, 12, 13, 14, 23, 24, 25, 26]
          : [11, 12, 13, 14, 23, 24],
      features,
      landmarks: targetLandmarks,
      mirrorAllowed: true,
      source: 'dataset',
      sourceImage: imageSrc,
      thumbnail: entry.thumbnail || '',
      reviewed: true,
    };
  }
}
