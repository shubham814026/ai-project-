# Pose Coach - Live Webcam Manual Test Checklist

This verification checklist is designed for human evaluation on physical webcam hardware across diverse physical environments.

---

## Instructions for Tester
1. Launch the application (`npm run dev` or launch the desktop app).
2. Connect your webcam (built-in or external USB).
3. Complete each test scenario below.
4. Mark `[X]` for Pass or `[ ]` for Fail and note observations.

---

## 1. Camera Lifecycle & Hardware Controls (Phase 2 Verification Gate)

| Test Scenario | Procedure | Acceptance Criteria | Pass / Fail | Notes |
|:---|:---|:---|:---:|:---|
| **Camera Selection** | Click camera selector in bottom bar; switch between integrated and USB webcams. | Stream switches cleanly within 1s; no black screen; new device label displays. | [ ] | |
| **Resolution Switching** | Switch between 480p, 720p, and 1080p in bottom bar controls. | Video container transitions seamlessly; no aspect ratio distortion or canvas stretch. | [ ] | |
| **Mirror Toggle** | Click mirror button (`Alt+M` or icon). | Preview horizontally flips smoothly; letterbox offsets and coordinate transform remain aligned. | [ ] | |
| **Camera Light / Track Release** | Click "Stop Camera" or close application window. | Hardware webcam LED turns OFF immediately; all MediaStream tracks released (`readyState === 'ended'`). | [ ] | |
| **Hot-Plug Handling** | Connect or disconnect a USB camera during runtime. | Device list refreshes automatically via `navigator.mediaDevices.ondevicechange`; active stream recovers or displays clean error banner. | [ ] | |

---

## 2. Environment & Lighting Verification

| Test Scenario | Procedure | Criteria | Pass / Fail | Notes |
|:---|:---|:---|:---:|:---|
| **Bright / Ambient Daylight** | Stand in a well-lit room facing camera. | Clean, jitter-free skeleton; visibility scores > 0.85 across all joints. | [ ] | |
| **Dim / Low-Light** | Dim overhead lights (< 50 lux). | App remains responsive; dashed low-confidence joints appear if tracking degrades; no crashes. | [ ] | |
| **Backlit Condition** | Position light source (window or lamp) directly behind you. | Subject in silhouette; guidance displays "Hold still or improve lighting" if confidence drops. | [ ] | |
| **Complex Clutter Background** | Stand in front of bookshelves, furniture, or complex patterns. | Pose Landmarker isolates human subject without false skeleton snaps to background objects. | [ ] | |

---

## 2. Distance, Framing & Orientation

| Test Scenario | Procedure | Criteria | Pass / Fail | Notes |
|:---|:---|:---|:---:|:---|
| **Close-Up Portrait (< 1 meter)** | Sit close to webcam showing head and shoulders only. | App detects upper-body mode; suggests upper-body poses; prompts to step back for full-body poses. | [ ] | |
| **Optimal Upper-Body (1.5 meters)** | Stand or sit so waist, chest, and arms are fully in frame. | All 8 upper-body seed poses match accurately; coaching instructions appear when limbs move. | [ ] | |
| **Full-Body (2.5 - 3.5 meters)** | Step back until feet, knees, hips, and head are visible. | Lower-body joints (hips, knees, ankles) track stably; full-body poses (Warrior, Standing) engage cleanly. | [ ] | |
| **Body Turning (45° & 90° Profile)** | Rotate body 45 degrees, then 90 degrees sideways. | 3D world landmarks preserve angles; side profile maintains posture metrics without flipping. | [ ] | |
| **Person Leaves Frame** | Step completely out of camera view for 2 seconds. | Skeleton fades within 300ms; hold progress resets; "Step into camera view" prompt appears. | [ ] | |
| **Person Returns** | Step back into center frame. | Tracking re-engages instantly within 500ms without camera or app restart. | [ ] | |

---

## 3. Real-time Movement & Tracking Stability

| Test Scenario | Procedure | Criteria | Pass / Fail | Notes |
|:---|:---|:---|:---:|:---|
| **Rapid Arm Movement** | Wave arms quickly side-to-side for 5 seconds. | One Euro filter dynamically reduces lag; skeleton lines follow limbs without excessive delay (< 80ms). | [ ] | |
| **Stationary Pose Hold** | Hold "Hands on Hips" steady for 3 seconds. | Jitter is virtually imperceptible (< 2px); 1.5s hold progress completes; matched green ring triggers. | [ ] | |
| **Hysteresis Exit** | After achieving matched state, shift left arm slightly. | Match state does not flicker on noisy single frame; leaves matched only if score dips below 75% for 0.5s. | [ ] | |

---

## 4. Hardware & Resolution Compatibility

| Test Scenario | Procedure | Criteria | Pass / Fail | Notes |
|:---|:---|:---|:---:|:---|
| **720p HD (Default)** | Select 720p resolution in bottom bar. | Stream maintains 30 fps; inference latency <= 40ms. | [ ] | |
| **1080p FHD** | Select 1080p resolution in bottom bar. | Stream switches cleanly without restarting camera; inference maintains >= 15 Hz. | [ ] | |
| **480p SD Performance** | Select 480p resolution in bottom bar. | Low latency (< 25ms); ideal for power-saving mode. | [ ] | |
| **USB Camera Hot-Plug** | Unplug USB camera mid-session. | App shows "Device lost / unplugged" error banner cleanly without unhandled exception. | [ ] | |
| **USB Camera Re-Plug** | Re-connect USB camera. | Device selector detects reconnected camera via `devicechange`; allows instant reconnection. | [ ] | |

---

## 5. UI / UX & Guidance Correctness

| Test Scenario | Procedure | Criteria | Pass / Fail | Notes |
|:---|:---|:---|:---:|:---|
| **Anatomical Left / Right** | Raise your physical RIGHT hand in mirrored mode. | On-screen arrow highlights your displayed right hand; instruction specifically says "right arm". | [ ] | |
| **Face Occlusion Protection** | Place hands close to ears or chest. | Visual guidance arrows and target skeleton lines never draw across or cover the face. | [ ] | |
| **Dark Halo Legibility** | Stand against both white and black backgrounds. | Overlay strokes remain crisp and legible due to the 1.5px dark halo backing. | [ ] | |
| **Diagnostic Mode (Ctrl+Shift+D)** | Press `Ctrl+Shift+D`. | Diagnostics drawer slides in showing per-feature deltas, measured vs target values, and uncalibrated notice. | [ ] | |
