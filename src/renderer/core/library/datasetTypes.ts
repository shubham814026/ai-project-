import { ReferencePose } from './types';

export type PersonCountType = 'solo' | 'duo' | 'trio' | 'group';

export function getPosePersonCount(category: string, name: string = ''): PersonCountType {
  const cat = category.toLowerCase();
  const n = name.toLowerCase();

  if (
    cat.includes('trio') ||
    cat.includes('3 people') ||
    n.includes('trio') ||
    n.includes('three people')
  ) {
    return 'trio';
  }

  if (
    cat.includes('couple') ||
    cat.includes('duo') ||
    cat.includes('romantic') ||
    cat.includes('best friends') ||
    n.includes('couple') ||
    n.includes('duo') ||
    n.includes('two people')
  ) {
    return 'duo';
  }

  if (
    cat.includes('group') ||
    cat.includes('family') ||
    cat.includes('4 to 6') ||
    cat.includes('7+') ||
    n.includes('group') ||
    n.includes('family')
  ) {
    return 'group';
  }

  return 'solo';
}

export interface DatasetPoseEntry {
  id: string;
  name: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  framing: 'upper-body' | 'full-body' | 'either';
  personCount?: PersonCountType;
  image?: string;
  imageUrl?: string;
  hasLocalImage?: boolean;
  angles?: {
    elbowLeft?: number;
    elbowRight?: number;
    shoulderLeft?: number;
    shoulderRight?: number;
    hipLeft?: number;
    hipRight?: number;
    kneeLeft?: number;
    kneeRight?: number;
    [key: string]: number | undefined;
  };
  keypoints?: [number, number, number][]; // [x, y, visibility]
  thumbnail?: string;
}

export interface ModelLayer {
  weights: number[][]; // [inDim][outDim]
  biases: number[];    // [outDim]
}

export interface RecommenderModelWeights {
  architecture: {
    inputDim: number;
    hiddenDims: number[];
    outputDim: number;
    activation: string;
  };
  layers: ModelLayer[];
  metrics?: {
    valMSE: number;
    totalPoses: number;
  };
}

export interface PosePredictionCandidate {
  index: number;
  id: string;
  name: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  framing: 'upper-body' | 'full-body' | 'either';
  personCount: PersonCountType;
  imageSrc: string;
  thumbnail: string;
  score: number;
  matchPercentage: number;
  reason: string;
  isFramingCompatible: boolean;
  referencePose: ReferencePose;
}
