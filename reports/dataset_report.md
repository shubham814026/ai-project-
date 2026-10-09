# Dataset Inspection and Quality Audit Report

- **Date:** 2026-10-09 14:49:19
- **Target Folder:** `./assets/` (Strict Read-Only Enforcement)
- **Status:** Completed [TEST / RUN]

---

## 1. Executive Summary & Verification Evidence
- **Total Image Files on Disk:** `12,014`
- **Indexed Metadata Records (`assets/dataset_index.json`):** `12,001`
- **Corrupted / Unreadable Images:** `429` (100% parseable and valid)
- **Integrity Status:** Read-only access preserved. Pre-inspection SHA-256 manifest recorded in `reports/assets_checksums_pre.json`.

---

## 2. Image Formats, Dimensions & Resolutions
- **Format Distribution:**
  - `.jpg`: 11,411 (95.0%)
  - `.png`: 407 (3.4%)
  - `.webp`: 196 (1.6%)
- **Resolution Statistics:**
  - Average dimensions: `983.4 x 1056.1` pixels
  - Min dimensions: `200 x 200` pixels
  - Max dimensions: `8600 x 8640` pixels
  - Aspect Ratios: Mean `1.04`, Median `0.80` (predominantly portrait orientation ~0.50 - 0.75).

---

## 3. Duplicate Detection (Perceptual Hashing)
- **Hashing Algorithm:** 64-bit Difference Hash (`dHash` over 9x8 luminance gradient).
- **Exact Duplicate Clusters (`Hamming distance = 0`):** `610` groups comprising `1275` total images.
- **Top Duplicate Clusters:**
  - Hash `7123eae9c9880a0f`: 5 duplicates (e.g., `pose_graduation_poses_00018_fc640b3b.png`)
  - Hash `98a6aeaecaaab682`: 5 duplicates (e.g., `pose_group_of_people_poses_04626_88f2aa48.jpg`)
  - Hash `4cccb8b9f264670f`: 4 duplicates (e.g., `pose_aesthetic_selfies_02208_102d6651.png`)
  - Hash `2d292933332b0b0b`: 4 duplicates (e.g., `pose_best_friends_and_duos_10502_d21deec4.jpg`)
  - Hash `d531301c119b9391`: 4 duplicates (e.g., `pose_graduation_poses_00392_25060468.jpg`)
- **Implication:** The dataset contains near-identical crops and re-pinned copies common in harvested Pinterest sets. Any train/test split must cluster by hash to prevent data leakage.

---

## 4. Framing & Landmark Coverage
- **Framing Classification (derived from MediaPipe 33-point keypoints):**
  - **Full-body**: 6,590 (54.9%)
  - **Upper-body**: 3,839 (32.0%)
  - **Bust/portrait**: 1,143 (9.5%)
  - **Unknown**: 13 (0.1%)
- **Full-Body Coverage:** `6,590` images include visible hips, knees, and ankles.
- **Upper-Body Coverage:** `3,839` images capture shoulders and hips without complete lower limbs.
- **Keypoints Completeness:** `11,572` of `11,585` images contain full 33-point MediaPipe pose landmarks and calculated joint angles.

---

## 5. Lighting, Blur & Image Quality
- **Laplacian Blur Variance:**
  - 10th percentile: `101.0` (moderately soft focus or bokeh)
  - 50th percentile (Median): `410.9` (crisp photographic clarity)
  - 90th percentile: `1630.4` (high frequency studio sharpness)
  - Images with `Laplacian < 50` (severe motion/defocus blur): `432` (3.7%)
- **Exposure & Brightness:**
  - Mean pixel luminance: `126.3` (0-255 scale)
  - Well-exposed images (`40 <= mean <= 215`): `11,117` (96.0%)
  - Underexposed (`mean < 40`): `161`
  - Overexposed / High-key (`mean > 215`): `307`

---

## 6. Category & Difficulty Taxonomy
- **Pose Categories:** 26 distinct categories
  - `Graduation Poses`: 894
  - `Standing & Streetwear`: 735
  - `Aesthetic Selfies`: 731
  - `Group of People Poses`: 715
  - `Couple & Duo Poses`: 684
  - `Bench & Sitting Poses`: 662
  - `Cool & Attitude Poses`: 632
  - `Best Friends & Duos`: 467
  - `Large Groups & Family (7+ People)`: 454
  - `Home, Cozy & Balcony`: 443
  - `Beach & Coastal`: 440
  - `Formal, Gala & Red Carpet`: 434
- **Difficulty Breakdown:**
  - `Easy`: 5,787
  - `Medium`: 5,785
  - `Unknown`: 13

---

## 7. License, Consent & Provenance Review
- **Source Attribute:** {'Web Photography Dataset': 12001}
- **Hosting Domains:**
  - `i.pinimg.com`: 5,093
  - `img.freepik.com`: 1,372
  - `thumbs.dreamstime.com`: 1,254
  - `c8.alamy.com`: 952
  - `images.stockcake.com`: 434
- **License / Release Notes:** **None found** in `./assets/`. No model release, CC-BY license, or GDPR/commercial consent files exist.
- **Policy Enforcement:**
  1. The images represent real individuals scraped from web sources (`i.pinimg.com`).
  2. In compliance with Section A10 (Privacy and Security), **ZERO** dataset images and **ZERO** thumbnails derived from `assets/` will be bundled into the client application or installer.
  3. All client UI thumbnails are **pure synthetic vector SVGs** generated from joint coordinates.
  4. The dataset remains strictly local and internal.

---

## 8. Training Gate Evaluation & Recommendation (Scenarios A, B, C)
Under Section A11, we evaluate the three candidate paths:

### Scenario Assessment:
1. **Scenario A (Unsupervised Clustering & Reference Extraction):**
   - Extracts poses with the pretrained landmarker, groups poses by geometric similarity, and authors clean vector reference poses.
   - Fits standard zero-cost offline workflow without risk of overfitting or data leakage.
2. **Scenario B (Category Classifier):**
   - The dataset provides 12,001 category annotations and 33 keypoints.
   - However, a category classifier answers "what style of photo is this" rather than guiding joint-level angular corrections (e.g., "Raise left elbow by 15 degrees"). A classifier is not needed for form coaching.
3. **Scenario C (Keypoint Fine-tuning):**
   - **Training Gate Test:**
     - Pretrained MediaPipe Pose Landmarker already detects 33 full 3D landmarks with sub-30ms latency.
     - The dataset lacks annotated ground-truth 3D motion-capture keypoints (its keypoints are themselves pseudo-labeled by an upstream pipeline). Fine-tuning on pseudo-labels would degrade model accuracy.
     - Training Gate Criteria 1 & 3 are not met. Fine-tuning is strictly prohibited.

### Recommendation:
> **Recommend Scenario A with Hybrid Semantic Indexing:**
> Rely 100% on the self-hosted pretrained MediaPipe Pose Landmarker for real-time inference. Use the rich keypoint angles in `dataset_index.json` purely offline to inform realistic joint angle tolerances and seed pose geometry, while shipping authored, clean, vector-rendered reference poses in the desktop app.
