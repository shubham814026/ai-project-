const fs = require('fs');
const path = require('path');

const poses = JSON.parse(fs.readFileSync('data/seed_poses.json', 'utf8'));

// Helper geometry functions to guarantee 100% mathematical consistency
function calcAngle(p1, p2, p3) {
  const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
  const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
  return (Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * 180) / Math.PI;
}

function calcDist(p1, p2) {
  return Math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2);
}

// Standard MediaPipe Upper Body connections for SVG thumbnail rendering
const CONNECTIONS = [
  [11, 12], // shoulders
  [11, 13], [13, 15], // left arm
  [12, 14], [14, 16], // right arm
  [11, 23], [12, 24], // torso sides
  [23, 24], // hips
  [0, 11], [0, 12], // neck/head
];

function generateThumbnail(name, landmarks) {
  const w = 200;
  const h = 260;
  let lines = '';
  let circles = '';

  for (const [i1, i2] of CONNECTIONS) {
    const p1 = landmarks[i1];
    const p2 = landmarks[i2];
    if (p1 && p2 && p1.visibility > 0.4 && p2.visibility > 0.4) {
      const x1 = (p1.x * w).toFixed(1);
      const y1 = (p1.y * h).toFixed(1);
      const x2 = (p2.x * w).toFixed(1);
      const y2 = (p2.y * h).toFixed(1);
      lines += `    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#C5A059" stroke-width="2.5" stroke-linecap="round" opacity="0.85" />\n`;
    }
  }

  // Draw key joints: 0 (head), 11, 12 (shoulders), 13, 14 (elbows), 15, 16 (wrists)
  const keyJoints = [0, 11, 12, 13, 14, 15, 16, 23, 24];
  for (const idx of keyJoints) {
    const lm = landmarks[idx];
    if (lm && lm.visibility > 0.4) {
      const cx = (lm.x * w).toFixed(1);
      const cy = (lm.y * h).toFixed(1);
      const isHand = idx === 15 || idx === 16;
      const fill = isHand ? '#5EEAD4' : '#F4F6F4';
      const r = isHand ? '4.0' : '3.5';
      circles += `    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="#0F251E" stroke-width="1.2" />\n`;
    }
  }

  const shortName = name.split('/')[0].trim();

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%" style="background:#16382D;border-radius:12px;">
  <rect width="${w}" height="${h}" rx="12" fill="#16382D" stroke="rgba(244,246,244,0.12)" stroke-width="1"/>
  <g class="skeleton">
${lines}${circles}  </g>
  <text x="100.0" y="246" text-anchor="middle" fill="#F4F6F4" font-family="Inter, sans-serif" font-size="11" font-weight="500" letter-spacing="0.2">${shortName}</text>
</svg>`;
}

// 1. Upright Streamer & Creator Ergonomics (Pose 0 - Default!)
const seatedRelaxed = poses.find(p => p.id === 'seated-relaxed');
seatedRelaxed.name = "Upright Streamer & Creator Ergonomics";
seatedRelaxed.category = "Streaming / Ergonomics";
seatedRelaxed.framing = "upper-body";
seatedRelaxed.description = "The foundational studio stance: upright spine, level shoulders, and balanced neck posture for long recording sessions and desk streams.";
seatedRelaxed.requiredLandmarks = [11, 12]; // Upper-body desk ergonomic posture strictly requires shoulders
seatedRelaxed.instructions = [
  "Sit upright with spine comfortably straight",
  "Keep both shoulders relaxed and horizontally level",
  "Rest arms naturally on armrests or desk"
];
// Natural desk resting posture: elbows resting near sides, forearms forward on armrests/desk
seatedRelaxed.landmarks[13] = { x: 0.38, y: 0.40, visibility: 0.98 };
seatedRelaxed.landmarks[14] = { x: 0.62, y: 0.40, visibility: 0.98 };
seatedRelaxed.landmarks[15] = { x: 0.45, y: 0.46, visibility: 0.98 };
seatedRelaxed.landmarks[16] = { x: 0.55, y: 0.46, visibility: 0.98 };
const elSeatedAngle = Math.round(calcAngle(seatedRelaxed.landmarks[11], seatedRelaxed.landmarks[13], seatedRelaxed.landmarks[15]));
seatedRelaxed.features = [
  {
    id: "shoulder_level",
    kind: "tilt",
    landmarks: [11, 12],
    target: 0.0,
    tolerance: 9.0,
    weight: 2.0,
    critical: true
  },
  {
    id: "spine_vertical_alignment",
    kind: "tilt",
    landmarks: [0, 11, 12],
    target: 0.0,
    tolerance: 7.0,
    weight: 2.0,
    critical: true
  },
  {
    id: "head_level",
    kind: "tilt",
    landmarks: [2, 5],
    target: 0.0,
    tolerance: 8.0,
    weight: 1.5
  },
  {
    id: "left_elbow_relaxed",
    kind: "angle",
    landmarks: [11, 13, 15],
    target: elSeatedAngle,
    tolerance: 35.0,
    weight: 1.0
  },
  {
    id: "right_elbow_relaxed",
    kind: "angle",
    landmarks: [12, 14, 16],
    target: elSeatedAngle,
    tolerance: 35.0,
    weight: 1.0
  }
];

// 2. Podcaster Core Anchor / Level & Upright
const standNaturally = poses.find(p => p.id === 'stand-naturally');
standNaturally.name = "Podcaster Core Anchor / Level & Upright";
standNaturally.category = "Podcasting";
standNaturally.framing = "upper-body";
standNaturally.description = "Core studio anchor: level shoulders, tall upright spine, and neutral neck posture for recording or streaming.";
standNaturally.requiredLandmarks = [11, 12]; // Wrists & elbows optional for desk anchor
standNaturally.instructions = [
  "Sit tall with spine aligned and chest open",
  "Keep both shoulders level and relaxed",
  "Rest arms comfortably on desk or chair armrests"
];
standNaturally.landmarks[13] = { x: 0.37, y: 0.42, visibility: 0.98 };
standNaturally.landmarks[14] = { x: 0.63, y: 0.42, visibility: 0.98 };
standNaturally.landmarks[15] = { x: 0.41, y: 0.52, visibility: 0.98 };
standNaturally.landmarks[16] = { x: 0.59, y: 0.52, visibility: 0.98 };
const elStandAngle = Math.round(calcAngle(standNaturally.landmarks[11], standNaturally.landmarks[13], standNaturally.landmarks[15]));
standNaturally.features = [
  {
    id: "shoulder_level",
    kind: "tilt",
    landmarks: [11, 12],
    target: 0.0,
    tolerance: 9.0,
    weight: 2.0,
    critical: true
  },
  {
    id: "spine_vertical_alignment",
    kind: "tilt",
    landmarks: [0, 11, 12],
    target: 0.0,
    tolerance: 7.0,
    weight: 2.0,
    critical: true
  },
  {
    id: "head_level",
    kind: "tilt",
    landmarks: [2, 5],
    target: 0.0,
    tolerance: 8.0,
    weight: 1.5
  },
  {
    id: "left_elbow_relaxed",
    kind: "angle",
    landmarks: [11, 13, 15],
    target: elStandAngle,
    tolerance: 35.0,
    weight: 1.0
  },
  {
    id: "right_elbow_relaxed",
    kind: "angle",
    landmarks: [12, 14, 16],
    target: elStandAngle,
    tolerance: 35.0,
    weight: 1.0
  }
];

// 3. Confident Guest / Folded Arms Anchor
const armsCrossed = poses.find(p => p.id === 'arms-crossed');
armsCrossed.name = "Confident Guest / Folded Arms Anchor";
armsCrossed.category = "Podcasting";
armsCrossed.framing = "upper-body";
armsCrossed.description = "Classic interview posture: arms folded comfortably across chest with level, relaxed shoulders.";
armsCrossed.requiredLandmarks = [11, 12, 13, 14];
armsCrossed.features = [
  {
    id: "left_elbow_fold",
    kind: "angle",
    landmarks: [11, 13, 15],
    target: 60.0,
    tolerance: 35.0,
    weight: 2.0,
    critical: true
  },
  {
    id: "right_elbow_fold",
    kind: "angle",
    landmarks: [12, 14, 16],
    target: 60.0,
    tolerance: 35.0,
    weight: 2.0,
    critical: true
  },
  {
    id: "shoulder_tilt",
    kind: "tilt",
    landmarks: [11, 12],
    target: 0.0,
    tolerance: 10.0,
    weight: 1.0
  }
];

// 4. Thoughtful Host / Deep Thinker Reaction
const handNearChin = poses.find(p => p.id === 'hand-near-chin');
handNearChin.name = "Thoughtful Host / Deep Thinker Reaction";
handNearChin.category = "Podcasting";
handNearChin.framing = "upper-body";
handNearChin.requiredLandmarks = [11, 12, 14, 16];
// Natural hand near chin position
handNearChin.landmarks[14] = { x: 0.65, y: 0.35, visibility: 0.98 }; // right elbow
handNearChin.landmarks[16] = { x: 0.54, y: 0.17, visibility: 0.98 }; // right wrist near chin
const elChinAngle = Math.round(calcAngle(handNearChin.landmarks[12], handNearChin.landmarks[14], handNearChin.landmarks[16]));
handNearChin.features = [
  {
    id: "hand_to_chin_distance",
    kind: "distance",
    landmarks: [16, 0],
    target: 0.20,
    tolerance: 0.20,
    weight: 2.5,
    critical: true
  },
  {
    id: "right_elbow_flex",
    kind: "angle",
    landmarks: [12, 14, 16],
    target: elChinAngle,
    tolerance: 35.0,
    weight: 2.0,
    critical: true
  },
  {
    id: "left_arm_relaxed",
    kind: "angle",
    landmarks: [11, 13, 15],
    target: 165.0,
    tolerance: 40.0,
    weight: 1.0
  }
];

// 5. Multi-Camera Studio / 3/4 Interview Angle
const shouldersAngled = poses.find(p => p.id === 'shoulders-angled');
shouldersAngled.name = "Multi-Camera Studio / 3/4 Interview Angle";
shouldersAngled.category = "Podcasting";
shouldersAngled.framing = "upper-body";
shouldersAngled.requiredLandmarks = [11, 12];
shouldersAngled.features = [
  {
    id: "shoulder_yaw_proxy",
    kind: "distance",
    landmarks: [11, 12],
    target: 0.52,
    tolerance: 0.20,
    weight: 2.0,
    critical: true
  },
  {
    id: "head_level",
    kind: "tilt",
    landmarks: [2, 5],
    target: 0.0,
    tolerance: 10.0,
    weight: 1.5
  }
];

// 6. Executive Presence / Steepled Hands & Desk Frame
const handsOnHips = poses.find(p => p.id === 'hands-on-hips');
handsOnHips.name = "Executive Presence / Steepled Hands & Desk Frame";
handsOnHips.category = "Solo Creator";
handsOnHips.framing = "upper-body";
handsOnHips.description = "Authoritative host stance: elbows resting naturally on desk/armrests with hands steepled together in front of lower chest.";
handsOnHips.requiredLandmarks = [11, 12, 13, 14];
handsOnHips.instructions = [
  "Keep spine tall and shoulders level",
  "Rest elbows comfortably on desk or armrests",
  "Bring hands together steepled in lower chest frame"
];
// Move hands from hips to chest center
handsOnHips.landmarks[13] = { x: 0.36, y: 0.42, visibility: 0.98 }; // left elbow
handsOnHips.landmarks[14] = { x: 0.64, y: 0.42, visibility: 0.98 }; // right elbow
handsOnHips.landmarks[15] = { x: 0.46, y: 0.42, visibility: 0.95 }; // left wrist
handsOnHips.landmarks[16] = { x: 0.54, y: 0.42, visibility: 0.95 }; // right wrist
const elHipsAngle = Math.round(calcAngle(handsOnHips.landmarks[11], handsOnHips.landmarks[13], handsOnHips.landmarks[15]));
handsOnHips.features = [
  {
    id: "left_elbow_bend",
    kind: "angle",
    landmarks: [11, 13, 15],
    target: elHipsAngle,
    tolerance: 35.0,
    weight: 2.0
  },
  {
    id: "right_elbow_bend",
    kind: "angle",
    landmarks: [12, 14, 16],
    target: elHipsAngle,
    tolerance: 35.0,
    weight: 2.0
  },
  {
    id: "steepled_hands_proximity",
    kind: "distance",
    landmarks: [15, 16],
    target: 0.28,
    tolerance: 0.20,
    weight: 2.0,
    critical: true
  },
  {
    id: "shoulder_level",
    kind: "tilt",
    landmarks: [11, 12],
    target: 0.0,
    tolerance: 12.0,
    weight: 1.5
  }
];

// 7. Engaged Storyteller / Chest-Level Gestures (NO MORE JUMPING JACKS!)
const armsRaisedV = poses.find(p => p.id === 'arms-raised-v');
armsRaisedV.name = "Engaged Storyteller / Chest-Level Gestures";
armsRaisedV.category = "Solo Creator";
armsRaisedV.framing = "upper-body";
armsRaisedV.description = "Dynamic conversational storytelling: elbows bent near torso with open hands gesturing expressively in front of chest.";
armsRaisedV.requiredLandmarks = [11, 12, 13, 14];
armsRaisedV.instructions = [
  "Keep shoulders relaxed and level",
  "Bend elbows comfortably at lower rib level",
  "Hold hands open in front of chest as you speak"
];
armsRaisedV.landmarks[13] = { x: 0.35, y: 0.40, visibility: 0.98 }; // left elbow
armsRaisedV.landmarks[14] = { x: 0.65, y: 0.40, visibility: 0.98 }; // right elbow
armsRaisedV.landmarks[15] = { x: 0.42, y: 0.36, visibility: 0.98 }; // left wrist
armsRaisedV.landmarks[16] = { x: 0.58, y: 0.36, visibility: 0.98 }; // right wrist
const elGestureAngle = Math.round(calcAngle(armsRaisedV.landmarks[11], armsRaisedV.landmarks[13], armsRaisedV.landmarks[15]));
armsRaisedV.features = [
  {
    id: "left_elbow_gesture",
    kind: "angle",
    landmarks: [11, 13, 15],
    target: elGestureAngle,
    tolerance: 35.0,
    weight: 2.0,
    critical: true
  },
  {
    id: "right_elbow_gesture",
    kind: "angle",
    landmarks: [12, 14, 16],
    target: elGestureAngle,
    tolerance: 35.0,
    weight: 2.0,
    critical: true
  },
  {
    id: "shoulder_level",
    kind: "tilt",
    landmarks: [11, 12],
    target: 0.0,
    tolerance: 12.0,
    weight: 1.5
  }
];

// 8. Welcoming Intro / Friendly Wave
const oneHandWave = poses.find(p => p.id === 'one-hand-wave');
oneHandWave.name = "Welcoming Intro / Friendly Wave";
oneHandWave.category = "Solo Creator";
oneHandWave.framing = "upper-body";
oneHandWave.requiredLandmarks = [11, 12, 14, 16];
oneHandWave.features = [
  {
    id: "right_elbow_angle",
    kind: "angle",
    landmarks: [12, 14, 16],
    target: 120.0,
    tolerance: 35.0,
    weight: 2.0,
    critical: true
  },
  {
    id: "right_hand_height",
    kind: "position",
    landmarks: [16, 12],
    target: -0.10,
    tolerance: 0.22,
    weight: 2.0,
    critical: true
  },
  {
    id: "left_arm_down",
    kind: "angle",
    landmarks: [11, 13, 15],
    target: 165.0,
    tolerance: 40.0,
    weight: 1.0
  }
];

// 9. Open Palms / Warm Video Greeting
const warriorTwo = poses.find(p => p.id === 'warrior-two-pose');
warriorTwo.name = "Open Palms / Warm Video Greeting";
warriorTwo.category = "Solo Creator";
warriorTwo.framing = "upper-body";
warriorTwo.description = "Open, welcoming presenter stance: both palms open at chest level facing camera with relaxed, level shoulders.";
warriorTwo.requiredLandmarks = [11, 12, 13, 14];
warriorTwo.instructions = [
  "Keep spine tall and shoulders level",
  "Rest elbows near your sides",
  "Hold open palms facing camera at chest level"
];
warriorTwo.landmarks[13] = { x: 0.34, y: 0.38, visibility: 0.98 }; // left elbow
warriorTwo.landmarks[14] = { x: 0.66, y: 0.38, visibility: 0.98 }; // right elbow
warriorTwo.landmarks[15] = { x: 0.32, y: 0.30, visibility: 0.98 }; // left wrist
warriorTwo.landmarks[16] = { x: 0.68, y: 0.30, visibility: 0.98 }; // right wrist
const elOpenAngle = Math.round(calcAngle(warriorTwo.landmarks[11], warriorTwo.landmarks[13], warriorTwo.landmarks[15]));
warriorTwo.features = [
  {
    id: "left_elbow_open",
    kind: "angle",
    landmarks: [11, 13, 15],
    target: elOpenAngle,
    tolerance: 35.0,
    weight: 2.0,
    critical: true
  },
  {
    id: "right_elbow_open",
    kind: "angle",
    landmarks: [12, 14, 16],
    target: elOpenAngle,
    tolerance: 35.0,
    weight: 2.0,
    critical: true
  },
  {
    id: "shoulder_level",
    kind: "tilt",
    landmarks: [11, 12],
    target: 0.0,
    tolerance: 10.0,
    weight: 1.5
  }
];

// 10. Casual Streamer / Asymmetric Desk Lean
const weightShift = poses.find(p => p.id === 'weight-shift');
weightShift.name = "Casual Streamer / Asymmetric Desk Lean";
weightShift.category = "Streaming";
weightShift.framing = "upper-body";
weightShift.requiredLandmarks = [11, 12, 13, 14];
// Asymmetric posture: tilt shoulders slightly, rest left elbow
weightShift.landmarks[11] = { x: 0.40, y: 0.255, visibility: 0.99 };
weightShift.landmarks[12] = { x: 0.60, y: 0.235, visibility: 0.99 };
weightShift.landmarks[13] = { x: 0.35, y: 0.38, visibility: 0.98 };
weightShift.landmarks[15] = { x: 0.42, y: 0.38, visibility: 0.95 };
const elSupportAngle = Math.round(calcAngle(weightShift.landmarks[11], weightShift.landmarks[13], weightShift.landmarks[15]));
weightShift.features = [
  {
    id: "shoulder_tilt",
    kind: "tilt",
    landmarks: [11, 12],
    target: 5.7,
    tolerance: 8.0,
    weight: 2.0,
    critical: true
  },
  {
    id: "left_elbow_support",
    kind: "angle",
    landmarks: [11, 13, 15],
    target: elSupportAngle,
    tolerance: 35.0,
    weight: 1.5
  }
];

// 11. Key Point Emphasis / Hand Forward Gesture
const sideFacing = poses.find(p => p.id === 'side-facing');
sideFacing.name = "Key Point Emphasis / Hand Forward Gesture";
sideFacing.category = "Solo Creator";
sideFacing.framing = "upper-body";
sideFacing.requiredLandmarks = [11, 12, 14, 16];
sideFacing.landmarks[14] = { x: 0.64, y: 0.38, visibility: 0.98 }; // right elbow bent
sideFacing.landmarks[16] = { x: 0.60, y: 0.29, visibility: 0.98 }; // right wrist forward/up
const elForwardAngle = Math.round(calcAngle(sideFacing.landmarks[12], sideFacing.landmarks[14], sideFacing.landmarks[16]));
const yOffsetForward = Number((sideFacing.landmarks[16].y - sideFacing.landmarks[12].y).toFixed(2));
sideFacing.features = [
  {
    id: "right_hand_forward_height",
    kind: "position",
    landmarks: [16, 12],
    target: yOffsetForward,
    tolerance: 0.20,
    weight: 2.0,
    critical: true
  },
  {
    id: "right_elbow_gesture",
    kind: "angle",
    landmarks: [12, 14, 16],
    target: elForwardAngle,
    tolerance: 35.0,
    weight: 2.0,
    critical: true
  }
];

// Re-order poses: Seated Relaxed is #0 (Default!), followed by Core Anchor, Folded Arms, Thinker, etc.
const orderedPoses = [
  seatedRelaxed,
  standNaturally,
  armsCrossed,
  handNearChin,
  shouldersAngled,
  handsOnHips,
  armsRaisedV,
  oneHandWave,
  warriorTwo,
  weightShift,
  sideFacing
];

// Regenerate thumbnails for all poses
for (const p of orderedPoses) {
  p.thumbnail = generateThumbnail(p.name, p.landmarks);
}

// Write to data/seed_poses.json
fs.writeFileSync('data/seed_poses.json', JSON.stringify(orderedPoses, null, 2), 'utf8');

// Write to src/renderer/core/library/seedPoses.ts
const tsContent = `// Auto-generated seed poses conforming to ReferencePose schema
import { ReferencePose } from './types';

export const SEED_POSES: ReferencePose[] = ${JSON.stringify(orderedPoses, null, 2)};
`;
fs.writeFileSync('src/renderer/core/library/seedPoses.ts', tsContent, 'utf8');

console.log('Successfully calibrated, curated, and saved all 11 poses!');
