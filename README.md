# AI-based Pose Recommendation and Camera Guidance (DirectAI Studio) 📸🧘‍♂️

> **System Architecture:** Dual-Engine Vision Pipeline (Engine 1: Composition Guidance • Engine 2: Kinematic Pose Matching)  
> **Execution Model:** 100% On-Device WebAssembly SIMD • Zero Cloud Dependencies • $0 Operational Cost  
> **Deployment Target:** Cross-platform Desktop Application (Electron + React + TypeScript)

---

## 🌟 Executive Overview & Problem Addressed

Traditional webcam pose estimation tools frequently suffer from two critical pitfalls:
1. **The Triviality Trap:** Demonstrating basic gestures (like waving or crossing arms) lacks practical engineering utility for production applications.
2. **The Workflow Disconnect:** Content creators, remote presenters, and podcasters record in OBS or Zoom and cannot look at live arrows during a 30-minute recording session.

**DirectAI Studio** solves this through a practical, high-value real-world workflow: **Autonomous Studio Pre-Flight Calibration & AI Auto-Shutter Headshot Creator**.
- **Engine 1 (Camera Guidance):** Evaluates Rule-of-Thirds framing, crown headroom, horizontal centering, and shot scale before recording starts.
- **Engine 2 (Pose Recommendation & Coaching):** Analyzes posture ergonomics (upright spine, level shoulders, relaxed desk kinematics) and aesthetic creator stances.
- **Autonomous Auto-Shutter:** When the creator holds a verified pose and framing for 1.5 seconds, the AI fires a high-resolution snapshot with an on-screen flash and audio shutter sound, saving pristine portraits to a local gallery.

---

## 🚀 Key Technical Capabilities

- **Dual-Engine Architecture:**
  - **Engine 1 (Composition Analyzer):** Real-time evaluation of crown headroom ratio (`y_crown / H`), center offset (`|x_mid - 0.5|`), and eye-line alignment to the upper third (`y = 0.333`).
  - **Engine 2 (Kinematic Matcher):** Scale- and translation-invariant joint angle modeling, lateral roll tilt, and Lorentzian penalty scoring.
- **Robust 3D Slouch Detection:** Couples camera headroom (`y_crown > 0.235`) with kinematic alignment to prevent false matches when a user slumps into their chair.
- **Strict Face Occlusion Protection:** Algorithmic guarantee that visual correction arrows and skeletal overlay lines are never drawn over facial landmarks (0–10). Head and spine guidance is delivered strictly via floating HUD banners and spoken audio.
- **Autonomous AI Auto-Shutter:** Temporal hysteresis with a 1.5-second hold progress ring, firing automatic headshots into a local gallery upon verified alignment.
- **Native Windows & Electron PNG Persistence:** Custom Electron IPC channel (`save-snapshot`) saving high-resolution captures directly to the Windows `Downloads` folder, eliminating Windows `.tmp` download errors.
- **Offline Edge Speech & Web Audio Synthesizer:** Directorial voice feedback running 100% locally via the Web Speech API and procedural Web Audio API shutter sounds (zero external API calls).
- **Biomechanical Telemetry & Session Audit:** Interactive diagnostic inspector (`Ctrl+Shift+D` or HUD toggle) displaying real-time FPS, inference latency, framing distributions, kinematic confidence, and structured audit export.

---

## 💻 Tech Stack & Pinned Dependencies

| Component | Technology | Purpose |
|:---|:---:|:---|
| **Frontend Framework** | React 18.3.1 + TypeScript 5.5.4 | Component hierarchy & state management |
| **Vision Model** | `@mediapipe/tasks-vision` 0.10.14 | On-device PoseLandmarker via WebAssembly |
| **Styling** | Tailwind CSS 3.4.10 | Bespoke Deep Emerald (`#0F251E`) & Brass (`#C5A059`) theme |
| **Desktop Runtime** | Electron 31.3.1 | Cross-platform container with hardened CSP & IPC |
| **Testing** | Vitest 2.0.5 + Playwright 1.46.1 | 58 unit tests & 4 multi-resolution E2E tests |
| **Icons & Fonts** | Lucide React + Fontsource Inter | Bundled local accessible SVG icons & typography |

---

## 🛠️ Quick Start Guide for Teammates

### 1. Install Node Dependencies
```bash
npm install
```
*(The automated post-install hook copies MediaPipe WASM binaries to `public/wasm/`)*

### 2. Verify Models
Ensure self-hosted `.task` models exist in `public/models/`:
```bash
python tools/download_models.py
```

### 3. Run Development Server (Browser Mode)
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in Google Chrome or Microsoft Edge.

### 4. Run Desktop Application (Electron Native Mode)
```bash
npm run dev:electron
```

### 5. Run Verification Suites
```bash
# Run unit & mathematical test suite (58 passing tests)
npx vitest run

# Run end-to-end multi-resolution camera pipeline tests (4 passing tests)
npx playwright test

# Verify production build compilation
npm run build
```

---

## 📁 Repository Structure & Module Map

```
ai-project-/
├── data/
│   └── seed_poses.json                 # Authored reference poses with mathematical feature specs
├── docs/
│   ├── ARCHITECTURE.md                 # System architecture & coordinate mapping specs
│   ├── MANUAL_TEST_CHECKLIST.md        # Manual QA evaluation checklist
│   ├── PRIVACY_NOTES.md                # 100% on-device local execution guarantees
│   └── ROADMAP.md                      # Feature evolution & roadmap
├── public/
│   ├── models/                         # Self-hosted MediaPipe PoseLandmarker .task models
│   └── wasm/                           # Self-hosted WebAssembly runtime binaries
├── src/
│   ├── main/
│   │   └── main.ts                     # Electron main process (CSP, IPC save-snapshot, window life)
│   ├── preload/
│   │   └── preload.ts                  # Secure context bridge exposing saveSnapshot & appMetrics
│   └── renderer/
│       ├── core/
│       │   ├── camera/                 # CompositionAnalyzer, AudioSynthesizer, snapshot types
│       │   ├── geometry/               # Scale-invariant angle & normalizer math
│       │   ├── guidance/               # CorrectionGenerator, VoiceDirector, instruction templates
│       │   ├── library/                # RecommendationEngine, seed poses, types
│       │   ├── matching/               # PoseMatcher (Lorentzian scoring & hysteresis)
│       │   ├── perf/                   # PerformanceMonitor (FPS, latency tracking)
│       │   ├── pose/                   # PoseEstimator (MediaPipe wrapper), LandmarkFilter (One Euro)
│       │   ├── render/                 # OverlayRenderer (60fps canvas), coordinate mapping
│       │   └── settings/               # SettingsManager (localStorage persistence), constants
│       └── ui/
│           ├── GuidancePanel.tsx       # Live metrics, Rule of Thirds toggle & guidance cues
│           ├── SessionAuditModal.tsx   # Real-time telemetry inspector & session audit export
│           ├── SnapshotGalleryModal.tsx# Captured studio headshots with PNG download
│           ├── VideoContainer.tsx      # Viewport, 60fps canvas overlay & shutter animations
│           └── TopBar.tsx              # Audio toggle, Inspector HUD & Gallery controls
├── tests/
│   ├── e2e/                            # Playwright multi-resolution alignment verification
│   └── unit/                           # 58 Vitest unit tests (angles, composition, studio features)
└── tools/
    ├── copy_wasm.js                    # Postinstall automated WebAssembly distributor
    ├── curate_poses.cjs                # Script calibrating seed poses to kinematic consistency
    └── download_models.py              # Offline model asset downloader
```

---

## 📐 Mathematical Formulation & Core Algorithms

### 1. Scale-Invariant Kinematic Manifold

Raw landmark coordinates $\mathbf{p} = (x, y, z)$ fluctuate with user height, camera focal length, and distance from the lens. DirectAI Studio maps keypoints into a scale- and translation-invariant coordinate space anchored at the mid-shoulder center:

$$
\mathbf{p}_{\text{norm}} = \frac{\mathbf{p} - \mathbf{p}_{\text{mid}}}{\|\mathbf{p}_{\text{left}} - \mathbf{p}_{\text{right}}\|}
$$

Limb kinematics are represented as 16 directional joint angles $\theta_j$ using the dot-product cosine metric:

$$
\theta_j = \arccos\left(\frac{\vec{u} \cdot \vec{v}}{\|\vec{u}\| \|\vec{v}\|}\right)
$$

This representation guarantees 100% invariance to camera zoom, user proportions, and horizontal framing position.

---

### 2. Continuous Cauchy / Lorentzian Loss Heuristic

Traditional threshold matching causes jarring step-function score jumps when a limb crosses an arbitrary boundary. We model joint alignment as a continuous Cauchy (Lorentzian) distribution:

$$
s_i(\theta_i) = \frac{1}{1 + \left(\frac{|\theta_i - \theta_i^*|}{\tau_i}\right)^2}
$$

where $\theta_i^*$ is the reference target angle, and $\tau_i$ is the joint-specific tolerance threshold ($15^\circ$ for elbows and knees, $12^\circ$ for spine and torso alignment).

The overall kinematic posture score is computed as a weighted combination across active joints:

$$
S_{\text{pose}} = \left( \frac{\sum_{i=1}^{M} w_i \cdot s_i(\theta_i)}{\sum_{i=1}^{M} w_i} \right) \times 100
$$

---

### 3. Hierarchical Slouch Prevention & Framing Constraint

Webcams often frame only the upper chest and head, where forward slouching can falsely mimic an upright posture in 2D angle space. To resolve this ambiguity, DirectAI Studio tightly couples Engine 1's crown headroom metric with Engine 2's kinematic scorer:

$$
H_r = \frac{y_{\text{crown}}}{H_{\text{frame}}}
$$

If crown headroom drops below the upright threshold ($H_r > 0.235$) during an upright creator pose, a critical penalty caps the posture score:

$$
S_{\text{pose, final}} = \begin{cases}
\min(S_{\text{pose}}, 65), & \text{if } H_r > 0.235 \text{ (slouch detected)} \\[6pt]
S_{\text{pose}}, & \text{otherwise}
\end{cases}
$$

This multi-objective constraint ensures that slouching immediately voids snapshot eligibility and instructs the user: *"Sit taller: spine slouched"*.

---

### 4. Autonomous Auto-Shutter Hysteresis State Machine

To guarantee hands-free studio capture without shutter jitter, the system maintains a temporal hysteresis buffer at 60 Hz:

$$
S_{t+1} = \begin{cases}
S_t + \dfrac{\Delta t}{1.5}, & \text{if } S_{\text{framing}} \ge 70 \land S_{\text{pose}} \ge 75 \\[8pt]
\max\left(0, S_t - \dfrac{\Delta t}{0.5}\right), & \text{otherwise}
\end{cases}
$$

When $S_t \ge 1.0$ (1.5 continuous seconds of verified alignment), the state machine triggers:
1. Visual white-out canvas flash animation (300ms ease-out)
2. Procedural Web Audio camera shutter acoustic synthesis
3. High-resolution canvas snapshot persisted to memory and filesystem via Electron IPC

---

### 5. Adaptive Temporal Jitter Smoothing (One Euro Filter / 1€)

To eradicate webcam sensor jitter while preserving instantaneous response to deliberate user movement, landmark streams pass through a dual-cutoff One Euro (1€) filter:

$$
\hat{x}_k = \alpha x_k + (1 - \alpha)\hat{x}_{k-1}, \quad \alpha = \frac{1}{1 + \frac{\tau}{T_e}}
$$

The cutoff frequency dynamically scales with landmark velocity:

$$
f_c = f_{c,\min} + \beta |\dot{\hat{x}}_k|
$$

Configured with minimum cutoff $f_{c,\min} = 1.0\text{ Hz}$ and speed coefficient $\beta = 0.007$, the system eliminates resting hand micro-tremors without adding latency during rapid movement.

---

## 🔒 Privacy & Local Processing Guarantee
DirectAI Studio processes **100% of video frames in volatile RAM**. No video frames or audio samples are ever written to disk, sent over network sockets, or uploaded to any cloud infrastructure.
