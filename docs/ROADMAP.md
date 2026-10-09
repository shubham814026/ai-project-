# Pose Coach - Recommendation Engine Roadmap (Leveraging the 10,000+ Dataset)

## 1. Context & Objective
The `./assets/` dataset contains 12,014 harvested photography images and 12,001 rich index entries (`dataset_index.json`) containing 33 MediaPipe keypoints, calculated joint angles, and category metadata.

While raw dataset images cannot be bundled into the client application due to privacy and licensing constraints (Section A10), their rich geometric distribution offers a goldmine for expanding the Pose Coach library and refining pose recommendations.

---

## 2. Phased Development Roadmap

### Phase A: Unsupervised Geometric Pose Clustering
- **Method:** Extract the 33 normalized landmark vectors from `dataset_index.json`.
- **Clustering Algorithm:** Apply HDBSCAN / K-Means clustering on torso-normalized joint coordinates and angles.
- **Deduplication:** Group perceptual hash clusters (`dHash`) to eliminate repeated photo styles.
- **Output:** Identify 50 distinct pose clusters representing the most popular, photogenic, and natural human postures in photography.

---

### Phase B: Authored Vector Schema Synthesis
- **Template Synthesis:** For each discovered cluster centroid:
  1. Calculate the mean joint angles (elbow, shoulder elevation, torso tilt, knee bend).
  2. Synthesize an authored `ReferencePose` JSON object with calibrated tolerances.
  3. Generate an aesthetic, resolution-independent SVG thumbnail.
- **Zero Privacy Risk:** Zero original photos are committed, distributed, or rendered. Poses are represented 100% synthetically.

---

### Phase C: Context-Aware Recommendation Engine
Enhance the existing `RecommendationEngine` with multi-dimensional ranking:
1. **Framing & Aspect Ratio Awareness:** Real-time detection of user distance and aspect ratio (contain vs cover) to recommend matching poses instantly.
2. **Body Symmetry & Ergonomics:** Score poses based on comfortable biomechanical ranges to avoid strained postures.
3. **Progression Pathways:** Structure poses into guided coaching tracks:
   - *Casual & Friendly:* Everyday headshots and conversational poses.
   - *Executive & Confident:* Studio portraits, arms crossed, blazer stances.
   - *Athletic & Postural:* Balance, yoga, and alignment exercises.

---

### Phase D: Offline Tolerance Calibration
- Use the variance within each cluster in `dataset_index.json` to calculate realistic angular standard deviations ($\sigma$).
- Set individual joint tolerances dynamically:
  $$\text{tolerance} = \max(8^\circ, 1.5 \times \sigma_{\text{cluster}})$$
- This replaces arbitrary tolerances with empirical, data-driven thresholds reflecting how real humans naturally pose.
