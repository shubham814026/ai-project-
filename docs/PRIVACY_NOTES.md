# Pose Coach - Privacy Architecture & Security Notes

## 1. On-Device Processing Guarantee
All video frames captured by the webcam are processed strictly in local device memory:
- **Zero Cloud Ingestion:** No frames, landmark coordinates, or telemetry are ever uploaded to any cloud server or remote API.
- **Self-Hosted Inference:** MediaPipe Pose Landmarker models (`.task` files) and WebAssembly (WASM) binaries are bundled directly within the application package (`public/models/` and `public/wasm/`). Once installed, the application runs 100% offline.
- **CSP Enforcement:** A strict Content Security Policy (`connect-src 'self' blob:;`) prevents outbound network requests from leaving the local origin.

---

## 2. Zero Frame Persistence
- **No Video Recording:** Pose Coach does not possess functionality to record, buffer, or save camera footage.
- **No Disk Caching:** Raw video frames are discarded immediately after landmark extraction in volatile GPU/CPU memory buffers.
- **Track Release:** All camera tracks (`MediaStreamTrack`) are explicitly stopped and released when the user clicks **Stop**, closes the application, or minimizes the window.

---

## 3. Biometrics & Identity Protection
- **No Face Recognition:** Pose Coach does not extract facial identity descriptors, facial embeddings, or demographic attributes. The face landmarks are used strictly to orient head angle and protect the face from intrusive graphics.
- **No Identity Tracking:** Multi-person detection is used solely to distinguish foreground vs. background subjects based on bounding box size and central positioning.

---

## 4. Local User Preferences
- Only non-sensitive user settings are stored locally:
  - Selected camera device ID
  - Mirror mode toggle
  - Resolution preferences
  - UI visibility toggles
- Stored exclusively in local browser `localStorage` under key `pose_coach_user_settings_v1`.

---

## 5. Dataset Governance Policy
- The dataset in `./assets/` consists of harvested public photography images.
- **Zero Dataset Images Bundled:** No dataset photos or derived photo crops are packaged into the desktop installer or served in the production bundle.
- **Vector Thumbnails Only:** All UI pose thumbnails are 100% synthetic vector SVGs rendered mathematically from joint angle coordinates.
