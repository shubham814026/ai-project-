import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CameraManager, CameraState, CameraDeviceInfo } from './core/camera/cameraManager';
import { PoseEstimator } from './core/pose/poseEstimator';
import { LandmarkFilterManager } from './core/pose/landmarkFilter';
import { PoseMatcher, FeatureMatchResult } from './core/matching/poseMatcher';
import { CorrectionGenerator, CorrectionInstruction } from './core/guidance/correctionGenerator';
import { RecommendationEngine, PoseRecommendation } from './core/library/recommendationEngine';
import { RenderStore } from './core/render/renderStore';
import { OverlayRenderer } from './core/render/overlayRenderer';
import { PerformanceMonitor, PerformanceStats } from './core/perf/performanceMonitor';
import { SettingsManager, AppSettings } from './core/settings/settingsManager';
import { calculateTransformBounds } from './core/render/coordinates';
import { ReferencePose } from './core/library/types';
import { SEED_POSES } from './core/library/seedPoses';

import { TopBar } from './ui/TopBar';
import { VideoContainer } from './ui/VideoContainer';
import { GuidancePanel } from './ui/GuidancePanel';
import { ControlsBar } from './ui/ControlsBar';
import { StatusBar } from './ui/StatusBar';
import { PoseGalleryModal } from './ui/PoseGalleryModal';
import { SuggestPoseModal } from './ui/SuggestPoseModal';
import { DebugPanel } from './ui/DebugPanel';
import { ConsentModal } from './ui/ConsentModal';

export const App: React.FC = () => {
  // Core Engine Singletons
  const settingsManager = useRef(new SettingsManager()).current;
  const cameraManager = useRef(new CameraManager()).current;
  const poseEstimator = useRef(new PoseEstimator()).current;
  const filterManager = useRef(new LandmarkFilterManager()).current;
  const poseMatcher = useRef(new PoseMatcher()).current;
  const correctionGenerator = useRef(new CorrectionGenerator()).current;
  const recommendationEngine = useRef(new RecommendationEngine()).current;
  const renderStore = useRef(new RenderStore()).current;
  const perfMonitor = useRef(new PerformanceMonitor()).current;

  // DOM Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRendererRef = useRef<OverlayRenderer | null>(null);

  // Throttled UI State (Max 10 Hz)
  const [settings, setSettings] = useState<AppSettings>(settingsManager.getSettings());
  const [cameraState, setCameraState] = useState<CameraState>('uninitialized');
  const [devices, setDevices] = useState<CameraDeviceInfo[]>([]);
  const [selectedPose, setSelectedPose] = useState<ReferencePose | null>(SEED_POSES[1]); // Default: Hands on Hips
  const [overallScore, setOverallScore] = useState<number>(0);
  const [coveragePassed, setCoveragePassed] = useState<boolean>(true);
  const [primaryInstruction, setPrimaryInstruction] = useState<CorrectionInstruction | null>(null);
  const [secondaryInstructions, setSecondaryInstructions] = useState<CorrectionInstruction[]>([]);
  const [framingInstruction, setFramingInstruction] = useState<string | null>(null);
  const [holdProgress, setHoldProgress] = useState<number>(0);
  const [isStableMatched, setIsStableMatched] = useState<boolean>(false);
  const [isPersonDetected, setIsPersonDetected] = useState<boolean>(false);
  const [isLowConfidence, setIsLowConfidence] = useState<boolean>(false);
  const [multiplePersons, setMultiplePersons] = useState<boolean>(false);
  const [isModelLoading, setIsModelLoading] = useState<boolean>(false);
  const [featureResults, setFeatureResults] = useState<FeatureMatchResult[]>([]);
  const [activeCorrections, setActiveCorrections] = useState<CorrectionInstruction[]>([]);
  const [perfStats, setPerfStats] = useState<PerformanceStats>(perfMonitor.getStats());

  // Modal & Diagnostic States
  const [isGalleryOpen, setIsGalleryOpen] = useState<boolean>(false);
  const [isSuggestModalOpen, setIsSuggestModalOpen] = useState<boolean>(false);
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

    // Keyboard shortcuts (Ctrl+Shift+D for debug, T for test pattern)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setIsDebugOpen((prev) => !prev);
      } else if (e.key.toLowerCase() === 't' && !e.ctrlKey && !e.metaKey) {
        setShowTestPattern((prev) => !prev);
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
      await poseEstimator.initialize({ modelVariant: 'lite' });
      setIsModelLoading(false);
    }
  }, []);

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
            // Landmark smoothing with One Euro Filter
            const smoothed = filterManager.filterLandmarks(det.primaryPerson.landmarks, t0);

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
            }

            // Hysteresis calculation
            const hyst = poseMatcher.updateHysteresis(
              matchRes.isMatchedInstant,
              matchRes.overallScore,
              matchRes.criticalViolations,
              t0
            );

            // Correction guidance generation
            const guidance = correctionGenerator.generateCorrections(
              matchRes,
              smoothed,
              currentPose?.landmarks,
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

            // Throttle React UI State updates to 10 Hz (every 100ms)
            if (t0 - lastUiUpdateTimestamp.current >= 100) {
              lastUiUpdateTimestamp.current = t0;
              setIsPersonDetected(true);
              setMultiplePersons(det.multiplePersonsDetected);
              setOverallScore(matchRes.overallScore);
              setCoveragePassed(matchRes.coveragePassed);
              setPrimaryInstruction(guidance.primaryInstruction);
              setSecondaryInstructions(guidance.secondaryInstructions);
              setFramingInstruction(guidance.framingInstruction);
              setHoldProgress(hyst.holdProgress);
              setIsStableMatched(hyst.isStableMatched);
              setFeatureResults(matchRes.featureResults);
              setActiveCorrections(guidance.allActiveInstructions);

              // Focus low-confidence evaluation on upper limbs for seated/upper-body camera use
              const upperLimbsLowVis = det.primaryPerson.landmarks
                .slice(11, 23)
                .filter((l) => l.visibility < 0.35).length;
              setIsLowConfidence(upperLimbsLowVis > 4);

              // Live posture matching: calculate closest pose from current live frame
              const liveMatches = recommendationEngine.findBestMatchesFromFrame(
                SEED_POSES,
                smoothed,
                currentSettings.framingMode,
                3
              );
              setBestLiveMatch(liveMatches.length > 0 ? liveMatches[0] : null);
              setPerfStats(perfMonitor.getStats());
            }
          } else {
            // Person absent: buffer for 300ms before fading out overlay and resetting UI
            if (t0 - renderStore.lastInferenceTimestamp >= 300) {
              renderStore.setInferenceResult(null, [], new Set(), new Set(), 0, false, t0);
              if (t0 - lastUiUpdateTimestamp.current >= 100) {
                lastUiUpdateTimestamp.current = t0;
                setIsPersonDetected(false);
                setBestLiveMatch(null);
                setOverallScore(0);
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
  }, [settings]);

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

  const handleSuggestPose = () => {
    const framing = settings.framingMode;
    const lms = renderStore.currentEasedLandmarks;
    const recs = recommendationEngine.findBestMatchesFromFrame(SEED_POSES, lms, framing, 4);
    setSuggestedPoses(recs);
    setIsSuggestModalOpen(true);
  };

  const handleNextPose = () => {
    if (!selectedPose) return;
    const idx = SEED_POSES.findIndex((p) => p.id === selectedPose.id);
    const nextIdx = (idx + 1) % SEED_POSES.length;
    setSelectedPose(SEED_POSES[nextIdx]);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0F251E] text-[#F4F6F4]">
      {/* Top Bar */}
      <TopBar
        modelVariant={poseEstimator.getModelVariant()}
        onOpenSettings={() => setIsDebugOpen(true)}
        onOpenHelp={() => {}}
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
          onAdoptLiveMatch={(p) => setSelectedPose(p)}
          onRetryCamera={handleStartCamera}
          onCancelLoading={handleStopCamera}
        />

        {/* Live Guidance Side Panel */}
        <GuidancePanel
          selectedPose={selectedPose}
          overallScore={overallScore}
          coveragePassed={coveragePassed}
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
          poseEstimator.setPrimaryPersonIndex(1);
        }}
      />

      {/* Modals & Diagnostic Panels */}
      {isGalleryOpen && (
        <PoseGalleryModal
          currentPoseId={selectedPose?.id ?? null}
          onSelectPose={(p) => setSelectedPose(p)}
          onClose={() => setIsGalleryOpen(false)}
        />
      )}

      <SuggestPoseModal
        isOpen={isSuggestModalOpen}
        onClose={() => setIsSuggestModalOpen(false)}
        recommendations={suggestedPoses}
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

      <DebugPanel
        isOpen={isDebugOpen}
        onClose={() => setIsDebugOpen(false)}
        featureResults={featureResults}
        activeCorrections={activeCorrections}
        score={overallScore}
      />
    </div>
  );
};
export default App;
