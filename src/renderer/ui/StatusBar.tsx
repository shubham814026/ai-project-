import React from 'react';
import { PerformanceStats } from '../core/perf/performanceMonitor';
import { CameraState } from '../core/camera/cameraManager';
import { AlertTriangle, Activity } from 'lucide-react';

interface StatusBarProps {
  stats: PerformanceStats;
  cameraState: CameraState;
  modelVariant: string;
  multiplePersons: boolean;
  onSwitchPrimaryPerson?: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  stats,
  cameraState,
  modelVariant,
  multiplePersons,
  onSwitchPrimaryPerson,
}) => {
  return (
    <div className="h-7 bg-[#0F251E] border-t border-[#F4F6F4]/10 px-4 flex items-center justify-between text-[11px] text-[#94A39E] select-none">
      <div className="flex items-center gap-4">
        {/* Render FPS */}
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#5EEAD4]" />
          <span>Render:</span>
          <span className="font-semibold text-[#F4F6F4] tabular-nums">{stats.renderFps} fps</span>
        </div>

        {/* Inference Latency & Rate */}
        <div className="flex items-center gap-1.5">
          <Activity className="w-3 h-3 text-[#C5A059]" />
          <span>Inference:</span>
          <span className="font-semibold text-[#F4F6F4] tabular-nums">{stats.inferenceMedianMs} ms</span>
          <span className="text-[#94A39E]/70 tabular-nums">({stats.inferenceRateHz} Hz, p95: {stats.inferenceP95Ms} ms)</span>
        </div>

        {/* Camera Status */}
        <div className="hidden sm:flex items-center gap-1.5">
          <span>Camera:</span>
          <span className="capitalize font-medium text-[#F4F6F4]">{cameraState.replace(/_/g, ' ')}</span>
          <span className="text-[#94A39E]/60">({modelVariant})</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Multi-person notice (Section A6) */}
        {multiplePersons && (
          <button
            onClick={onSwitchPrimaryPerson}
            className="flex items-center gap-1 text-[10px] text-[#FF9F43] bg-[#FF9F43]/15 px-2 py-0.5 rounded-full border border-[#FF9F43]/30 hover:bg-[#FF9F43]/25 transition"
            title="Click to switch active person tracked"
          >
            <span>2 Persons Detected (Click to switch)</span>
          </button>
        )}

        {/* Low performance degraded mode warning (Section A9 state 12) */}
        {stats.isDegradedMode && (
          <div className="flex items-center gap-1 text-[10px] text-[#FF9F43] bg-[#FF9F43]/15 px-2 py-0.5 rounded-full border border-[#FF9F43]/30">
            <AlertTriangle className="w-3 h-3 text-[#FF9F43]" />
            <span>Reduced Mode (Lower resolution recommended)</span>
          </div>
        )}

        {/* Memory stat */}
        {stats.memoryMb > 0 && (
          <div className="hidden md:flex items-center gap-1 tabular-nums">
            <span>RAM:</span>
            <span className="text-[#F4F6F4]">{stats.memoryMb} MB</span>
          </div>
        )}
      </div>
    </div>
  );
};
