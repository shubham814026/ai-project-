# Pose Coach 🧘‍♂️📸

Pose Coach is an intelligent, privacy-first desktop application that uses your laptop or USB webcam to detect your body pose with a self-hosted on-device AI model and guide you with real-time visual corrections toward a chosen target pose.

This is not a skeleton demo. You see yourself live, select a target pose, receive immediate on-screen biomechanical adjustments, and hold until you achieve a stable match. All processing happens 100% locally on your machine.

---

## 🚀 Key Highlights
- **100% Local & Private:** Self-hosted MediaPipe Pose Landmarker models (`.task`) and WebAssembly (WASM). Zero network requests, zero frame saving.
- **Biomechanical Angle & Feature Matching:** Normalized joint angles, torso-scaled distances, and tilt checks with calibrated tolerances and hysteresis.
- **Fluid 60 FPS Visual Overlay:** Multi-layered canvas with exponential easing (100ms time constant) ensuring fluid motion even when inference runs at 15–30 Hz.
- **Actionable Visual Corrections:** Clear on-video directional arrows routed away from the face, paired with short imperative instructions (≤ 8 words).
- **Curated Pose Library:** Authored reference poses with resolution-independent SVG thumbnails.
- **Dual Runtime:** Runs as a native desktop application (Electron) or directly in Google Chrome / Microsoft Edge from the Vite dev server.

---

## 💻 Reference Machine Baseline (Phase 1)
Recorded on the target host hardware:
- **Operating System:** Microsoft Windows 11 Home Single Language (64-bit, `win32`)
- **Processor:** 13th Gen Intel(R) Core(TM) i5-13450HX (10 Cores, 16 Threads, up to 4.6 GHz)
- **Memory:** 24 GB DDR5 RAM (~23.7 GB usable)
- **Runtimes:** Node.js v22.17.1, Python 3.13.5
- **Display & Audio:** Dual GPU (Intel UHD Graphics + NVIDIA GeForce RTX)

---

## 📦 Pinned Dependencies
All dependencies are strictly pinned to ensure reproducible builds:

| Package | Version | Purpose |
|:---|:---:|:---|
| `react` | `18.3.1` | Core UI library |
| `react-dom` | `18.3.1` | React DOM renderer |
| `@mediapipe/tasks-vision` | `0.10.14` | Pose Landmarker & WASM vision tasks |
| `lucide-react` | `0.439.0` | Accessible SVG icon suite |
| `@fontsource/inter` | `5.0.21` | Bundled local typography (no CDN) |
| `vite` | `5.4.2` | Fast bundling and HMR server |
| `typescript` | `5.5.4` | Static typing and compiler |
| `tailwindcss` | `3.4.10` | Utility-first design system styling |
| `electron` | `31.3.1` | Hardened desktop Chromium runtime |
| `vitest` | `2.0.5` | Unit and benchmark test runner |
| `@playwright/test` | `1.46.1` | Browser end-to-end automation harness |
| `electron-builder` | `24.13.3` | Windows NSIS installer packager |

---

## 🛠️ Installation & Setup

### 1. Install Node Dependencies
```bash
npm install
```
*(The automated post-install hook will copy MediaPipe WASM binaries to `public/wasm/`)*

### 2. Download Self-Hosted Models
Download official Google MediaPipe Pose Landmarker models into `public/models/` and record cryptographic checksums:
```bash
python tools/download_models.py
```

### 3. Run Development Server (Browser Mode)
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in Chrome or Edge.

### 4. Run Desktop Application (Electron Mode)
```bash
npm run dev:electron
```

### 5. Run Unit & Benchmark Tests
```bash
npm run test
npm run test:coverage
```

### 6. Build Production Bundle
```bash
npm run build
```

---

## 🧪 Testing & Verification
- **Unit Tests:** 29 automated Vitest tests covering joint geometry, One Euro filter jitter reduction, torso normalization, coordinate transformations, mirror mode symmetry, hysteresis, and guidance templates.
- **Matching Benchmark:** Empirical evaluation comparing the Angle & Feature model vs. the Euclidean distance baseline recorded in `reports/matching_comparison.md`.
- **Contrast Audit:** Automated WCAG 2.1 AA luminance ratio verification script in `tools/benchmark/check_contrast.py`.
- **Manual Checklist:** Complete human evaluation procedure in `docs/MANUAL_TEST_CHECKLIST.md`.

---

## 📖 Architecture & Privacy Docs
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): In-depth system design, module contracts, pipeline scheduling, and security hardening.
- [docs/PRIVACY_NOTES.md](docs/PRIVACY_NOTES.md): Local execution guarantees, zero data storage, and dataset governance.
- [docs/ROADMAP.md](docs/ROADMAP.md): Strategy for clustering the 12,014-image dataset to expand pose recommendations.
- [reports/dataset_report.md](reports/dataset_report.md): Phase 1 read-only inspection and quality audit of `./assets/`.

---

## ⌨️ Keyboard Shortcuts
- `Ctrl + Shift + D`: Toggle Hidden Biomechanical Diagnostics Drawer
- `Space`: Pause / Resume Camera Stream
- `M`: Toggle Camera Mirror Mode
- `S`: Toggle Skeleton Overlay
- `G`: Toggle Target Guide Skeleton
