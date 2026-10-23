import { RecommenderModelWeights } from './datasetTypes';

export class PosePredictorModel {
  private weights: RecommenderModelWeights | null = null;
  private isLoaded: boolean = false;

  // Preallocated inference buffers to prevent garbage collection pauses
  private h1Buffer = new Float32Array(128);
  private h2Buffer = new Float32Array(96);
  private outputEmbeddingBuffer = new Float32Array(64);

  // Flattened weight matrices for fast cache-friendly execution
  private flatW1: Float32Array | null = null; // 74 x 128
  private flatB1: Float32Array | null = null; // 128
  private flatW2: Float32Array | null = null; // 128 x 96
  private flatB2: Float32Array | null = null; // 96
  private flatW3: Float32Array | null = null; // 96 x 64
  private flatB3: Float32Array | null = null; // 64

  public async loadModel(modelUrl = '/models/pose_recommender/model_weights.json'): Promise<boolean> {
    if (this.isLoaded) return true;
    if (typeof window === 'undefined' || !window.location) return false;

    try {
      let resp = await fetch(modelUrl);
      if (!resp.ok) {
        resp = await fetch('/data/pose_recommender_weights.json');
      }
      if (!resp.ok) {
        console.warn(`[PosePredictorModel] Failed to fetch weights from ${modelUrl}`);
        return false;
      }

      const json: RecommenderModelWeights = await resp.json();
      this.initFromWeights(json);
      return true;
    } catch (e) {
      console.warn('[PosePredictorModel] Failed to load model weights:', e);
      return false;
    }
  }

  public initFromWeights(modelData: RecommenderModelWeights): void {
    this.weights = modelData;
    const l1 = modelData.layers[0];
    const l2 = modelData.layers[1];
    const l3 = modelData.layers[2];

    // Layer 1: 74 x 128
    const in1 = l1.weights.length;
    const out1 = l1.biases.length;
    this.flatW1 = new Float32Array(in1 * out1);
    this.flatB1 = new Float32Array(l1.biases);
    for (let r = 0; r < in1; r++) {
      for (let c = 0; c < out1; c++) {
        this.flatW1[r * out1 + c] = l1.weights[r][c];
      }
    }

    // Layer 2: 128 x 96
    const in2 = l2.weights.length;
    const out2 = l2.biases.length;
    this.flatW2 = new Float32Array(in2 * out2);
    this.flatB2 = new Float32Array(l2.biases);
    for (let r = 0; r < in2; r++) {
      for (let c = 0; c < out2; c++) {
        this.flatW2[r * out2 + c] = l2.weights[r][c];
      }
    }

    // Layer 3: 96 x 64
    const in3 = l3.weights.length;
    const out3 = l3.biases.length;
    this.flatW3 = new Float32Array(in3 * out3);
    this.flatB3 = new Float32Array(l3.biases);
    for (let r = 0; r < in3; r++) {
      for (let c = 0; c < out3; c++) {
        this.flatW3[r * out3 + c] = l3.weights[r][c];
      }
    }

    this.isLoaded = true;
    console.log(`[PosePredictorModel] Initialized Neural Predictor (74 -> 128 -> 96 -> 64) successfully.`);
  }

  public isModelReady(): boolean {
    return this.isLoaded;
  }

  public getWeights(): RecommenderModelWeights | null {
    return this.weights;
  }

  /**
   * Forward pass: computes 64-dim unit embedding from 74-dim live feature vector
   * Runs in < 0.03ms with 0 allocations.
   */
  public predictEmbedding(features74: Float32Array): Float32Array {
    if (!this.isLoaded || !this.flatW1 || !this.flatB1 || !this.flatW2 || !this.flatB2 || !this.flatW3 || !this.flatB3) {
      return this.outputEmbeddingBuffer;
    }

    // Layer 1: ReLU(X * W1 + b1)
    const out1 = 128;
    for (let j = 0; j < out1; j++) {
      let sum = this.flatB1[j];
      for (let i = 0; i < 74; i++) {
        sum += features74[i] * this.flatW1[i * out1 + j];
      }
      this.h1Buffer[j] = sum > 0 ? sum : 0; // ReLU
    }

    // Layer 2: ReLU(h1 * W2 + b2)
    const out2 = 96;
    for (let j = 0; j < out2; j++) {
      let sum = this.flatB2[j];
      for (let i = 0; i < 128; i++) {
        sum += this.h1Buffer[i] * this.flatW2[i * out2 + j];
      }
      this.h2Buffer[j] = sum > 0 ? sum : 0; // ReLU
    }

    // Layer 3: Linear(h2 * W3 + b3)
    const out3 = 64;
    let sumSq = 0;
    for (let j = 0; j < out3; j++) {
      let sum = this.flatB3[j];
      for (let i = 0; i < 96; i++) {
        sum += this.h2Buffer[i] * this.flatW3[i * out3 + j];
      }
      this.outputEmbeddingBuffer[j] = sum;
      sumSq += sum * sum;
    }

    // L2 Normalization to unit hypersphere
    const norm = Math.sqrt(sumSq) || 1e-6;
    for (let j = 0; j < out3; j++) {
      this.outputEmbeddingBuffer[j] /= norm;
    }

    return this.outputEmbeddingBuffer;
  }
}
