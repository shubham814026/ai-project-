"""
tools/train_pose_predictor.py - Train pose predictor model from assets/dataset_index.json
Produces:
1. data/reference_dataset.json (Compact dataset with 12,001 poses for runtime)
2. data/pose_features.bin (Binary Float32Array: 12001 x 74)
3. data/pose_embeddings.bin (Binary Float32Array: 12001 x 64)
4. data/pose_angles.bin (Binary Float32Array: 12001 x 8)
5. public/models/pose_recommender/model_weights.json (Trained MLP weights for live frame inference)
6. data/pose_categories.json (Category manifests and counts)
"""

import os
import sys
import json
import math
import struct
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPRegressor
from sklearn.metrics import mean_squared_error

JOINTS = [
    'elbowLeft', 'elbowRight',
    'shoulderLeft', 'shoulderRight',
    'hipLeft', 'hipRight',
    'kneeLeft', 'kneeRight'
]

def generate_svg_thumbnail(landmarks, pose_name, width=200, height=260):
    """Generate vector SVG skeleton thumbnail matching the project design system."""
    connections = [
        (0, 1), (0, 4), (1, 2), (2, 3), (4, 5), (5, 6),
        (11, 12), (11, 13), (13, 15), (12, 14), (14, 16),
        (11, 23), (12, 24), (23, 24),
        (23, 25), (25, 27), (24, 26), (26, 28)
    ]
    pad_x = 24
    pad_y = 36
    draw_w = width - 2 * pad_x
    draw_h = height - pad_y - 48

    def pt(idx):
        if idx < len(landmarks):
            lm = landmarks[idx]
            x = pad_x + lm.get('x', 0.5) * draw_w
            y = pad_y + lm.get('y', 0.5) * draw_h
            return x, y
        return 0, 0

    lines_svg = []
    for p1, p2 in connections:
        if p1 < len(landmarks) and p2 < len(landmarks):
            lm1, lm2 = landmarks[p1], landmarks[p2]
            if lm1.get('visibility', 1.0) > 0.35 and lm2.get('visibility', 1.0) > 0.35:
                x1, y1 = pt(p1)
                x2, y2 = pt(p2)
                lines_svg.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="#C5A059" stroke-width="2.5" stroke-linecap="round" opacity="0.85" />')

    joints_svg = []
    key_joints = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
    for j in key_joints:
        if j < len(landmarks) and landmarks[j].get('visibility', 1.0) > 0.35:
            x, y = pt(j)
            radius = 4.0 if j in (15, 16, 27, 28) else 3.5
            color = "#5EEAD4" if j in (15, 16) else "#F4F6F4"
            joints_svg.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{radius}" fill="{color}" stroke="#0F251E" stroke-width="1.2" />')

    safe_name = pose_name.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="100%" height="100%" style="background:#16382D;border-radius:12px;">
  <rect width="{width}" height="{height}" rx="12" fill="#16382D" stroke="rgba(244,246,244,0.12)" stroke-width="1"/>
  <g class="skeleton">
    {''.join(lines_svg)}
    {''.join(joints_svg)}
  </g>
  <text x="{width/2:.1f}" y="{height - 14}" text-anchor="middle" fill="#F4F6F4" font-family="Inter, sans-serif" font-size="10" font-weight="500">{safe_name[:24]}</text>
</svg>'''

def determine_framing(kps):
    """Determine whether pose is full-body, upper-body, or partial."""
    ankles_vis = (kps[27].get('visibility', 1.0) > 0.4) or (kps[28].get('visibility', 1.0) > 0.4)
    knees_vis = (kps[25].get('visibility', 1.0) > 0.4) or (kps[26].get('visibility', 1.0) > 0.4)
    hips_vis = (kps[23].get('visibility', 1.0) > 0.4) or (kps[24].get('visibility', 1.0) > 0.4)
    shoulders_vis = (kps[11].get('visibility', 1.0) > 0.4) or (kps[12].get('visibility', 1.0) > 0.4)

    if ankles_vis and knees_vis and hips_vis:
        return 'full-body'
    elif hips_vis and shoulders_vis:
        return 'upper-body'
    else:
        return 'either'

def determine_person_count(category, name=''):
    """Determine whether pose is for 1 person (solo), 2 people (duo), 3 people (trio), or group."""
    cat = category.lower()
    n = name.lower()
    if 'trio' in cat or '3 people' in cat or 'trio' in n or 'three people' in n:
        return 'trio'
    if 'couple' in cat or 'duo' in cat or 'romantic' in cat or 'best friends' in cat or 'couple' in n or 'duo' in n or 'two people' in n:
        return 'duo'
    if 'group' in cat or 'family' in cat or '4 to 6' in cat or '7+' in cat or 'group' in n or 'family' in n:
        return 'group'
    return 'solo'

def extract_74_features(kps, angles_dict):
    """
    Extract normalized 74-dimensional feature vector:
    - 8 normalized angles: [0, 1] range (angle / 180.0)
    - 66 shoulder-normalized (x, y) keypoints
    """
    angles = [float(angles_dict.get(j, 90.0)) / 180.0 for j in JOINTS]
    s11, s12 = kps[11], kps[12]
    mx = (s11['x'] + s12['x']) / 2.0
    my = (s11['y'] + s12['y']) / 2.0
    sw = max(0.01, math.sqrt((s11['x'] - s12['x'])**2 + (s11['y'] - s12['y'])**2))

    norm_kps = []
    for kp in kps:
        norm_kps.append((kp['x'] - mx) / sw)
        norm_kps.append((kp['y'] - my) / sw)

    return angles + norm_kps

def main():
    print("[1/5] Loading assets/dataset_index.json...")
    input_path = os.path.join(os.path.dirname(__file__), '..', 'assets', 'dataset_index.json')
    if not os.path.exists(input_path):
        print(f"Error: {input_path} not found!")
        sys.exit(1)

    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    N = len(data)
    print(f"Found {N} pose entries.")

    # Check local images directory
    images_dir = os.path.join(os.path.dirname(__file__), '..', 'assets', 'images')
    available_images = set(os.listdir(images_dir)) if os.path.exists(images_dir) else set()
    print(f"Verified {len(available_images)} images in assets/images.")

    # Ensure output directories exist
    os.makedirs('data', exist_ok=True)
    os.makedirs('public/models/pose_recommender', exist_ok=True)
    os.makedirs('public/data', exist_ok=True)

    print("[2/5] Building feature matrices and compact pose metadata...")
    X_features = np.zeros((N, 74), dtype=np.float32)
    Y_embeddings = np.zeros((N, 64), dtype=np.float32)
    angles_matrix = np.zeros((N, 8), dtype=np.float32)

    compact_entries = []
    categories_set = set()
    category_counts = {}

    for i, d in enumerate(data):
        kps = d['keypoints']
        angles = d.get('targetJointAngles', {})
        emb = d.get('embedding', [])

        # 74-dim normalized feature
        feat = extract_74_features(kps, angles)
        X_features[i] = feat

        # 64-dim embedding
        if len(emb) == 64:
            Y_embeddings[i] = emb
        else:
            rand = np.random.randn(64).astype(np.float32)
            Y_embeddings[i] = rand / np.linalg.norm(rand)

        # 8 angles
        for j_idx, j_name in enumerate(JOINTS):
            angles_matrix[i, j_idx] = float(angles.get(j_name, 90.0))

        # Local image filename
        local_path = d.get('localImagePath', '')
        local_file = os.path.basename(local_path) if local_path else ''
        has_local_image = local_file in available_images

        framing = determine_framing(kps)
        cat = d.get('category', 'General')
        categories_set.add(cat)
        category_counts[cat] = category_counts.get(cat, 0) + 1

        kps_compact = [
            [round(p['x'], 3), round(p['y'], 3), round(p.get('visibility', 1.0), 2)]
            for p in kps
        ]

        svg_thumb = generate_svg_thumbnail(kps, d.get('name', 'Pose'))

        compact_entry = {
            "id": d['id'],
            "name": d['name'],
            "category": cat,
            "difficulty": 'beginner' if d.get('difficulty') == 'Easy' else 'intermediate',
            "framing": framing,
            "image": local_file if has_local_image else "",
            "imageUrl": d.get('imageUrl', ''),
            "angles": {k: round(v, 1) for k, v in angles.items()},
            "keypoints": kps_compact,
            "thumbnail": svg_thumb,
            "hasLocalImage": has_local_image,
            "personCount": determine_person_count(cat, d.get('name', 'Pose'))
        }
        compact_entries.append(compact_entry)

    print(f"Extracted {len(categories_set)} categories. Saving binary feature buffers...")

    with open('data/pose_features.bin', 'wb') as f:
        f.write(X_features.tobytes())
    with open('public/data/pose_features.bin', 'wb') as f:
        f.write(X_features.tobytes())

    with open('data/pose_embeddings.bin', 'wb') as f:
        f.write(Y_embeddings.tobytes())
    with open('public/data/pose_embeddings.bin', 'wb') as f:
        f.write(Y_embeddings.tobytes())

    with open('data/pose_angles.bin', 'wb') as f:
        f.write(angles_matrix.tobytes())
    with open('public/data/pose_angles.bin', 'wb') as f:
        f.write(angles_matrix.tobytes())

    print("[3/5] Saving data/reference_dataset.json...")
    with open('data/reference_dataset.json', 'w', encoding='utf-8') as f:
        json.dump(compact_entries, f, separators=(',', ':'))
    with open('public/data/reference_dataset.json', 'w', encoding='utf-8') as f:
        json.dump(compact_entries, f, separators=(',', ':'))

    with open('data/pose_categories.json', 'w', encoding='utf-8') as f:
        json.dump({
            "categories": sorted(list(categories_set)),
            "counts": category_counts,
            "totalPoses": N
        }, f, indent=2)

    print("[4/5] Training Pose Predictor Neural Network (74 -> 128 -> 96 -> 64)...")
    X_train, X_val, Y_train, Y_val = train_test_split(X_features, Y_embeddings, test_size=0.1, random_state=42)

    mlp = MLPRegressor(
        hidden_layer_sizes=(128, 96),
        activation='relu',
        solver='adam',
        alpha=0.0001,
        batch_size=64,
        learning_rate_init=0.002,
        max_iter=45,
        early_stopping=True,
        validation_fraction=0.1,
        random_state=42,
        verbose=True
    )
    mlp.fit(X_train, Y_train)

    val_preds = mlp.predict(X_val)
    val_mse = mean_squared_error(Y_val, val_preds)
    print(f"Validation MSE: {val_mse:.6f}")

    print("[5/5] Exporting model weights to JSON...")
    model_export = {
        "architecture": {
            "inputDim": 74,
            "hiddenDims": [128, 96],
            "outputDim": 64,
            "activation": "relu"
        },
        "layers": [
            {
                "weights": mlp.coefs_[0].tolist(),
                "biases": mlp.intercepts_[0].tolist()
            },
            {
                "weights": mlp.coefs_[1].tolist(),
                "biases": mlp.intercepts_[1].tolist()
            },
            {
                "weights": mlp.coefs_[2].tolist(),
                "biases": mlp.intercepts_[2].tolist()
            }
        ],
        "metrics": {
            "valMSE": float(val_mse),
            "totalPoses": N
        }
    }

    model_json_path = 'public/models/pose_recommender/model_weights.json'
    with open(model_json_path, 'w', encoding='utf-8') as f:
        json.dump(model_export, f)

    with open('data/pose_recommender_weights.json', 'w', encoding='utf-8') as f:
        json.dump(model_export, f)

    print(f"Successfully exported trained model weights to {model_json_path}")
    print("Training and dataset export complete!")

if __name__ == '__main__':
    main()
