import React from 'react';
import { ReferencePose } from '../core/library/types';
import { CorrectionInstruction } from '../core/guidance/correctionGenerator';
import { PoseRecommendation } from '../core/library/recommendationEngine';
import { CheckCircle2, AlertCircle, Sparkles, ChevronRight, HelpCircle, Layers } from 'lucide-react';

interface GuidancePanelProps {
  selectedPose: ReferencePose | null;
  overallScore: number;
  coveragePassed: boolean;
  primaryInstruction: CorrectionInstruction | null;
  secondaryInstructions: CorrectionInstruction[];
  framingInstruction: string | null;
  holdProgress: number;
  isStableMatched: boolean;
  bestLiveMatch?: PoseRecommendation | null;
  onOpenGallery: () => void;
  onSuggestPose: () => void;
  onNextPose: () => void;
  onSelectPose?: (pose: ReferencePose) => void;
}

export const GuidancePanel: React.FC<GuidancePanelProps> = ({
  selectedPose,
  overallScore,
  coveragePassed,
  primaryInstruction,
  secondaryInstructions,
  framingInstruction,
  holdProgress,
  isStableMatched,
  bestLiveMatch,
  onOpenGallery,
  onSuggestPose,
  onNextPose,
  onSelectPose,
}) => {
  return (
    <aside className="w-80 md:w-96 bg-[#16382D] border-l border-[#F4F6F4]/10 flex flex-col justify-between p-4 overflow-y-auto select-none">
      {/* Target Pose Card */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#94A39E]">Target Pose</span>
          <button
            onClick={onOpenGallery}
            className="text-xs font-medium text-[#C5A059] hover:text-[#D4B473] flex items-center gap-1 transition"
          >
            Change Pose <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {selectedPose ? (
          <div className="p-3 bg-[#0F251E]/60 border border-[#F4F6F4]/10 rounded-xl flex gap-3 items-center">
            <div
              className="w-16 h-20 rounded-lg overflow-hidden shrink-0 border border-[#F4F6F4]/10 bg-[#16382D]"
              dangerouslySetInnerHTML={{ __html: selectedPose.thumbnail }}
            />
            <div className="overflow-hidden">
              <h3 className="text-sm font-semibold text-[#F4F6F4] truncate">{selectedPose.name}</h3>
              <p className="text-xs text-[#94A39E] capitalize">{selectedPose.category} • {selectedPose.difficulty}</p>
              <p className="text-[11px] text-[#94A39E]/80 line-clamp-2 mt-1">{selectedPose.description}</p>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-[#0F251E]/60 border border-dashed border-[#F4F6F4]/15 rounded-xl text-center">
            <Layers className="w-8 h-8 text-[#94A39E] mx-auto mb-2" />
            <p className="text-xs text-[#94A39E]">No target pose selected</p>
            <button
              onClick={onOpenGallery}
              className="mt-3 px-3 py-1.5 text-xs font-semibold bg-[#C5A059] text-[#0F251E] rounded-lg shadow"
            >
              Pick a Pose
            </button>
          </div>
        )}

        {/* Live Stance Detected Notification */}
        {bestLiveMatch && bestLiveMatch.pose.id !== selectedPose?.id && bestLiveMatch.matchPercentage >= 50 && (
          <div className="p-3 bg-[#4ADE80]/15 border border-[#4ADE80]/40 rounded-xl space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#4ADE80] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 fill-current" />
                Live Stance Detected
              </span>
              <span className="font-bold text-[#4ADE80] tabular-nums">
                {bestLiveMatch.matchPercentage}% match
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-[#F4F6F4] font-medium truncate">
                {bestLiveMatch.pose.name}
              </span>
              {onSelectPose && (
                <button
                  onClick={() => onSelectPose(bestLiveMatch.pose)}
                  className="px-2.5 py-1 text-[11px] font-bold bg-[#4ADE80] text-[#0F251E] rounded-lg hover:bg-[#5CEE90] transition shrink-0 shadow"
                >
                  Switch
                </button>
              )}
            </div>
          </div>
        )}

        {/* Pose Match Score Bar */}
        {selectedPose && (
          <div className="p-3 bg-[#0F251E]/60 border border-[#F4F6F4]/10 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1 text-[#94A39E]">
                <span>Pose match</span>
                <span
                  title="Estimated similarity to the reference pose, not accuracy and not a judgement of quality."
                  className="cursor-help"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </span>
              </div>
              <span className="font-bold tabular-nums text-sm text-[#F4F6F4]">
                {coveragePassed ? `${Math.round(overallScore)}%` : '---'}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 rounded-full bg-[#16382D] overflow-hidden border border-[#F4F6F4]/10">
              <div
                className={`h-full transition-all duration-200 rounded-full ${
                  isStableMatched
                    ? 'bg-[#4ADE80]'
                    : overallScore >= 85
                    ? 'bg-[#C5A059]'
                    : 'bg-[#FF9F43]'
                }`}
                style={{ width: coveragePassed ? `${Math.min(100, Math.max(0, overallScore))}%` : '0%' }}
              />
            </div>
          </div>
        )}

        {/* Stable Matched State */}
        {isStableMatched ? (
          <div className="p-4 bg-[#4ADE80]/15 border border-[#4ADE80]/30 rounded-xl space-y-3 animate-in fade-in">
            <div className="flex items-center gap-2 text-[#4ADE80]">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <h4 className="font-semibold text-sm">Target Matched!</h4>
            </div>
            <p className="text-xs text-[#F4F6F4]">
              Excellent! You held a steady match for 1.5 seconds.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={onNextPose}
                className="flex-1 py-1.5 text-xs font-semibold bg-[#4ADE80] text-[#0F251E] rounded-lg shadow hover:bg-[#5CEE90] transition"
              >
                Next Pose
              </button>
              <button
                onClick={onOpenGallery}
                className="px-3 py-1.5 text-xs font-medium border border-[#F4F6F4]/20 text-[#F4F6F4] rounded-lg hover:bg-[#0F251E] transition"
              >
                Browse
              </button>
            </div>
          </div>
        ) : holdProgress > 0 ? (
          /* Hold in progress */
          <div className="p-3 bg-[#C5A059]/15 border border-[#C5A059]/30 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-[#C5A059]">
              <span>Hold steady...</span>
              <span className="tabular-nums">{Math.round(holdProgress * 100)}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[#16382D] overflow-hidden">
              <div
                className="h-full bg-[#C5A059] transition-all duration-100 rounded-full"
                style={{ width: `${holdProgress * 100}%` }}
              />
            </div>
          </div>
        ) : null}

        {/* Coaching Feedback & Instructions */}
        {!isStableMatched && selectedPose && (
          <div className="space-y-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#94A39E]">Corrections</span>

            {/* Framing Guidance */}
            {framingInstruction && (
              <div className="p-3 bg-[#FF9F43]/15 border border-[#FF9F43]/30 rounded-xl flex items-start gap-2.5 text-xs text-[#FF9F43]">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{framingInstruction}</span>
              </div>
            )}

            {/* Primary Instruction */}
            {primaryInstruction && !framingInstruction && (
              <div className="p-3 bg-[#FF9F43]/15 border border-[#FF9F43]/30 rounded-xl flex items-start gap-2.5 text-xs text-[#F4F6F4]">
                <AlertCircle className="w-4 h-4 text-[#FF9F43] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-[#FF9F43] uppercase text-[10px] tracking-wider block">
                    Main Correction
                  </span>
                  <p className="font-medium text-sm mt-0.5">{primaryInstruction.text}</p>
                </div>
              </div>
            )}

            {/* Secondary Instructions */}
            {secondaryInstructions.length > 0 && !framingInstruction && (
              <div className="space-y-1.5">
                {secondaryInstructions.map((sec) => (
                  <div
                    key={sec.id}
                    className="p-2.5 bg-[#0F251E]/40 border border-[#F4F6F4]/10 rounded-lg text-xs text-[#94A39E] flex items-center gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C5A059]" />
                    <span>{sec.text}</span>
                  </div>
                ))}
              </div>
            )}

            {!framingInstruction && !primaryInstruction && coveragePassed && (
              <div className="p-3 bg-[#0F251E]/40 border border-[#F4F6F4]/10 rounded-xl text-center text-xs text-[#94A39E]">
                <span>Pose aligned. Hold still to confirm match.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Suggest a Pose Action */}
      <div className="pt-4 border-t border-[#F4F6F4]/10">
        <button
          onClick={onSuggestPose}
          className="w-full py-2.5 px-3 text-xs font-bold bg-gradient-to-r from-[#C5A059]/20 to-[#4ADE80]/20 border border-[#C5A059]/50 text-[#F4F6F4] hover:border-[#C5A059] hover:bg-[#C5A059]/30 rounded-xl flex items-center justify-center gap-2 transition shadow-lg group"
        >
          <Sparkles className="w-4 h-4 text-[#C5A059] group-hover:text-[#4ADE80] transition fill-current" />
          <span>Auto-Detect & Suggest from Live Frame</span>
        </button>
      </div>
    </aside>
  );
};
