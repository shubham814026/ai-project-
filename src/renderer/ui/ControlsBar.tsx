import React from 'react';
import { CameraState, CameraDeviceInfo } from '../core/camera/cameraManager';
import { Play, Pause, Square, FlipHorizontal, Eye, Target, Video, Settings2 } from 'lucide-react';
import { CAMERA_CONFIG } from '../core/settings/constants';

interface ControlsBarProps {
  cameraState: CameraState;
  devices: CameraDeviceInfo[];
  selectedDeviceId: string | null;
  onSelectDevice: (deviceId: string) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  mirror: boolean;
  onToggleMirror: () => void;
  showSkeleton: boolean;
  onToggleSkeleton: () => void;
  showTargetGuide: boolean;
  onToggleTargetGuide: () => void;
  framingMode: 'upper-body' | 'full-body';
  onToggleFramingMode: () => void;
  resolution: { width: number; height: number };
  onChangeResolution: (width: number, height: number) => void;
}

export const ControlsBar: React.FC<ControlsBarProps> = ({
  cameraState,
  devices,
  selectedDeviceId,
  onSelectDevice,
  onStart,
  onPause,
  onResume,
  onStop,
  mirror,
  onToggleMirror,
  showSkeleton,
  onToggleSkeleton,
  showTargetGuide,
  onToggleTargetGuide,
  framingMode,
  onToggleFramingMode,
  resolution,
  onChangeResolution,
}) => {
  const isStreaming = cameraState === 'streaming';
  const isPaused = cameraState === 'paused';
  const isStopped = cameraState === 'stopped' || cameraState === 'uninitialized';

  return (
    <footer className="h-16 border-t border-[#F4F6F4]/10 bg-[#16382D] px-4 flex items-center justify-between select-none gap-4">
      {/* Device and Resolution Pickers */}
      <div className="flex items-center gap-3">
        {/* Device selector */}
        <div className="flex items-center gap-2 bg-[#0F251E]/60 border border-[#F4F6F4]/10 rounded-xl px-2.5 py-1.5 text-xs text-[#F4F6F4]">
          <Video className="w-3.5 h-3.5 text-[#94A39E]" />
          <select
            value={selectedDeviceId ?? ''}
            onChange={(e) => onSelectDevice(e.target.value)}
            disabled={isStreaming}
            className="bg-transparent text-xs text-[#F4F6F4] focus:outline-none cursor-pointer disabled:opacity-60 max-w-[150px] truncate"
            aria-label="Select Camera Device"
          >
            <option value="" className="bg-[#16382D] text-[#F4F6F4]">Default Camera</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId} className="bg-[#16382D] text-[#F4F6F4]">
                {d.label}
              </option>
            ))}
          </select>
        </div>

        {/* Resolution selector */}
        <div className="hidden sm:flex items-center gap-1.5 bg-[#0F251E]/60 border border-[#F4F6F4]/10 rounded-xl px-2.5 py-1.5 text-xs text-[#94A39E]">
          <Settings2 className="w-3.5 h-3.5 text-[#94A39E]" />
          <select
            value={`${resolution.width}x${resolution.height}`}
            onChange={(e) => {
              const [w, h] = e.target.value.split('x').map(Number);
              onChangeResolution(w, h);
            }}
            disabled={isStreaming}
            className="bg-transparent text-xs text-[#F4F6F4] focus:outline-none cursor-pointer disabled:opacity-60"
            aria-label="Select Camera Resolution"
          >
            {CAMERA_CONFIG.SUPPORTED_RESOLUTIONS.map((res) => (
              <option key={res.label} value={`${res.width}x${res.height}`} className="bg-[#16382D] text-[#F4F6F4]">
                {res.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Stream Action Controls */}
      <div className="flex items-center gap-2">
        {isStopped ? (
          <button
            onClick={onStart}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#C5A059] text-[#0F251E] hover:bg-[#D4B473] flex items-center gap-2 shadow transition"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Start Camera</span>
          </button>
        ) : (
          <>
            {isPaused ? (
              <button
                onClick={onResume}
                className="p-2.5 rounded-xl text-xs font-semibold bg-[#4ADE80] text-[#0F251E] hover:bg-[#5CEE90] shadow transition"
                title="Resume Camera"
                aria-label="Resume Camera"
              >
                <Play className="w-4 h-4 fill-current" />
              </button>
            ) : (
              <button
                onClick={onPause}
                className="p-2.5 rounded-xl text-xs font-semibold bg-[#16382D] border border-[#F4F6F4]/20 text-[#F4F6F4] hover:bg-[#0F251E] transition"
                title="Pause Stream"
                aria-label="Pause Camera Stream"
              >
                <Pause className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onStop}
              className="p-2.5 rounded-xl text-xs font-semibold bg-[#F0746B]/20 text-[#F0746B] border border-[#F0746B]/40 hover:bg-[#F0746B]/30 transition"
              title="Stop Camera & Release Tracks"
              aria-label="Stop Camera Stream"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          </>
        )}
      </div>

      {/* View & Overlay Toggles */}
      <div className="flex items-center gap-2">
        {/* Mirror Toggle */}
        <button
          onClick={onToggleMirror}
          className={`p-2 rounded-xl text-xs border transition ${
            mirror
              ? 'bg-[#C5A059]/20 border-[#C5A059]/40 text-[#C5A059]'
              : 'border-[#F4F6F4]/10 text-[#94A39E] hover:text-[#F4F6F4]'
          }`}
          title="Toggle Mirror View"
          aria-label="Toggle Mirror View"
        >
          <FlipHorizontal className="w-4 h-4" />
        </button>

        {/* Skeleton Toggle */}
        <button
          onClick={onToggleSkeleton}
          className={`p-2 rounded-xl text-xs border transition ${
            showSkeleton
              ? 'bg-[#5EEAD4]/20 border-[#5EEAD4]/40 text-[#5EEAD4]'
              : 'border-[#F4F6F4]/10 text-[#94A39E] hover:text-[#F4F6F4]'
          }`}
          title="Toggle Live Skeleton Overlay"
          aria-label="Toggle Skeleton Overlay"
        >
          <Eye className="w-4 h-4" />
        </button>

        {/* Target Guide Toggle */}
        <button
          onClick={onToggleTargetGuide}
          className={`p-2 rounded-xl text-xs border transition ${
            showTargetGuide
              ? 'bg-[#C5A059]/20 border-[#C5A059]/40 text-[#C5A059]'
              : 'border-[#F4F6F4]/10 text-[#94A39E] hover:text-[#F4F6F4]'
          }`}
          title="Toggle Reference Guide Skeleton"
          aria-label="Toggle Target Pose Guide"
        >
          <Target className="w-4 h-4" />
        </button>

        {/* Framing Mode Toggle */}
        <button
          onClick={onToggleFramingMode}
          className="px-2.5 py-1.5 rounded-xl text-xs font-medium border border-[#F4F6F4]/15 bg-[#0F251E]/60 text-[#F4F6F4] hover:border-[#C5A059] transition capitalize"
          title="Toggle Framing View"
          aria-label="Toggle Framing Mode"
        >
          {framingMode === 'upper-body' ? 'Upper-Body' : 'Full-Body'}
        </button>
      </div>
    </footer>
  );
};
