import React, { useEffect, useRef } from 'react';
import { CameraState } from '../core/camera/cameraManager';
import { PoseRecommendation } from '../core/library/recommendationEngine';
import { ReferencePose } from '../core/library/types';
import { Loader2, AlertCircle, UserX, CameraOff, Users, Sparkles } from 'lucide-react';

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
  onAdoptLiveMatch?: (pose: ReferencePose) => void;
  onRetryCamera: () => void;
  onCancelLoading: () => void;
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
  bestLiveMatch,
  currentPoseId,
  onAdoptLiveMatch,
  onRetryCamera,
  onCancelLoading,
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
          display: isStreaming ? 'block' : 'none',
        }}
      />

      {/* Hardware-accelerated Canvas Overlay (never CSS-flipped) */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
      />

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

      {/* Live Stance Match Quick-Action Banner */}
      {isStreaming && isPersonDetected && bestLiveMatch && bestLiveMatch.pose.id !== currentPoseId && bestLiveMatch.matchPercentage >= 55 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#0F251E]/95 border border-[#4ADE80]/50 text-[#F4F6F4] shadow-2xl backdrop-blur animate-in fade-in duration-300">
          <Sparkles className="w-3.5 h-3.5 text-[#4ADE80] fill-current animate-pulse" />
          <span className="text-xs">
            Stance resembles <strong className="text-[#4ADE80] font-semibold">{bestLiveMatch.pose.name}</strong> ({bestLiveMatch.matchPercentage}%)
          </span>
          {onAdoptLiveMatch && (
            <button
              onClick={() => onAdoptLiveMatch(bestLiveMatch.pose)}
              className="ml-1 px-2.5 py-0.5 text-[11px] font-bold bg-[#4ADE80] text-[#0F251E] rounded-full hover:bg-[#5CEE90] transition shadow cursor-pointer"
            >
              Coach This
            </button>
          )}
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

      {/* State 7: Low Confidence Tracking */}
      {isStreaming && isPersonDetected && isLowConfidence && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FF9F43]/20 border border-[#FF9F43]/40 text-[#FF9F43] shadow backdrop-blur">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="text-xs font-medium">Hold still or improve lighting</span>
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
