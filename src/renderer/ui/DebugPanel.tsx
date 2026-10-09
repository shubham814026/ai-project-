import React from 'react';
import { FeatureMatchResult } from '../core/matching/poseMatcher';
import { CorrectionInstruction } from '../core/guidance/correctionGenerator';
import { X, Bug } from 'lucide-react';

interface DebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
  featureResults: FeatureMatchResult[];
  activeCorrections: CorrectionInstruction[];
  score: number;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  isOpen,
  onClose,
  featureResults,
  activeCorrections,
  score,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed top-14 right-0 bottom-7 w-96 bg-[#0F251E]/95 border-l border-[#C5A059]/30 backdrop-blur-md p-4 flex flex-col z-40 select-none text-xs text-[#F4F6F4] shadow-2xl font-mono overflow-hidden">
      <div className="flex items-center justify-between pb-3 border-b border-[#F4F6F4]/10 mb-3">
        <div className="flex items-center gap-2 text-[#C5A059]">
          <Bug className="w-4 h-4" />
          <h3 className="font-bold text-sm">Pose Diagnostics (Ctrl+Shift+D)</h3>
        </div>
        <button onClick={onClose} className="p-1 text-[#94A39E] hover:text-[#F4F6F4] rounded">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mb-3 p-2 bg-[#FF9F43]/10 border border-[#FF9F43]/20 rounded text-[11px] text-[#FF9F43] flex justify-between">
        <span><strong>Notice:</strong> Pose Match (<span className="tabular-nums font-bold">{Math.round(score)}%</span>) is <span className="underline font-bold">uncalibrated</span>.</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3">
        <div>
          <span className="text-[#94A39E] block mb-1 font-semibold">Active Instructions ({activeCorrections.length})</span>
          {activeCorrections.length === 0 ? (
            <p className="text-[#94A39E]/60 text-[11px]">None active</p>
          ) : (
            <div className="space-y-1">
              {activeCorrections.map((inst) => (
                <div key={inst.id} className="p-2 bg-[#16382D] rounded border border-[#F4F6F4]/10 text-[11px]">
                  <div className="text-[#5EEAD4] font-semibold">{inst.text}</div>
                  <div className="text-[#94A39E] mt-0.5">
                    joint: {inst.jointName} (idx: {inst.jointIndex}) | dir: {inst.direction} | r: {inst.r.toFixed(2)} | conf: {(inst.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <span className="text-[#94A39E] block mb-1 font-semibold">Feature Error Deltas ({featureResults.length})</span>
          <div className="space-y-1">
            {featureResults.map((f) => (
              <div
                key={f.featureId}
                className={`p-1.5 rounded border text-[10px] ${
                  f.r > 1.0
                    ? 'bg-[#FF9F43]/15 border-[#FF9F43]/40 text-[#FF9F43]'
                    : 'bg-[#16382D]/40 border-[#F4F6F4]/5 text-[#94A39E]'
                }`}
              >
                <div className="flex justify-between font-bold">
                  <span>{f.featureId}</span>
                  <span className="tabular-nums">r = {f.r.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[9px] mt-0.5">
                  <span>meas: {f.measured.toFixed(1)}</span>
                  <span>target: {f.target.toFixed(1)}</span>
                  <span>tol: ±{f.tolerance}</span>
                  <span>delta: {f.delta.toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
