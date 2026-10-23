import React, { useEffect, useRef } from 'react';
import { CameraState } from '../core/camera/cameraManager';
import { PoseRecommendation } from '../core/library/recommendationEngine';
import { ReferencePose } from '../core/library/types';
import { CorrectionInstruction } from '../core/guidance/correctionGenerator';
import { Loader2, AlertCircle, UserX, CameraOff, Users, Sparkles, Play, Pause, CheckCircle2, ShieldCheck, Zap, Target, Camera } from 'lucide-react';

interface VideoContainerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  cameraState: CameraState;
  isModelLoading: boolean;
  isPersonDetected: boolean;
  isLowConfidence: boolean;
  multiplePersons?: boolean;
  mirror: boolean;
  bestLiveMatch?: PoseRecommendation | null;
  currentPoseId?: string | null;
  selectedPose?: ReferencePose | null;
  isStableMatched?: boolean;
  holdProgress?: number;
  isFlashing?: boolean;
  snapshotsCount?: number;
  lastSnapshotDataUrl?: string | null;
  primaryInstruction?: CorrectionInstruction | null;
  framingInstruction?: string | null;
  onAdoptLiveMatch?: (pose: ReferencePose) => void;
  onRetryCamera: () => void;
  onCancelLoading: () => void;
  onStartCamera?: () => void;
  onResumeCamera?: () => void;
  onNextPose?: () => void;
  onOpenGallery?: () => void;
  onManualCapture?: () => void;
}

export const VideoContainer: React.FC<VideoContainerProps> = ({
  videoRef,
  canvasRef,
  cameraState,
  isModelLoading,
  isPersonDetected,
  isLowConfidence,
  multiplePersons,
  mirror,
  bestLiveMatch: _bestLiveMatch,
  currentPoseId: _currentPoseId,
  selectedPose,
  isStableMatched,
  holdProgress = 0,
  isFlashing = false,
  snapshotsCount = 0,
  lastSnapshotDataUrl = null,
  primaryInstruction,
  framingInstruction,
  onAdoptLiveMatch: _onAdoptLiveMatch,
  onRetryCamera,
  onCancelLoading,
  onStartCamera,
  onResumeCamera,
  onNextPose,
  onOpenGallery,
  onManualCapture,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // ResizeObserver handling canvas DPR and dimensions (Section A7)
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1.0;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    window.addEventListener('resize', updateSize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [canvasRef]);

  const isStreaming = cameraState === 'streaming';
  const isCameraLoading = cameraState === 'loading';
  const isPaused = cameraState === 'paused';
  const isIdle = cameraState === 'uninitialized' || cameraState === 'stopped';

  return (
    <div
      ref={containerRef}
      className="relative flex-1 h-full bg-[#07120E] flex items-center justify-center overflow-hidden select-none"
    >
      {/* HTML Video Element (CSS-flipped when mirror is true) */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        style={{
          transform: mirror ? 'scaleX(-1)' : 'none',
          display: isStreaming || isPaused ? 'block' : 'none',
        }}
      />

      {/* Hardware-accelerated Canvas Overlay (never CSS-flipped) */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
      />

      {/* Studio Camera Shutter Flash Effect */}
      {isFlashing && (
        <div className="absolute inset-0 bg-white pointer-events-none z-30 transition-opacity duration-300 opacity-90 animate-out fade-out" />
      )}

      {/* State 1: Standby / Idle Landing Display */}
      {isIdle && (
        <div className="z-20 max-w-md w-full p-6 mx-4 rounded-3xl bg-[#16382D]/90 border border-[#F4F6F4]/15 shadow-2xl backdrop-blur-md text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-2xl bg-[#5EEAD4]/20 border border-[#5EEAD4]/40 flex items-center justify-center mx-auto text-[#5EEAD4] shadow-lg">
            <Target className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-xl font-bold text-[#F4F6F4] tracking-tight">DirectAI Studio</h3>
            <p className="text-xs text-[#94A39E] mt-1.5 leading-relaxed">
              Real-time kinematic posture assessment, joint angle coaching, and camera guidance. Click below to start your webcam.
            </p>
          </div>

          {/* Selected Pose Preview Card */}
          {selectedPose && (
            <div className="p-3 bg-[#0F251E]/75 border border-[#F4F6F4]/10 rounded-2xl flex items-center gap-3 text-left shadow-lg">
              <div className="relative w-14 h-18 rounded-xl overflow-hidden shrink-0 border border-[#C5A059]/30 bg-[#16382D] flex items-center justify-center">
                {selectedPose.sourceImage ? (
                  <img
                    src={selectedPose.sourceImage}
                    alt={selectedPose.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                      const fallback = e.currentTarget.parentElement?.querySelector('.start-svg-fallback');
                      if (fallback) (fallback as HTMLElement).style.display = 'flex';
                    }}
                  />
                ) : null}
                <div
                  className="start-svg-fallback w-full h-full flex items-center justify-center"
                  style={{ display: selectedPose.sourceImage ? 'none' : 'flex' }}
                  dangerouslySetInnerHTML={{ __html: selectedPose.thumbnail }}
                />
              </div>
              <div className="overflow-hidden flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#5EEAD4]">Target Pose</span>
                <h4 className="text-sm font-bold text-[#F4F6F4] truncate">{selectedPose.name}</h4>
                <p className="text-[11px] text-[#94A39E] capitalize">{selectedPose.category} &bull; {selectedPose.difficulty}</p>
              </div>
            </div>
          )}

          {/* Primary Action Button */}
          {onStartCamera && (
            <button
              onClick={onStartCamera}
              disabled={isCameraLoading || isModelLoading}
              className="w-full py-3.5 px-5 rounded-2xl font-bold text-sm bg-gradient-to-r from-[#5EEAD4] to-[#4ADE80] text-[#0F251E] hover:from-[#4ADE80] hover:to-[#5CEE90] transition flex items-center justify-center gap-2 shadow-xl cursor-pointer group disabled:opacity-75"
            >
              {isCameraLoading || isModelLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#0F251E]" />
                  <span>Starting Camera & Pose Model...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current group-hover:scale-110 transition" />
                  <span>Start Camera & Guidance</span>
                </>
              )}
            </button>
          )}

          {/* Guarantee Badges */}
          <div className="pt-2 border-t border-[#F4F6F4]/10 flex items-center justify-center gap-4 text-[11px] text-[#94A39E]">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#5EEAD4]" />
              100% Private (No Cloud)
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#C5A059]" />
              30 FPS Edge AI
            </span>
            <span className="flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-[#4ADE80]" />
              One Euro Filter
            </span>
          </div>
        </div>
      )}

      {/* State 2: Camera Paused Overlay */}
      {isPaused && (
        <div className="z-20 flex flex-col items-center gap-3 p-6 rounded-3xl bg-[#0F251E]/90 border border-[#C5A059]/40 shadow-2xl backdrop-blur-md text-center animate-in fade-in">
          <div className="w-12 h-12 rounded-2xl bg-[#C5A059]/20 flex items-center justify-center text-[#C5A059] shadow">
            <Pause className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-base font-bold text-[#F4F6F4]">Stream Paused</h4>
            <p className="text-xs text-[#94A39E] mt-0.5">Camera feed is on hold. Click resume or press Space.</p>
          </div>
          {onResumeCamera && (
            <button
              onClick={onResumeCamera}
              className="mt-2 px-5 py-2 text-xs font-bold bg-[#4ADE80] text-[#0F251E] hover:bg-[#5CEE90] rounded-xl transition shadow flex items-center gap-2"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Resume Stream</span>
            </button>
          )}
        </div>
      )}

      {/* State 3: Camera Loading */}
      {isCameraLoading && (
        <div className="z-20 flex flex-col items-center gap-3 p-6 rounded-2xl bg-[#16382D]/90 border border-[#F4F6F4]/10 shadow-2xl backdrop-blur">
          <Loader2 className="w-8 h-8 text-[#C5A059] animate-spin" />
          <p className="text-sm font-medium text-[#F4F6F4]">Connecting to camera...</p>
          <button
            onClick={onCancelLoading}
            className="px-3 py-1 text-xs text-[#94A39E] hover:text-[#F4F6F4] rounded bg-[#0F251E] border border-[#F4F6F4]/10 transition"
          >
            Cancel
          </button>
        </div>
      )}

      {/* State 4: Model Loading */}
      {isModelLoading && isStreaming && (
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#16382D]/80 border border-[#F4F6F4]/15 shadow backdrop-blur">
          <Loader2 className="w-3.5 h-3.5 text-[#5EEAD4] animate-spin" />
          <span className="text-xs text-[#F4F6F4]">Loading pose model (on this device)...</span>
        </div>
      )}

      {/* State: Multiple Persons Detected */}
      {isStreaming && multiplePersons && (
        <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#16382D]/90 border border-[#C5A059]/40 text-[#C5A059] text-xs font-medium shadow backdrop-blur animate-in fade-in">
          <Users className="w-3.5 h-3.5" />
          <span>2 People in View (Coaching Primary)</span>
        </div>
      )}


      {/* State 6: Person Not Detected */}
      {isStreaming && !isModelLoading && !isPersonDetected && (
        <div className="z-20 flex flex-col items-center gap-2 p-5 rounded-2xl bg-[#0F251E]/85 border border-[#F4F6F4]/10 shadow-lg backdrop-blur">
          <UserX className="w-7 h-7 text-[#94A39E]" />
          <h4 className="text-sm font-semibold text-[#F4F6F4]">Step into camera view</h4>
          <p className="text-xs text-[#94A39E]">Position yourself anywhere in the camera view to begin tracking</p>
        </div>
      )}

      {/* State 7: Low Confidence Tracking (Placed in top corner, suppressed when instructions active) */}
      {isStreaming && isPersonDetected && isLowConfidence && !primaryInstruction && !framingInstruction && (
        <div className="absolute top-20 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FF9F43]/20 border border-[#FF9F43]/40 text-[#FF9F43] shadow backdrop-blur animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="text-xs font-medium">Hold still or improve lighting</span>
        </div>
      )}

      {/* Live Hold Progress Cue */}
      {isStreaming && holdProgress > 0 && !isStableMatched && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-[#0F251E]/95 border border-[#C5A059]/60 text-[#C5A059] shadow-2xl backdrop-blur animate-in fade-in">
          <div className="w-3.5 h-3.5 rounded-full border-2 border-[#C5A059] border-t-transparent animate-spin" />
          <span className="text-xs font-bold tracking-wide">
            AI Auto-Shutter: Holding steady ({Math.round(holdProgress * 100)}%)
          </span>
        </div>
      )}

      {/* On-Video Framing Instruction Cue */}
      {isStreaming && isPersonDetected && framingInstruction && (
        <div className="absolute bottom-7 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-6 py-3 rounded-full bg-[#0F251E]/95 border-2 border-[#FF9F43] text-[#F4F6F4] shadow-2xl backdrop-blur-md animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-[#FF9F43] shrink-0" />
          <span className="text-sm md:text-base font-bold text-[#FF9F43] tracking-wide">{framingInstruction}</span>
        </div>
      )}

      {/* Floating Directorial Guidance HUD Pill on Video Viewport (Highly Legible From Distance) */}
      {isStreaming && isPersonDetected && primaryInstruction && !framingInstruction && (
        <div className="absolute bottom-7 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3.5 px-7 py-3.5 rounded-full bg-[#0F251E]/95 border-2 border-[#FF9F43] shadow-2xl backdrop-blur-md animate-in fade-in duration-200 pointer-events-none">
          <AlertCircle className="w-5 h-5 text-[#FF9F43] shrink-0 animate-pulse" />
          <span className="text-sm md:text-base font-bold text-[#F4F6F4] tracking-wide drop-shadow-sm">
            {primaryInstruction.text}
          </span>
        </div>
      )}

      {/* On-Video Target Matched Celebration Banner */}
      {isStreaming && isStableMatched && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-5 py-3 rounded-2xl bg-[#0F251E]/95 border-2 border-[#4ADE80] text-[#F4F6F4] shadow-2xl backdrop-blur animate-in fade-in zoom-in-95 duration-200">
          <div className="w-9 h-9 rounded-full bg-[#4ADE80]/20 flex items-center justify-center text-[#4ADE80] shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-[#4ADE80] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 fill-current" />
              AI Shutter Captured!
            </div>
            <div className="text-xs text-[#F4F6F4]">Studio portrait saved to gallery</div>
          </div>
          <div className="flex items-center gap-2 ml-2">
            {onOpenGallery && (
              <button
                onClick={onOpenGallery}
                className="px-3 py-1.5 text-xs font-bold bg-[#4ADE80] text-[#0F251E] rounded-xl hover:bg-[#5CEE90] transition shadow cursor-pointer"
              >
                View Gallery
              </button>
            )}
            {onNextPose && (
              <button
                onClick={onNextPose}
                className="px-3 py-1.5 text-xs font-medium border border-[#F4F6F4]/20 text-[#F4F6F4] rounded-xl hover:bg-[#16382D] transition cursor-pointer"
              >
                Next Pose
              </button>
            )}
          </div>
        </div>
      )}

      {/* Studio Camera Shutter & Quick Gallery Action (Floating Bottom-Right) */}
      {isStreaming && (
        <div className="absolute bottom-6 right-6 z-20 flex flex-col items-end gap-2.5">
          {onManualCapture && (
            <button
              onClick={onManualCapture}
              className="group flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-[#C5A059] text-[#0F251E] font-bold text-xs shadow-2xl hover:bg-[#D4B473] hover:scale-105 active:scale-95 transition cursor-pointer"
              title="Snap High-Resolution Studio Headshot"
            >
              <Camera className="w-4 h-4 fill-current" />
              <span className="hidden sm:inline">Snap Headshot</span>
            </button>
          )}

          {snapshotsCount !== undefined && snapshotsCount > 0 && onOpenGallery && (
            <button
              onClick={onOpenGallery}
              className="flex items-center gap-2 p-1.5 pr-3 rounded-2xl bg-[#0F251E]/90 border border-[#5EEAD4]/40 text-[#F4F6F4] text-xs shadow-xl backdrop-blur hover:border-[#5EEAD4] transition cursor-pointer"
              title="Open Studio Gallery"
            >
              {lastSnapshotDataUrl ? (
                <img
                  src={lastSnapshotDataUrl}
                  alt="Thumbnail"
                  className="w-7 h-7 rounded-xl object-cover border border-[#5EEAD4]/30"
                />
              ) : (
                <div className="w-7 h-7 rounded-xl bg-[#5EEAD4]/20 flex items-center justify-center text-[#5EEAD4]">
                  <Camera className="w-3.5 h-3.5" />
                </div>
              )}
              <span className="font-semibold text-[11px] text-[#5EEAD4]">
                {snapshotsCount} {snapshotsCount === 1 ? 'Shot' : 'Shots'}
              </span>
            </button>
          )}
        </div>
      )}

      {/* State 11: Camera Errors */}
      {(cameraState === 'permission_denied' ||
        cameraState === 'no_device_found' ||
        cameraState === 'device_in_use' ||
        cameraState === 'device_lost' ||
        cameraState === 'error') && (
        <div className="z-20 max-w-sm p-6 text-center rounded-2xl bg-[#16382D] border border-[#F0746B]/40 shadow-2xl space-y-3">
          <CameraOff className="w-10 h-10 text-[#F0746B] mx-auto" />
          <h3 className="text-base font-semibold text-[#F4F6F4] capitalize">
            {cameraState.replace(/_/g, ' ')}
          </h3>
          <p className="text-xs text-[#94A39E]">
            {cameraState === 'permission_denied'
              ? 'Camera permission was denied. Please allow camera permissions in Windows settings and reload.'
              : cameraState === 'device_in_use'
              ? 'Camera is in use by another program (Zoom, Teams, etc.). Close other apps and retry.'
              : cameraState === 'device_lost'
              ? 'The camera device was disconnected.'
              : 'Unable to start camera stream.'}
          </p>
          <button
            onClick={onRetryCamera}
            className="px-4 py-2 text-xs font-semibold bg-[#C5A059] text-[#0F251E] rounded-xl hover:bg-[#D4B473] transition shadow"
          >
            Retry Connection
          </button>
        </div>
      )}
    </div>
  );
};
