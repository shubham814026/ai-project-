"""
tools/dataset/generate_seed_poses.py - Author 11 Seed Reference Poses with SVG thumbnails and schema compliance.
Strictly adheres to A8 ReferencePose schema.
"""
import os
import json

def generate_svg_thumbnail(landmarks, pose_name, width=200, height=260):
    """
    Generate a clean vector SVG thumbnail for a reference pose skeleton.
    Using project design colors:
    Background: Dark Moss #16382D
    Skeleton lines: Antique Brass #C5A059 (dashed/solid)
    Joints: Mint Cyan #5EEAD4
    Text: Soft Off-White #F4F6F4
    """
    connections = [
        (0, 1), (0, 4), (1, 2), (2, 3), (4, 5), (5, 6), # face
        (11, 12), (11, 13), (13, 15), (12, 14), (14, 16), # arms
        (11, 23), (12, 24), (23, 24), # torso
        (23, 25), (25, 27), (24, 26), (26, 28) # legs
    ]

    # Map normalized [0, 1] coordinates to SVG viewbox with margin
    pad_x = 24
    pad_y = 36
    draw_w = width - 2 * pad_x
    draw_h = height - pad_y - 48

    def pt(idx):
        if idx < len(landmarks):
            lm = landmarks[idx]
            x = pad_x + lm['x'] * draw_w
            y = pad_y + lm['y'] * draw_h
            return x, y
        return 0, 0

    lines_svg = []
    # Draw connections
    for p1, p2 in connections:
        if p1 < len(landmarks) and p2 < len(landmarks):
            lm1, lm2 = landmarks[p1], landmarks[p2]
            if lm1.get('visibility', 1.0) > 0.4 and lm2.get('visibility', 1.0) > 0.4:
                x1, y1 = pt(p1)
                x2, y2 = pt(p2)
                lines_svg.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="#C5A059" stroke-width="2.5" stroke-linecap="round" opacity="0.85" />')

    # Draw key joints
    joints_svg = []
    key_joints = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]
    for j in key_joints:
        if j < len(landmarks) and landmarks[j].get('visibility', 1.0) > 0.4:
            x, y = pt(j)
            radius = 3.5 if j not in (15, 16, 27, 28) else 4.0
            color = "#5EEAD4" if j in (15, 16) else "#F4F6F4"
            joints_svg.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{radius}" fill="{color}" stroke="#0F251E" stroke-width="1.2" />')

    # Header and label
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="100%" height="100%" style="background:#16382D;border-radius:12px;">
  <rect width="{width}" height="{height}" rx="12" fill="#16382D" stroke="rgba(244,246,244,0.12)" stroke-width="1"/>
  <g class="skeleton">
    {''.join(lines_svg)}
    {''.join(joints_svg)}
  </g>
  <text x="{width/2:.1f}" y="{height - 14}" text-anchor="middle" fill="#F4F6F4" font-family="Inter, sans-serif" font-size="11" font-weight="500" letter-spacing="0.2">{pose_name}</text>
</svg>'''
    return svg

def build_seed_poses():
    # Helper to build a standard default 33-landmark skeleton with adjustments
    def make_skeleton(overrides=None):
        base = [
            # 0-10: Face
            {"x": 0.50, "y": 0.12, "visibility": 0.95}, # 0 nose
            {"x": 0.48, "y": 0.10, "visibility": 0.9},  # 1 left_eye_inner
            {"x": 0.47, "y": 0.10, "visibility": 0.9},  # 2 left_eye
            {"x": 0.46, "y": 0.10, "visibility": 0.9},  # 3 left_eye_outer
            {"x": 0.52, "y": 0.10, "visibility": 0.9},  # 4 right_eye_inner
            {"x": 0.53, "y": 0.10, "visibility": 0.9},  # 5 right_eye
            {"x": 0.54, "y": 0.10, "visibility": 0.9},  # 6 right_eye_outer
            {"x": 0.44, "y": 0.12, "visibility": 0.85}, # 7 left_ear
            {"x": 0.56, "y": 0.12, "visibility": 0.85}, # 8 right_ear
            {"x": 0.48, "y": 0.15, "visibility": 0.9},  # 9 mouth_left
            {"x": 0.52, "y": 0.15, "visibility": 0.9},  # 10 mouth_right
            # 11-16: Shoulders & Arms
            {"x": 0.40, "y": 0.24, "visibility": 0.99}, # 11 left_shoulder
            {"x": 0.60, "y": 0.24, "visibility": 0.99}, # 12 right_shoulder
            {"x": 0.36, "y": 0.38, "visibility": 0.98}, # 13 left_elbow
            {"x": 0.64, "y": 0.38, "visibility": 0.98}, # 14 right_elbow
            {"x": 0.35, "y": 0.52, "visibility": 0.98}, # 15 left_wrist
            {"x": 0.65, "y": 0.52, "visibility": 0.98}, # 16 right_wrist
            {"x": 0.34, "y": 0.54, "visibility": 0.9},  # 17 left_pinky
            {"x": 0.66, "y": 0.54, "visibility": 0.9},  # 18 right_pinky
            {"x": 0.34, "y": 0.55, "visibility": 0.9},  # 19 left_index
            {"x": 0.66, "y": 0.55, "visibility": 0.9},  # 20 right_index
            {"x": 0.35, "y": 0.53, "visibility": 0.9},  # 21 left_thumb
            {"x": 0.65, "y": 0.53, "visibility": 0.9},  # 22 right_thumb
            # 23-28: Hips & Legs
            {"x": 0.43, "y": 0.52, "visibility": 0.98}, # 23 left_hip
            {"x": 0.57, "y": 0.52, "visibility": 0.98}, # 24 right_hip
            {"x": 0.43, "y": 0.72, "visibility": 0.96}, # 25 left_knee
            {"x": 0.57, "y": 0.72, "visibility": 0.96}, # 26 right_knee
            {"x": 0.43, "y": 0.92, "visibility": 0.95}, # 27 left_ankle
            {"x": 0.57, "y": 0.92, "visibility": 0.95}, # 28 right_ankle
            {"x": 0.42, "y": 0.95, "visibility": 0.9},  # 29 left_heel
            {"x": 0.58, "y": 0.95, "visibility": 0.9},  # 30 right_heel
            {"x": 0.43, "y": 0.96, "visibility": 0.9},  # 31 left_foot_index
            {"x": 0.57, "y": 0.96, "visibility": 0.9},  # 32 right_foot_index
        ]
        if overrides:
            for idx, vals in overrides.items():
                base[idx].update(vals)
        return base

    poses = [
        # 1. Stand Naturally
        {
            "id": "stand-naturally",
            "name": "Stand Naturally",
            "category": "Standing",
            "tags": ["posture", "baseline", "standing", "neutral"],
            "difficulty": "beginner",
            "framing": "full-body",
            "description": "Upright, relaxed posture with arms hanging comfortably at sides, shoulders level and feet hip-width apart.",
            "instructions": [
                "Keep shoulders level and relaxed",
                "Arms rest naturally at your sides",
                "Distribute weight evenly on both feet"
            ],
            "requiredLandmarks": [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28],
            "features": [
                {"id": "shoulder_level", "kind": "tilt", "landmarks": [11, 12], "target": 0.0, "tolerance": 5.0, "weight": 2.0, "critical": True},
                {"id": "hip_level", "kind": "tilt", "landmarks": [23, 24], "target": 0.0, "tolerance": 5.0, "weight": 1.5},
                {"id": "left_arm_extension", "kind": "angle", "landmarks": [11, 13, 15], "target": 168.0, "tolerance": 15.0, "weight": 1.0},
                {"id": "right_arm_extension", "kind": "angle", "landmarks": [12, 14, 16], "target": 168.0, "tolerance": 15.0, "weight": 1.0},
                {"id": "left_knee_straight", "kind": "angle", "landmarks": [23, 25, 27], "target": 175.0, "tolerance": 10.0, "weight": 1.0},
                {"id": "right_knee_straight", "kind": "angle", "landmarks": [24, 26, 28], "target": 175.0, "tolerance": 10.0, "weight": 1.0}
            ],
            "landmarks": make_skeleton(),
            "mirrorAllowed": True,
            "source": "authored",
            "reviewed": False
        },
        # 2. Hands on Hips
        {
            "id": "hands-on-hips",
            "name": "Hands on Hips",
            "category": "Confident",
            "tags": ["confident", "standing", "waist", "classic"],
            "difficulty": "beginner",
            "framing": "either",
            "description": "Empowered, confident stance with both hands placed on hips/waist and elbows flared outwards.",
            "instructions": [
                "Place both hands firmly on your hips",
                "Flare elbows outward symmetrically",
                "Keep chest upright and shoulders level"
            ],
            "requiredLandmarks": [11, 12, 13, 14, 15, 16, 23, 24],
            "features": [
                {"id": "left_elbow_bend", "kind": "angle", "landmarks": [11, 13, 15], "target": 88.0, "tolerance": 14.0, "weight": 2.0, "critical": True},
                {"id": "right_elbow_bend", "kind": "angle", "landmarks": [12, 14, 16], "target": 88.0, "tolerance": 14.0, "weight": 2.0, "critical": True},
                {"id": "left_hand_to_hip", "kind": "distance", "landmarks": [15, 23], "target": 0.08, "tolerance": 0.12, "weight": 2.0, "critical": True},
                {"id": "right_hand_to_hip", "kind": "distance", "landmarks": [16, 24], "target": 0.08, "tolerance": 0.12, "weight": 2.0, "critical": True},
                {"id": "shoulder_level", "kind": "tilt", "landmarks": [11, 12], "target": 0.0, "tolerance": 6.0, "weight": 1.0}
            ],
            "landmarks": make_skeleton({
                13: {"x": 0.28, "y": 0.38}, 14: {"x": 0.72, "y": 0.38},
                15: {"x": 0.40, "y": 0.50}, 16: {"x": 0.60, "y": 0.50}
            }),
            "mirrorAllowed": True,
            "source": "authored",
            "reviewed": False
        },
        # 3. Arms Crossed
        {
            "id": "arms-crossed",
            "name": "Arms Crossed",
            "category": "Studio Portrait",
            "tags": ["business", "portrait", "upper-body", "casual"],
            "difficulty": "beginner",
            "framing": "upper-body",
            "description": "Classic executive fold across chest with forearms balanced and shoulders broad.",
            "instructions": [
                "Cross both arms across your lower chest",
                "Rest hands against opposite upper arms",
                "Keep shoulders relaxed and squared"
            ],
            "requiredLandmarks": [11, 12, 13, 14, 15, 16],
            "features": [
                {"id": "left_elbow_fold", "kind": "angle", "landmarks": [11, 13, 15], "target": 65.0, "tolerance": 15.0, "weight": 2.0, "critical": True},
                {"id": "right_elbow_fold", "kind": "angle", "landmarks": [12, 14, 16], "target": 65.0, "tolerance": 15.0, "weight": 2.0, "critical": True},
                {"id": "left_wrist_chest", "kind": "distance", "landmarks": [15, 12], "target": 0.30, "tolerance": 0.15, "weight": 1.5},
                {"id": "right_wrist_chest", "kind": "distance", "landmarks": [16, 11], "target": 0.30, "tolerance": 0.15, "weight": 1.5},
                {"id": "shoulder_tilt", "kind": "tilt", "landmarks": [11, 12], "target": 0.0, "tolerance": 6.0, "weight": 1.0}
            ],
            "landmarks": make_skeleton({
                13: {"x": 0.32, "y": 0.36}, 14: {"x": 0.68, "y": 0.36},
                15: {"x": 0.55, "y": 0.36}, 16: {"x": 0.45, "y": 0.38}
            }),
            "mirrorAllowed": True,
            "source": "authored",
            "reviewed": False
        },
        # 4. Arms Raised (V)
        {
            "id": "arms-raised-v",
            "name": "Arms Raised (V)",
            "category": "Celebration",
            "tags": ["celebration", "victory", "energy", "fitness"],
            "difficulty": "intermediate",
            "framing": "either",
            "description": "Dynamic overhead victory pose with both arms extended upwards in an expansive V formation.",
            "instructions": [
                "Raise both arms overhead into a high V",
                "Keep elbows straight and fingers open",
                "Stand tall with torso aligned"
            ],
            "requiredLandmarks": [11, 12, 13, 14, 15, 16, 23, 24],
            "features": [
                {"id": "left_arm_elevation", "kind": "angle", "landmarks": [23, 11, 13], "target": 140.0, "tolerance": 15.0, "weight": 2.0, "critical": True},
                {"id": "right_arm_elevation", "kind": "angle", "landmarks": [24, 12, 14], "target": 140.0, "tolerance": 15.0, "weight": 2.0, "critical": True},
                {"id": "left_elbow_straight", "kind": "angle", "landmarks": [11, 13, 15], "target": 170.0, "tolerance": 15.0, "weight": 1.5},
                {"id": "right_elbow_straight", "kind": "angle", "landmarks": [12, 14, 16], "target": 170.0, "tolerance": 15.0, "weight": 1.5}
            ],
            "landmarks": make_skeleton({
                13: {"x": 0.28, "y": 0.14}, 14: {"x": 0.72, "y": 0.14},
                15: {"x": 0.20, "y": 0.04}, 16: {"x": 0.80, "y": 0.04}
            }),
            "mirrorAllowed": True,
            "source": "authored",
            "reviewed": False
        },
        # 5. One-Hand Wave
        {
            "id": "one-hand-wave",
            "name": "One-Hand Wave",
            "category": "Greeting",
            "tags": ["greeting", "friendly", "wave", "casual"],
            "difficulty": "beginner",
            "framing": "upper-body",
            "description": "Warm, engaging greeting with right hand raised beside the head in an open wave.",
            "instructions": [
                "Raise right hand beside head to wave",
                "Bend right elbow at roughly 90 degrees",
                "Rest left arm comfortably at your side"
            ],
            "requiredLandmarks": [11, 12, 13, 14, 15, 16],
            "features": [
                {"id": "right_elbow_angle", "kind": "angle", "landmarks": [12, 14, 16], "target": 90.0, "tolerance": 16.0, "weight": 2.0, "critical": True},
                {"id": "right_hand_height", "kind": "position", "landmarks": [16], "target": 0.12, "tolerance": 0.14, "weight": 2.0, "critical": True},
                {"id": "left_arm_down", "kind": "angle", "landmarks": [11, 13, 15], "target": 165.0, "tolerance": 16.0, "weight": 1.0}
            ],
            "landmarks": make_skeleton({
                14: {"x": 0.68, "y": 0.22},
                16: {"x": 0.70, "y": 0.10}
            }),
            "mirrorAllowed": True,
            "source": "authored",
            "reviewed": False
        },
        # 6. Shoulders Angled Portrait
        {
            "id": "shoulders-angled",
            "name": "Shoulders Angled Portrait",
            "category": "Portrait",
            "tags": ["portrait", "editorial", "angle", "headshot"],
            "difficulty": "beginner",
            "framing": "upper-body",
            "description": "Slimming portrait posture with torso turned at a 30-degree angle while head faces camera.",
            "instructions": [
                "Turn torso 30 degrees to your side",
                "Turn head forward facing the camera directly",
                "Maintain upright spine posture"
            ],
            "requiredLandmarks": [0, 11, 12, 23, 24],
            "features": [
                {"id": "shoulder_yaw_proxy", "kind": "distance", "landmarks": [11, 12], "target": 0.15, "tolerance": 0.08, "weight": 2.0, "critical": True},
                {"id": "head_level", "kind": "tilt", "landmarks": [0, 11], "target": 0.0, "tolerance": 8.0, "weight": 1.0}
            ],
            "landmarks": make_skeleton({
                0: {"x": 0.50, "y": 0.12},
                11: {"x": 0.44, "y": 0.24}, 12: {"x": 0.58, "y": 0.26},
                13: {"x": 0.42, "y": 0.38}, 14: {"x": 0.60, "y": 0.40},
                15: {"x": 0.42, "y": 0.52}, 16: {"x": 0.60, "y": 0.54}
            }),
            "mirrorAllowed": True,
            "source": "authored",
            "reviewed": False
        },
        # 7. Hand Near Chin
        {
            "id": "hand-near-chin",
            "name": "Hand Near Chin",
            "category": "Thoughtful",
            "tags": ["thoughtful", "editorial", "chin", "thinker"],
            "difficulty": "intermediate",
            "framing": "upper-body",
            "description": "Contemplative editorial pose with one hand lightly touching or gesturing near jawline.",
            "instructions": [
                "Bring right hand lightly toward your chin/jaw",
                "Keep elbow tucked close to your torso",
                "Relax your neck and shoulders"
            ],
            "requiredLandmarks": [0, 11, 12, 14, 16],
            "features": [
                {"id": "hand_to_chin_distance", "kind": "distance", "landmarks": [16, 0], "target": 0.10, "tolerance": 0.09, "weight": 2.0, "critical": True},
                {"id": "right_elbow_flex", "kind": "angle", "landmarks": [12, 14, 16], "target": 55.0, "tolerance": 15.0, "weight": 1.5},
                {"id": "left_arm_relaxed", "kind": "angle", "landmarks": [11, 13, 15], "target": 165.0, "tolerance": 16.0, "weight": 1.0}
            ],
            "landmarks": make_skeleton({
                14: {"x": 0.62, "y": 0.32},
                16: {"x": 0.54, "y": 0.16}
            }),
            "mirrorAllowed": True,
            "source": "authored",
            "reviewed": False
        },
        # 8. Weight Shift
        {
            "id": "weight-shift",
            "name": "Weight Shift",
            "category": "Fashion",
            "tags": ["fashion", "full-body", "casual", "dynamic"],
            "difficulty": "intermediate",
            "framing": "full-body",
            "description": "Casual fashion stance with body weight shifted onto one support leg and slight hip angle.",
            "instructions": [
                "Shift body weight firmly onto right leg",
                "Allow left knee to soften slightly",
                "Drop left hip slightly for natural stance"
            ],
            "requiredLandmarks": [11, 12, 23, 24, 25, 26, 27, 28],
            "features": [
                {"id": "hip_tilt", "kind": "tilt", "landmarks": [23, 24], "target": 6.0, "tolerance": 4.0, "weight": 2.0, "critical": True},
                {"id": "right_support_leg", "kind": "angle", "landmarks": [24, 26, 28], "target": 178.0, "tolerance": 8.0, "weight": 1.5},
                {"id": "left_relaxed_knee", "kind": "angle", "landmarks": [23, 25, 27], "target": 160.0, "tolerance": 12.0, "weight": 1.5}
            ],
            "landmarks": make_skeleton({
                23: {"x": 0.43, "y": 0.53}, 24: {"x": 0.57, "y": 0.50},
                25: {"x": 0.41, "y": 0.72}, 26: {"x": 0.58, "y": 0.71},
                27: {"x": 0.40, "y": 0.92}, 28: {"x": 0.58, "y": 0.92}
            }),
            "mirrorAllowed": True,
            "source": "authored",
            "reviewed": False
        },
        # 9. Side-Facing Profile
        {
            "id": "side-facing",
            "name": "Side-Facing Profile",
            "category": "Fitness / Form",
            "tags": ["side-profile", "form", "fitness", "alignment"],
            "difficulty": "intermediate",
            "framing": "either",
            "experimental": True,
            "description": "Sagittal alignment view showing spinal curve and lateral posture. Experimental due to 2D self-occlusion.",
            "instructions": [
                "Turn 90 degrees to face sideways",
                "Stand tall with spine erect",
                "Keep hands resting along outer thigh"
            ],
            "requiredLandmarks": [12, 14, 16, 24, 26, 28],
            "features": [
                {"id": "lateral_spine_align", "kind": "angle", "landmarks": [12, 24, 26], "target": 175.0, "tolerance": 10.0, "weight": 2.0, "critical": True},
                {"id": "knee_alignment", "kind": "angle", "landmarks": [24, 26, 28], "target": 176.0, "tolerance": 10.0, "weight": 1.5}
            ],
            "landmarks": make_skeleton({
                0: {"x": 0.58, "y": 0.12},
                11: {"x": 0.48, "y": 0.24, "visibility": 0.3},
                12: {"x": 0.50, "y": 0.24, "visibility": 0.98},
                13: {"x": 0.48, "y": 0.38, "visibility": 0.3},
                14: {"x": 0.52, "y": 0.38, "visibility": 0.98},
                15: {"x": 0.48, "y": 0.52, "visibility": 0.3},
                16: {"x": 0.53, "y": 0.52, "visibility": 0.98},
                23: {"x": 0.48, "y": 0.52, "visibility": 0.3},
                24: {"x": 0.50, "y": 0.52, "visibility": 0.98},
                25: {"x": 0.48, "y": 0.72, "visibility": 0.3},
                26: {"x": 0.51, "y": 0.72, "visibility": 0.96},
                27: {"x": 0.48, "y": 0.92, "visibility": 0.3},
                28: {"x": 0.52, "y": 0.92, "visibility": 0.95}
            }),
            "mirrorAllowed": False,
            "source": "authored",
            "reviewed": False
        },
        # 10. Seated Relaxed
        {
            "id": "seated-relaxed",
            "name": "Seated Relaxed",
            "category": "Seated",
            "tags": ["seated", "desk", "relaxed", "interview"],
            "difficulty": "intermediate",
            "framing": "upper-body",
            "experimental": True,
            "description": "Ergonomic seated position with back supported and hands resting forward. Experimental for desk cams.",
            "instructions": [
                "Sit upright with back straight",
                "Rest hands gently on thighs or desk",
                "Keep shoulders level and relaxed"
            ],
            "requiredLandmarks": [11, 12, 13, 14, 15, 16, 23, 24],
            "features": [
                {"id": "torso_upright", "kind": "tilt", "landmarks": [11, 23], "target": 90.0, "tolerance": 8.0, "weight": 2.0, "critical": True},
                {"id": "shoulder_level", "kind": "tilt", "landmarks": [11, 12], "target": 0.0, "tolerance": 5.0, "weight": 1.5},
                {"id": "hands_forward", "kind": "angle", "landmarks": [11, 13, 15], "target": 110.0, "tolerance": 18.0, "weight": 1.0}
            ],
            "landmarks": make_skeleton({
                13: {"x": 0.36, "y": 0.40}, 14: {"x": 0.64, "y": 0.40},
                15: {"x": 0.40, "y": 0.52}, 16: {"x": 0.60, "y": 0.52},
                23: {"x": 0.43, "y": 0.58}, 24: {"x": 0.57, "y": 0.58},
                25: {"x": 0.41, "y": 0.70}, 26: {"x": 0.59, "y": 0.70},
                27: {"x": 0.41, "y": 0.88}, 28: {"x": 0.59, "y": 0.88}
            }),
            "mirrorAllowed": True,
            "source": "authored",
            "reviewed": False
        },
        # 11. Warrior Pose
        {
            "id": "warrior-two-pose",
            "name": "Warrior Pose",
            "category": "Yoga / Athletic",
            "tags": ["yoga", "athletic", "warrior", "full-body"],
            "difficulty": "advanced",
            "framing": "full-body",
            "description": "Strong athletic warrior stance with arms stretched horizontally, lead knee bent, and wide base.",
            "instructions": [
                "Stretch both arms parallel to the floor",
                "Bend front knee toward 90 degrees",
                "Keep back leg straight and torso upright"
            ],
            "requiredLandmarks": [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28],
            "features": [
                {"id": "arms_horizontal", "kind": "tilt", "landmarks": [15, 16], "target": 0.0, "tolerance": 8.0, "weight": 2.0, "critical": True},
                {"id": "front_knee_bend", "kind": "angle", "landmarks": [23, 25, 27], "target": 110.0, "tolerance": 15.0, "weight": 2.0, "critical": True},
                {"id": "back_leg_straight", "kind": "angle", "landmarks": [24, 26, 28], "target": 172.0, "tolerance": 10.0, "weight": 1.5}
            ],
            "landmarks": make_skeleton({
                11: {"x": 0.42, "y": 0.26}, 12: {"x": 0.58, "y": 0.26},
                13: {"x": 0.26, "y": 0.26}, 14: {"x": 0.74, "y": 0.26},
                15: {"x": 0.12, "y": 0.26}, 16: {"x": 0.88, "y": 0.26},
                23: {"x": 0.44, "y": 0.54}, 24: {"x": 0.56, "y": 0.54},
                25: {"x": 0.34, "y": 0.70}, 26: {"x": 0.68, "y": 0.70},
                27: {"x": 0.34, "y": 0.90}, 28: {"x": 0.78, "y": 0.90}
            }),
            "mirrorAllowed": True,
            "source": "authored",
            "reviewed": False
        }
    ]

    # Calibrate feature targets to exact authored geometry so reference pose self-score is 100%
    for p in poses:
        lms = p["landmarks"]
        for f in p["features"]:
            kind = f["kind"]
            indices = f["landmarks"]
            if kind == "angle" and len(indices) >= 3:
                a, b, c = lms[indices[0]], lms[indices[1]], lms[indices[2]]
                ab = (a["x"] - b["x"], a["y"] - b["y"])
                cb = (c["x"] - b["x"], c["y"] - b["y"])
                dot = ab[0] * cb[0] + ab[1] * cb[1]
                mag_ab = (ab[0]**2 + ab[1]**2)**0.5
                mag_cb = (cb[0]**2 + cb[1]**2)**0.5
                if mag_ab > 0 and mag_cb > 0:
                    cos_val = max(-1.0, min(1.0, dot / (mag_ab * mag_cb)))
                    import math
                    ang = math.acos(cos_val) * 180.0 / math.pi
                    f["target"] = round(ang, 1)
            elif kind == "tilt" and len(indices) >= 2:
                p1, p2 = lms[indices[0]], lms[indices[1]]
                dy = p2["y"] - p1["y"]
                dx = p2["x"] - p1["x"]
                import math
                ang = math.atan2(dy, dx) * 180.0 / math.pi
                if ang > 90: ang -= 180
                if ang < -90: ang += 180
                f["target"] = round(abs(ang), 1)
            elif kind == "distance" and len(indices) >= 2:
                # Torso-normalized distance
                p1, p2 = lms[indices[0]], lms[indices[1]]
                # Torso length (mid-shoulder to mid-hip)
                ms = ((lms[11]["x"] + lms[12]["x"]) / 2, (lms[11]["y"] + lms[12]["y"]) / 2)
                mh = ((lms[23]["x"] + lms[24]["x"]) / 2, (lms[23]["y"] + lms[24]["y"]) / 2)
                torso_len = ((ms[0] - mh[0])**2 + (ms[1] - mh[1])**2)**0.5
                dist_raw = ((p1["x"] - p2["x"])**2 + (p1["y"] - p2["y"])**2)**0.5
                f["target"] = round(dist_raw / max(1e-4, torso_len), 2)
            elif kind == "position" and len(indices) >= 1:
                f["target"] = round(lms[indices[0]]["y"], 2)

        svg_content = generate_svg_thumbnail(p["landmarks"], p["name"])
        p["thumbnail"] = svg_content

    return poses

if __name__ == '__main__':
    poses = build_seed_poses()
    os.makedirs('data', exist_ok=True)
    with open('data/seed_poses.json', 'w', encoding='utf-8') as f:
        json.dump(poses, f, indent=2)
    print(f"Generated {len(poses)} seed poses in data/seed_poses.json")
