import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CameraManager, CameraState, CameraDeviceInfo } from './core/camera/cameraManager';
import { PoseEstimator } from './core/pose/poseEstimator';
import { LandmarkFilterManager } from './core/pose/landmarkFilter';
import { PoseMatcher, FeatureMatchResult } from './core/matching/poseMatcher';
import { CorrectionGenerator, CorrectionInstruction } from './core/guidance/correctionGenerator';
import { RecommendationEngine, PoseRecommendation } from './core/library/recommendationEngine';
import { CompositionAnalyzer, CompositionResult } from './core/camera/compositionAnalyzer';
import { RenderStore } from './core/render/renderStore';
import { OverlayRenderer } from './core/render/overlayRenderer';
import { PerformanceMonitor, PerformanceStats } from './core/perf/performanceMonitor';
import { SettingsManager, AppSettings } from './core/settings/settingsManager';
import { calculateTransformBounds } from './core/render/coordinates';
import { anchorLandmarksToUser } from './core/geometry/normalizer';
import { ReferencePose } from './core/library/types';
import { SEED_POSES } from './core/library/seedPoses';
import { AudioSynthesizer } from './core/camera/audioSynthesizer';
import { VoiceDirector } from './core/guidance/voiceDirector';
import { StudioSnapshot } from './core/camera/snapshotTypes';

import { TopBar } from './ui/TopBar';
import { VideoContainer } from './ui/VideoContainer';
import { GuidancePanel } from './ui/GuidancePanel';
import { ControlsBar } from './ui/ControlsBar';
import { StatusBar } from './ui/StatusBar';
import { PoseGalleryModal } from './ui/PoseGalleryModal';
import { SuggestPoseModal } from './ui/SuggestPoseModal';
import { DebugPanel } from './ui/DebugPanel';
import { ConsentModal } from './ui/ConsentModal';
import { HelpModal } from './ui/HelpModal';
import { SettingsModal } from './ui/SettingsModal';
import { SnapshotGalleryModal } from './ui/SnapshotGalleryModal';
import { SessionAuditModal } from './ui/SessionAuditModal';

export const App: React.FC = () => {
  // Core Engine Singletons
  const settingsManager = useRef(new SettingsManager()).current;
  const cameraManager = useRef(new CameraManager()).current;
  const compositionAnalyzer = useRef(new CompositionAnalyzer()).current;
  const poseEstimator = useRef(new PoseEstimator()).current;
  const filterManager = useRef(new LandmarkFilterManager()).current;
  const poseMatcher = useRef(new PoseMatcher()).current;
  const correctionGenerator = useRef(new CorrectionGenerator()).current;
  const recommendationEngine = useRef(new RecommendationEngine()).current;
  const renderStore = useRef(new RenderStore()).current;
  const perfMonitor = useRef(new PerformanceMonitor()).current;
  const audioSynthesizer = useRef(new AudioSynthesizer()).current;
  const voiceDirector = useRef(new VoiceDirector()).current;
  const sessionStartTime = useRef(Date.now()).current;
  const hasSnappedCurrentPose = useRef<boolean>(false);
  const overallScoreRef = useRef<number>(0);

  // DOM Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRendererRef = useRef<OverlayRenderer | null>(null);

  // Throttled UI State (Max 10 Hz)
  const [settings, setSettings] = useState<AppSettings>(settingsManager.getSettings());
  const [cameraState, setCameraState] = useState<CameraState>('uninitialized');
  const [devices, setDevices] = useState<CameraDeviceInfo[]>([]);
  const [selectedPose, setSelectedPose] = useState<ReferencePose | null>(SEED_POSES[0]); // Default: Upright Streamer & Creator Ergonomics
  const [overallScore, setOverallScore] = useState<number>(0);
  const [cameraComposition, setCameraComposition] = useState<CompositionResult | null>(null);
  const [showRuleOfThirds, setShowRuleOfThirds] = useState<boolean>(true);
  const [inspectorMode, setIsInspectorMode] = useState<boolean>(settingsManager.getSettings().inspectorMode ?? false);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(settingsManager.getSettings().voiceDirectorEnabled ?? true);
  const [snapshots, setSnapshots] = useState<StudioSnapshot[]>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem('directai_studio_snapshots_v1');
        if (stored) return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('[App] Failed to load stored snapshots:', e);
    }
    return [];
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('directai_studio_snapshots_v1', JSON.stringify(snapshots.slice(0, 20)));
      }
    } catch (e) {
      console.warn('[App] Failed to persist snapshots to storage:', e);
    }
  }, [snapshots]);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const [isSnapshotGalleryOpen, setIsSnapshotGalleryOpen] = useState<boolean>(false);
  const [isSessionAuditOpen, setIsSessionAuditOpen] = useState<boolean>(false);
  const [coveragePassed, setCoveragePassed] = useState<boolean>(true);
  const [primaryInstruction, setPrimaryInstruction] = useState<CorrectionInstruction | null>(null);
  const [secondaryInstructions, setSecondaryInstructions] = useState<CorrectionInstruction[]>([]);
  const [framingInstruction, setFramingInstruction] = useState<string | null>(null);
  const [holdProgress, setHoldProgress] = useState<number>(0);
  const [isStableMatched, setIsStableMatched] = useState<boolean>(false);
  const [isPersonDetected, setIsPersonDetected] = useState<boolean>(false);
  const [isLowConfidence, setIsLowConfidence] = useState<boolean>(false);
  const [multiplePersons, setMultiplePersons] = useState<boolean>(false);
  const [detectedPersonCount, setDetectedPersonCount] = useState<number>(1);
  const detectedPersonCountRef = useRef<number>(1);
  const [isModelLoading, setIsModelLoading] = useState<boolean>(false);
  const [featureResults, setFeatureResults] = useState<FeatureMatchResult[]>([]);
  const [activeCorrections, setActiveCorrections] = useState<CorrectionInstruction[]>([]);
  const [perfStats, setPerfStats] = useState<PerformanceStats>(perfMonitor.getStats());

  // Modal & Diagnostic States
  const [isGalleryOpen, setIsGalleryOpen] = useState<boolean>(false);
  const [isSuggestModalOpen, setIsSuggestModalOpen] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [suggestedPoses, setSuggestedPoses] = useState<PoseRecommendation[]>([]);
  const [bestLiveMatch, setBestLiveMatch] = useState<PoseRecommendation | null>(null);
  const [isDebugOpen, setIsDebugOpen] = useState<boolean>(false);
  const [showTestPattern, setShowTestPattern] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('testPattern') === 'true';
    }
    return false;
  });
  const [showConsentModal, setShowConsentModal] = useState<boolean>(!settings.hasConsented);

  // Inference concurrency guard
  const isInferenceRunning = useRef<boolean>(false);
  const lastUiUpdateTimestamp = useRef<number>(0);

  // Camera state ref for keyboard shortcuts
  const cameraStateRef = useRef<CameraState>(cameraState);
  cameraStateRef.current = cameraState;

  // Initialize Camera & Listeners
  useEffect(() => {
    if (videoRef.current) {
      cameraManager.attachVideoElement(videoRef.current);
    }

    cameraManager.listCameras().then(setDevices);

    cameraManager['options'].onStateChange = (state) => {
      setCameraState(state);
    };

    cameraManager['options'].onDevicesChange = (devs) => {
      setDevices(devs);
    };

    // Keyboard shortcuts (Ctrl+Shift+D for debug, T for test pattern, Space, M, S, G)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setIsDebugOpen((prev) => !prev);
      } else if (e.key.toLowerCase() === 't' && !e.ctrlKey && !e.metaKey) {
        setShowTestPattern((prev) => !prev);
      } else if (e.code === 'Space') {
        e.preventDefault();
        const state = cameraStateRef.current;
        if (state === 'streaming') {
          cameraManager.pause();
        } else if (state === 'paused') {
          cameraManager.resume();
        } else if (state === 'stopped' || state === 'uninitialized') {
          handleStartCamera();
        }
      } else if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const up = settingsManager.update({ mirror: !settingsRef.current.mirror });
        setSettings(up);
      } else if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const up = settingsManager.update({ showSkeleton: !settingsRef.current.showSkeleton });
        setSettings(up);
      } else if (e.key.toLowerCase() === 'g' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const up = settingsManager.update({ showTargetGuide: !settingsRef.current.showTargetGuide });
        setSettings(up);
      } else if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowRuleOfThirds((prev) => {
          renderStore.showRuleOfThirds = !prev;
          return !prev;
        });
      } else if (e.key.toLowerCase() === 'x' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setIsInspectorMode((prev) => {
          const next = !prev;
          settingsManager.update({ inspectorMode: next });
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      cameraManager.stop();
      poseEstimator.close();
    };
  }, []);

  // Update renderStore target skeleton when pose changes
  useEffect(() => {
    renderStore.targetGuideLandmarks = selectedPose?.landmarks ?? null;
    poseMatcher.reset();
    correctionGenerator.reset();
  }, [selectedPose]);

  // Mutable refs for high-frequency inference loop to prevent unnecessary re-instantiations
  const selectedPoseRef = useRef<ReferencePose | null>(selectedPose);
  selectedPoseRef.current = selectedPose;

  const settingsRef = useRef<AppSettings>(settings);
  settingsRef.current = settings;

  // Model Initialization
  const ensureModelInitialized = useCallback(async () => {
    if (!poseEstimator.isReady()) {
      setIsModelLoading(true);
      await poseEstimator.initialize({ modelVariant: 'full' });
      setIsModelLoading(false);
    }
  }, []);

  // Manual & Auto-Shutter Studio Snapshot Capture
  const handleManualCapture = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) return null;

    try {
      const offscreen = document.createElement('canvas');
      offscreen.width = video.videoWidth;
      offscreen.height = video.videoHeight;
      const ctx = offscreen.getContext('2d');
      if (!ctx) return null;

      if (settingsRef.current.mirror) {
        ctx.translate(offscreen.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, offscreen.width, offscreen.height);

      const dataUrl = offscreen.toDataURL('image/png');
      const comp = renderStore.cameraComposition;
      const currentPose = selectedPoseRef.current;
      const pScore = Math.round(overallScoreRef.current);
      const fScore = comp ? comp.framingScore : 88;

      const snapshot: StudioSnapshot = {
        id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        dataUrl,
        timestamp: Date.now(),
        poseName: currentPose?.name || 'Studio Portrait',
        poseCategory: currentPose?.category || 'creator',
        framingScore: fScore,
        poseScore: pScore,
        overallScore: Math.round(fScore * 0.4 + pScore * 0.6),
        shotScale: comp ? comp.metrics.shotScale : 'medium-close-up',
        metrics: {
          headroomPercent: comp ? Math.round(comp.metrics.headroomRatio * 100) : 12,
          centeringPercent: comp ? Math.round((1 - comp.metrics.centerOffset) * 100) : 95,
          symmetryPercent: 96,
        },
      };

      audioSynthesizer.playShutterSound();
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 300);

      console.log('[DirectAI Auto-Shutter] Captured snapshot:', snapshot.id, snapshot.poseName);
      setSnapshots((prev) => [snapshot, ...prev]);
      return snapshot;
    } catch (err) {
      console.warn('[Manual Capture Error]', err);
      return null;
    }
  }, []);

  const handleManualCaptureRef = useRef(handleManualCapture);
  handleManualCaptureRef.current = handleManualCapture;

  // Reset auto-shutter lock whenever user selects or switches to a new pose
  useEffect(() => {
    hasSnappedCurrentPose.current = false;
  }, [selectedPose?.id]);

  // Single-instance inference loop running strictly when cameraState === 'streaming'
  useEffect(() => {
    if (cameraState !== 'streaming') return;

    let isMounted = true;
    let videoCallbackId: number | null = null;
    let rafCallbackId: number | null = null;

    const runFrame = async (timestamp: number) => {
      if (!isMounted) return;
      const video = videoRef.current;

      if (video && !video.paused && video.readyState >= 2 && video.videoWidth > 0 && !isInferenceRunning.current) {
        isInferenceRunning.current = true;
        const t0 = performance.now();

        try {
          if (!poseEstimator.isReady()) {
            setIsModelLoading(true);
            await poseEstimator.initialize({ modelVariant: 'lite' });
            setIsModelLoading(false);
          }

          const currentSettings = settingsRef.current;
          const currentPose = selectedPoseRef.current;

          const det = poseEstimator.detectForVideo(video, timestamp);
          perfMonitor.recordInference(det.inferenceTimeMs, t0);

          if (det.primaryPerson) {
            // Landmark smoothing with One Euro Filter (conditioned on smoothingEnabled)
            const smoothed = currentSettings.smoothingEnabled
              ? filterManager.filterLandmarks(det.primaryPerson.landmarks, t0)
              : det.primaryPerson.landmarks;

            // Engine 1: Camera Guidance & Composition Analysis (Dual-Engine Pipeline)
            const cameraComp = compositionAnalyzer.analyzeComposition(
              smoothed,
              currentPose?.framing ?? 'either',
              currentSettings.mirror
            );
            renderStore.setCameraComposition(cameraComp);

            // Pose matching
            let matchRes = {
              overallScore: 0,
              visibleWeightRatio: 0,
              coveragePassed: true,
              featureResults: [] as FeatureMatchResult[],
              criticalViolations: [] as FeatureMatchResult[],
              unresolvedFeatures: [] as FeatureMatchResult[],
              isMatchedInstant: false,
              isMirroredUsed: false,
              missingLandmarks: [] as number[],
            };

            if (currentPose) {
              matchRes = poseMatcher.scorePose(smoothed, currentPose, currentSettings.allowMirroredMatching);

              // Dual-Engine Slouch Prevention: Detect sunken spine / slouched posture for upper-body creator stances
              const isSlouched = (cameraComp.metrics.headroomRatio > 0.235 || cameraComp.guidanceCue.includes('slouched')) &&
                                 currentPose.framing === 'upper-body';

              if (isSlouched) {
                const slouchViolation: FeatureMatchResult = {
                  featureId: 'spine_slouch_detected',
                  kind: 'position',
                  measured: Math.round(cameraComp.metrics.headroomRatio * 100),
                  target: 17,
                  delta: Math.round((cameraComp.metrics.headroomRatio - 0.17) * 100),
                  tolerance: 5,
                  r: Math.max(1.5, (cameraComp.metrics.headroomRatio - 0.17) / 0.05),
                  score: 35,
                  weight: 2.5,
                  critical: true,
                  landmarks: [0, 11, 12],
                  visible: true,
                };
                matchRes.criticalViolations.push(slouchViolation);
                matchRes.unresolvedFeatures.unshift(slouchViolation);
                matchRes.featureResults.push(slouchViolation);
                matchRes.overallScore = Math.min(matchRes.overallScore, 65);
                matchRes.isMatchedInstant = false;
              }
            }

            // Hysteresis calculation
            const hyst = poseMatcher.updateHysteresis(
              matchRes.isMatchedInstant,
              matchRes.overallScore,
              matchRes.criticalViolations,
              t0
            );

            // Dynamically anchor target guide skeleton and directional arrows to user's body
            const anchoredTarget =
              currentPose?.landmarks && smoothed.length > 0
                ? anchorLandmarksToUser(currentPose.landmarks, smoothed)
                : currentPose?.landmarks;

            renderStore.targetGuideLandmarks = anchoredTarget ?? null;

            // Correction guidance generation
            const guidance = correctionGenerator.generateCorrections(
              matchRes,
              smoothed,
              anchoredTarget,
              t0,
              currentSettings.mirror
            );

            // Populate matched & adjustment joints
            const matchedJoints = new Set<number>();
            const adjustmentJoints = new Set<number>();

            for (const f of matchRes.featureResults) {
              if (f.r <= 1.0) {
                f.landmarks.forEach((j) => matchedJoints.add(j));
              } else {
                f.landmarks.forEach((j) => adjustmentJoints.add(j));
              }
            }

            // Extract secondary persons (if any)
            const secondaryLms = det.allPersons
              .filter((p) => p !== det.primaryPerson)
              .map((p) => p.landmarks);

            // Update high-frequency render store
            renderStore.setInferenceResult(
              smoothed,
              guidance.allActiveInstructions,
              matchedJoints,
              adjustmentJoints,
              hyst.holdProgress,
              hyst.isStableMatched,
              t0,
              secondaryLms
            );

            // Directorial Voice Guidance (100% offline edge speech)
            voiceDirector.provideFeedback(
              guidance.framingInstruction,
              guidance.primaryInstruction?.text ?? null,
              hyst.holdProgress,
              t0
            );

            // Autonomous AI Auto-Shutter: Trigger snapshot immediately on verified pose match
            const isAutoShutterActive = currentSettings.autoShutterEnabled !== false;
            if (hyst.isStableMatched && isAutoShutterActive) {
              if (!hasSnappedCurrentPose.current) {
                hasSnappedCurrentPose.current = true;
                handleManualCaptureRef.current();
                voiceDirector.notifyCapture(currentPose?.name || 'Studio Pose');
              }
            } else if (!hyst.isStableMatched && hyst.holdProgress === 0) {
              hasSnappedCurrentPose.current = false;
            }

            // Throttle React UI State updates to 10 Hz (every 100ms)
            if (t0 - lastUiUpdateTimestamp.current >= 100) {
              lastUiUpdateTimestamp.current = t0;
              overallScoreRef.current = matchRes.overallScore;
              setIsPersonDetected(true);
              const pCount = det.allPersons.length || 1;
              detectedPersonCountRef.current = pCount;
              setDetectedPersonCount(pCount);
              setMultiplePersons(det.multiplePersonsDetected);
              setOverallScore(matchRes.overallScore);
              setCameraComposition(cameraComp);
              setCoveragePassed(matchRes.coveragePassed);
              setPrimaryInstruction(guidance.primaryInstruction);
              setSecondaryInstructions(guidance.secondaryInstructions);
              setFramingInstruction(guidance.framingInstruction);
              setHoldProgress(hyst.holdProgress);
              setIsStableMatched(hyst.isStableMatched);
              setFeatureResults(matchRes.featureResults);
              setActiveCorrections(guidance.allActiveInstructions);

              // Focus low-confidence evaluation strictly on core tracking landmarks (head & shoulders)
              const coreLandmarks = [det.primaryPerson.landmarks[0], det.primaryPerson.landmarks[11], det.primaryPerson.landmarks[12]];
              const isCoreLowVis = coreLandmarks.some((l) => !l || l.visibility < 0.35);
              setIsLowConfidence(isCoreLowVis);

              // Live posture matching: calculate closest pose strictly matching detected person count
              const liveMatches = recommendationEngine.findBestMatchesFromFrame(
                SEED_POSES,
                smoothed,
                currentSettings.framingMode,
                3,
                undefined,
                pCount
              );
              setBestLiveMatch(liveMatches.length > 0 ? liveMatches[0] : null);
              setPerfStats(perfMonitor.getStats());
            }
          } else {
            // Person absent: buffer for 300ms before fading out overlay and resetting UI
            if (t0 - renderStore.lastInferenceTimestamp >= 300) {
              renderStore.setInferenceResult(null, [], new Set(), new Set(), 0, false, t0);
              renderStore.setCameraComposition(null);
              renderStore.targetGuideLandmarks = selectedPoseRef.current?.landmarks ?? null;
              if (t0 - lastUiUpdateTimestamp.current >= 100) {
                lastUiUpdateTimestamp.current = t0;
                setIsPersonDetected(false);
                setBestLiveMatch(null);
                setOverallScore(0);
                setCameraComposition(null);
                setPrimaryInstruction(null);
                setSecondaryInstructions([]);
                setFramingInstruction(null);
                setHoldProgress(0);
                setIsStableMatched(false);
                setPerfStats(perfMonitor.getStats());
              }
            }
          }
        } catch (err) {
          console.error('[Inference Error]', err);
        } finally {
          isInferenceRunning.current = false;
        }
      }

      // Schedule next frame
      if (isMounted) {
        if (video && 'requestVideoFrameCallback' in video) {
          videoCallbackId = video.requestVideoFrameCallback(runFrame);
        } else {
          rafCallbackId = requestAnimationFrame(runFrame);
        }
      }
    };

    const video = videoRef.current;
    if (video && 'requestVideoFrameCallback' in video) {
      videoCallbackId = video.requestVideoFrameCallback(runFrame);
    } else {
      rafCallbackId = requestAnimationFrame(runFrame);
    }

    return () => {
      isMounted = false;
      const v = videoRef.current;
      if (v && videoCallbackId !== null && 'cancelVideoFrameCallback' in v) {
        v.cancelVideoFrameCallback(videoCallbackId);
      }
      if (rafCallbackId !== null) {
        cancelAnimationFrame(rafCallbackId);
      }
    };
  }, [cameraState]);

  // Display Rate (60 fps) Canvas Overlay Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!overlayRendererRef.current) {
      overlayRendererRef.current = new OverlayRenderer(canvas);
    }
    const renderer = overlayRendererRef.current;

    let animId: number;

    const renderLoop = (time: number) => {
      const t0 = performance.now();

      // Exponential easing toward latest landmarks
      renderStore.updateEasing(time);

      // Compute transform bounds
      const bounds = calculateTransformBounds({
        containerWidth: canvas.width / (window.devicePixelRatio || 1),
        containerHeight: canvas.height / (window.devicePixelRatio || 1),
        videoWidth: videoRef.current?.videoWidth || 1280,
        videoHeight: videoRef.current?.videoHeight || 720,
        objectFit: 'contain',
        mirror: settings.mirror,
        dpr: window.devicePixelRatio || 1,
      });

      // Render overlay layers
      renderer.render(
        {
          userLandmarks: renderStore.currentEasedLandmarks,
          secondaryPersons: renderStore.secondaryPersonsLandmarks,
          targetLandmarks: renderStore.targetGuideLandmarks,
          showSkeleton: settings.showSkeleton,
          showTargetGuide: settings.showTargetGuide,
          showTestPattern,
          showRuleOfThirds,
          inspectorMode,
          cameraComposition: renderStore.cameraComposition,
          corrections: renderStore.corrections,
          matchedJoints: renderStore.matchedJoints,
          needsAdjustmentJoints: renderStore.needsAdjustmentJoints,
          holdProgress: renderStore.holdProgress,
          isStableMatched: renderStore.isStableMatched,
          trackingLost: renderStore.trackingLost,
          fadeOpacity: showTestPattern ? 1.0 : renderStore.fadeOpacity,
        },
        bounds
      );

      perfMonitor.recordRenderFrame(performance.now() - t0, time);
      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [settings, showTestPattern, showRuleOfThirds, inspectorMode]);

  // Camera Actions
  const handleStartCamera = async (currentSettings?: AppSettings) => {
    const active = currentSettings || settings;
    if (!active.hasConsented) {
      setShowConsentModal(true);
      return;
    }
    await ensureModelInitialized();
    await cameraManager.start(active.selectedCameraId ?? undefined, active.selectedResolution.width, active.selectedResolution.height);
  };

  const handlePauseCamera = () => cameraManager.pause();
  const handleResumeCamera = () => cameraManager.resume();
  const handleStopCamera = () => {
    cameraManager.stop();
    renderStore.reset();
  };

  const handleConsentAccept = () => {
    const updated = settingsManager.update({ hasConsented: true });
    setSettings(updated);
    setShowConsentModal(false);
    handleStartCamera(updated);
  };

  // Auto-start camera if user already granted consent in previous sessions
  const hasAutoStarted = useRef(false);
  useEffect(() => {
    if (!hasAutoStarted.current && settings.hasConsented && cameraState === 'uninitialized') {
      hasAutoStarted.current = true;
      handleStartCamera();
    }
  }, [settings.hasConsented, cameraState]);

  const handleSuggestPose = () => {
    const framing = settings.framingMode;
    const lms = renderStore.currentEasedLandmarks;
    const count = detectedPersonCountRef.current || 1;
    const recs = recommendationEngine.findBestMatchesFromFrame(
      SEED_POSES,
      lms,
      framing,
      4,
      undefined,
      count
    );
    setSuggestedPoses(recs);
    setIsSuggestModalOpen(true);
  };

  const handleNextPose = () => {
    if (!selectedPose) return;
    const idx = SEED_POSES.findIndex((p) => p.id === selectedPose.id);
    const nextIdx = (idx + 1) % SEED_POSES.length;
    setSelectedPose(SEED_POSES[nextIdx]);
  };

  const handleSwitchModelVariant = async (variant: 'lite' | 'full' | 'heavy') => {
    setIsModelLoading(true);
    poseEstimator.close();
    await poseEstimator.initialize({ modelVariant: variant });
    setIsModelLoading(false);
  };

  const handleResetDefaults = () => {
    const defaults = settingsManager.update({
      mirror: true,
      showSkeleton: true,
      showTargetGuide: true,
      framingMode: 'upper-body',
      selectedResolution: { width: 1280, height: 720 },
      allowMirroredMatching: false,
      smoothingEnabled: true,
    });
    setSettings(defaults);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0F251E] text-[#F4F6F4]">
      {/* Top Bar */}
      <TopBar
        modelVariant={poseEstimator.getModelVariant()}
        inspectorMode={inspectorMode}
        onToggleInspector={() => {
          setIsInspectorMode((prev) => {
            const next = !prev;
            settingsManager.update({ inspectorMode: next });
            return next;
          });
        }}
        voiceEnabled={voiceEnabled}
        onToggleVoice={() => {
          setVoiceEnabled((prev) => {
            const next = !prev;
            settingsManager.update({ voiceDirectorEnabled: next });
            voiceDirector.setEnabled(next);
            return next;
          });
        }}
        snapshotsCount={snapshots.length}
        onOpenGallery={() => setIsSnapshotGalleryOpen(true)}
        onOpenAudit={() => setIsSessionAuditOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Video Viewport (65%+ width) */}
        <VideoContainer
          videoRef={videoRef}
          canvasRef={canvasRef}
          cameraState={cameraState}
          isModelLoading={isModelLoading}
          isPersonDetected={isPersonDetected}
          isLowConfidence={isLowConfidence}
          multiplePersons={multiplePersons}
          mirror={settings.mirror}
          bestLiveMatch={bestLiveMatch}
          currentPoseId={selectedPose?.id ?? null}
          selectedPose={selectedPose}
          isStableMatched={isStableMatched}
          holdProgress={holdProgress}
          isFlashing={isFlashing}
          snapshotsCount={snapshots.length}
          lastSnapshotDataUrl={snapshots.length > 0 ? snapshots[0].dataUrl : null}
          primaryInstruction={primaryInstruction}
          framingInstruction={framingInstruction}
          onAdoptLiveMatch={(p) => setSelectedPose(p)}
          onRetryCamera={handleStartCamera}
          onCancelLoading={handleStopCamera}
          onStartCamera={() => handleStartCamera()}
          onResumeCamera={handleResumeCamera}
          onNextPose={handleNextPose}
          onOpenGallery={() => setIsSnapshotGalleryOpen(true)}
          onManualCapture={handleManualCapture}
        />

        {/* Live Guidance Side Panel */}
        <GuidancePanel
          selectedPose={selectedPose}
          overallScore={overallScore}
          coveragePassed={coveragePassed}
          cameraComposition={cameraComposition}
          showRuleOfThirds={showRuleOfThirds}
          onToggleRuleOfThirds={() => {
            setShowRuleOfThirds((prev) => {
              renderStore.showRuleOfThirds = !prev;
              return !prev;
            });
          }}
          primaryInstruction={primaryInstruction}
          secondaryInstructions={secondaryInstructions}
          framingInstruction={framingInstruction}
          holdProgress={holdProgress}
          isStableMatched={isStableMatched}
          bestLiveMatch={bestLiveMatch}
          onOpenGallery={() => setIsGalleryOpen(true)}
          onSuggestPose={handleSuggestPose}
          onNextPose={handleNextPose}
          onSelectPose={(p) => setSelectedPose(p)}
        />
      </div>

      {/* Bottom Controls Bar */}
      <ControlsBar
        cameraState={cameraState}
        devices={devices}
        selectedDeviceId={settings.selectedCameraId}
        onSelectDevice={(id) => {
          const up = settingsManager.update({ selectedCameraId: id });
          setSettings(up);
        }}
        onStart={handleStartCamera}
        onPause={handlePauseCamera}
        onResume={handleResumeCamera}
        onStop={handleStopCamera}
        mirror={settings.mirror}
        onToggleMirror={() => {
          const up = settingsManager.update({ mirror: !settings.mirror });
          setSettings(up);
        }}
        showSkeleton={settings.showSkeleton}
        onToggleSkeleton={() => {
          const up = settingsManager.update({ showSkeleton: !settings.showSkeleton });
          setSettings(up);
        }}
        showTargetGuide={settings.showTargetGuide}
        onToggleTargetGuide={() => {
          const up = settingsManager.update({ showTargetGuide: !settings.showTargetGuide });
          setSettings(up);
        }}
        framingMode={settings.framingMode}
        onToggleFramingMode={() => {
          const next = settings.framingMode === 'upper-body' ? 'full-body' : 'upper-body';
          const up = settingsManager.update({ framingMode: next });
          setSettings(up);
        }}
        resolution={settings.selectedResolution}
        onChangeResolution={(width, height) => {
          const up = settingsManager.update({ selectedResolution: { width, height } });
          setSettings(up);
        }}
      />

      {/* Status Bar */}
      <StatusBar
        stats={perfStats}
        cameraState={cameraState}
        modelVariant={poseEstimator.getModelVariant()}
        multiplePersons={multiplePersons}
        onSwitchPrimaryPerson={() => {
          const nextIdx = poseEstimator.getPrimaryPersonIndex() === 0 ? 1 : 0;
          poseEstimator.setPrimaryPersonIndex(nextIdx);
        }}
      />

      {/* Modals & Diagnostic Panels */}
      {isGalleryOpen && (
        <PoseGalleryModal
          currentPoseId={selectedPose?.id ?? null}
          onSelectPose={(p) => setSelectedPose(p)}
          onClose={() => setIsGalleryOpen(false)}
          datasetLoader={recommendationEngine.getDatasetRecommender().getLoader()}
        />
      )}

      <SuggestPoseModal
        isOpen={isSuggestModalOpen}
        onClose={() => setIsSuggestModalOpen(false)}
        recommendations={suggestedPoses}
        personCount={detectedPersonCount}
        onSelectPose={(rec) => {
          setSelectedPose(rec.pose);
          setIsSuggestModalOpen(false);
        }}
      />

      {showConsentModal && (
        <ConsentModal
          onAccept={handleConsentAccept}
          onDecline={() => setShowConsentModal(false)}
        />
      )}

      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        devices={devices}
        modelVariant={poseEstimator.getModelVariant()}
        onUpdateSettings={(partial) => {
          const up = settingsManager.update(partial);
          setSettings(up);
        }}
        onSwitchModelVariant={handleSwitchModelVariant}
        onOpenDiagnostics={() => setIsDebugOpen(true)}
        onResetDefaults={handleResetDefaults}
      />

      <DebugPanel
        isOpen={isDebugOpen}
        onClose={() => setIsDebugOpen(false)}
        featureResults={featureResults}
        activeCorrections={activeCorrections}
        score={overallScore}
      />

      {/* Studio Snapshot Gallery Modal */}
      <SnapshotGalleryModal
        isOpen={isSnapshotGalleryOpen}
        onClose={() => setIsSnapshotGalleryOpen(false)}
        snapshots={snapshots}
        onDeleteSnapshot={(id) => setSnapshots((prev) => prev.filter((s) => s.id !== id))}
        onClearAll={() => setSnapshots([])}
      />

      {/* Session Telemetry & Audit Modal */}
      <SessionAuditModal
        isOpen={isSessionAuditOpen}
        onClose={() => setIsSessionAuditOpen(false)}
        sessionStartTime={sessionStartTime}
        stats={perfStats}
        cameraComposition={cameraComposition}
        overallScore={overallScore}
        snapshots={snapshots}
        modelVariant={poseEstimator.getModelVariant()}
      />
    </div>
  );
};
export default App;
