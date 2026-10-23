import React, { useState } from 'react';
import { ReferencePose } from '../core/library/types';
import { CorrectionInstruction } from '../core/guidance/correctionGenerator';
import { PoseRecommendation } from '../core/library/recommendationEngine';
import { CompositionResult } from '../core/camera/compositionAnalyzer';
import { CheckCircle2, AlertCircle, Sparkles, ChevronRight, HelpCircle, Layers, Camera, Grid, Focus, Maximize2, X } from 'lucide-react';

interface GuidancePanelProps {
  selectedPose: ReferencePose | null;
  overallScore: number;
  coveragePassed: boolean;
  cameraComposition?: CompositionResult | null;
  showRuleOfThirds?: boolean;
  onToggleRuleOfThirds?: () => void;
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
  cameraComposition,
  showRuleOfThirds = true,
  onToggleRuleOfThirds,
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
  const [isImageZoomed, setIsImageZoomed] = useState(false);

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
          <div className="space-y-3">
            {/* Prominent Large Pose Photo Showcase */}
            <div className="p-3 bg-[#0F251E]/75 border border-[#F4F6F4]/10 rounded-2xl space-y-3 shadow-lg">
              <div
                onClick={() => setIsImageZoomed(true)}
                className="group relative w-full aspect-[4/5] rounded-xl overflow-hidden bg-[#16382D] border-2 border-[#C5A059]/40 cursor-pointer shadow-md"
                title="Click to view full-size photo"
              >
                {selectedPose.sourceImage ? (
                  <img
                    src={selectedPose.sourceImage}
                    alt={selectedPose.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500 ease-out"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                      const fallback = e.currentTarget.parentElement?.querySelector('.panel-svg-fallback');
                      if (fallback) (fallback as HTMLElement).style.display = 'flex';
                    }}
                  />
                ) : null}

                {/* SVG Fallback if image fails or missing */}
                <div
                  className="panel-svg-fallback w-full h-full flex flex-col items-center justify-center p-4 text-center bg-[#16382D]"
                  style={{ display: selectedPose.sourceImage ? 'none' : 'flex' }}
                >
                  <div
                    className="w-24 h-24 mb-2 flex items-center justify-center"
                    dangerouslySetInnerHTML={{ __html: selectedPose.thumbnail }}
                  />
                  <span className="text-xs text-[#94A39E] font-medium">Reference Skeleton</span>
                </div>

                {/* Top Badges Overlaid on Photo */}
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10 pointer-events-none">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#0F251E]/85 backdrop-blur-md text-[#C5A059] border border-[#C5A059]/30 shadow">
                    {selectedPose.category}
                  </span>
                </div>

                {/* Enlarge / Zoom Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsImageZoomed(true);
                  }}
                  title="Enlarge reference photo"
                  className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-[#0F251E]/85 backdrop-blur-md text-[#F4F6F4] hover:text-[#C5A059] hover:bg-[#0F251E] border border-[#F4F6F4]/10 transition z-10 shadow"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>

                {/* Bottom Gradient Overlay on Photo */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-[#0F251E] via-[#0F251E]/70 to-transparent p-3 pt-8 flex items-center justify-between text-[11px] pointer-events-none">
                  <span className="font-semibold text-[#F4F6F4] capitalize flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#4ADE80]" />
                    {selectedPose.framing} framing
                  </span>
                  <span className="font-bold text-[#C5A059] uppercase text-[10px] tracking-wide px-2 py-0.5 rounded-full bg-[#C5A059]/15 border border-[#C5A059]/30">
                    {selectedPose.difficulty}
                  </span>
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-[#F4F6F4] leading-snug">
                    {selectedPose.name}
                  </h3>
                  <button
                    onClick={onOpenGallery}
                    className="text-[11px] font-semibold text-[#C5A059] hover:text-[#D4B473] shrink-0 transition flex items-center gap-0.5"
                  >
                    Change <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                {selectedPose.description && (
                  <p className="text-[11px] text-[#94A39E] leading-relaxed line-clamp-2">
                    {selectedPose.description}
                  </p>
                )}
              </div>
            </div>

            {/* Key Posture Points */}
            {selectedPose.instructions && selectedPose.instructions.length > 0 && (
              <div className="p-2.5 bg-[#0F251E]/40 border border-[#F4F6F4]/5 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A39E] block">Key Posture Points</span>
                <ul className="space-y-1">
                  {selectedPose.instructions.map((inst, i) => (
                    <li key={i} className="text-[11px] text-[#94A39E] flex items-start gap-1.5 leading-snug">
                      <span className="w-1 h-1 rounded-full bg-[#C5A059] mt-1.5 shrink-0" />
                      <span>{inst}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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

        {/* High-Resolution Zoom Lightbox Modal */}
        {isImageZoomed && selectedPose && (
          <div
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setIsImageZoomed(false)}
          >
            <div
              className="relative max-w-xl w-full bg-[#0F251E] border-2 border-[#C5A059]/50 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Lightbox Header */}
              <div className="p-3.5 border-b border-[#F4F6F4]/10 flex items-center justify-between bg-[#16382D]/80">
                <div>
                  <h3 className="text-sm font-bold text-[#F4F6F4] truncate">{selectedPose.name}</h3>
                  <p className="text-xs text-[#94A39E] capitalize">
                    {selectedPose.category} • {selectedPose.framing} • {selectedPose.difficulty}
                  </p>
                </div>
                <button
                  onClick={() => setIsImageZoomed(false)}
                  className="p-1.5 rounded-lg bg-[#0F251E] text-[#94A39E] hover:text-[#F4F6F4] border border-[#F4F6F4]/10 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Lightbox Photo Preview */}
              <div className="relative flex-1 min-h-[350px] max-h-[65vh] bg-[#07130F] flex items-center justify-center overflow-hidden p-2">
                {selectedPose.sourceImage ? (
                  <img
                    src={selectedPose.sourceImage}
                    alt={selectedPose.name}
                    className="w-full h-full object-contain rounded-lg"
                  />
                ) : (
                  <div
                    className="w-48 h-48"
                    dangerouslySetInnerHTML={{ __html: selectedPose.thumbnail }}
                  />
                )}
              </div>

              {/* Lightbox Guidance Footer */}
              {selectedPose.instructions && selectedPose.instructions.length > 0 && (
                <div className="p-3 bg-[#16382D]/90 border-t border-[#F4F6F4]/10">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#C5A059] block mb-1">
                    Key Posture Alignment Tips
                  </span>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-[#94A39E]">
                    {selectedPose.instructions.map((inst, i) => (
                      <li key={i} className="flex items-start gap-1.5 leading-tight">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#C5A059] mt-1 shrink-0" />
                        <span>{inst}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
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

        {/* Engine 1: Camera Guidance Meter (Always Active) */}
        <div className="p-3 bg-[#0F251E]/60 border border-[#F4F6F4]/10 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-[#94A39E]">
              <Camera className="w-3.5 h-3.5 text-[#C5A059]" />
              <span className="font-semibold text-[#F4F6F4]">Camera Framing</span>
              {cameraComposition && cameraComposition.metrics.shotScale !== 'out-of-frame' && (
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-[#16382D] text-[#C5A059] border border-[#C5A059]/30">
                  {cameraComposition.metrics.shotScale}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {onToggleRuleOfThirds && (
                <button
                  onClick={onToggleRuleOfThirds}
                  title="Toggle Rule-of-Thirds Grid Overlay"
                  className={`p-1 rounded transition text-[10px] flex items-center gap-1 ${
                    showRuleOfThirds
                      ? 'bg-[#C5A059]/20 text-[#C5A059] border border-[#C5A059]/40'
                      : 'text-[#94A39E] hover:text-[#F4F6F4]'
                  }`}
                >
                  <Grid className="w-3 h-3" />
                  <span className="hidden sm:inline">Grid</span>
                </button>
              )}
              <span className="font-bold tabular-nums text-sm text-[#F4F6F4]">
                {cameraComposition ? `${cameraComposition.framingScore}%` : '---'}
              </span>
            </div>
          </div>

          {/* Framing Progress Bar */}
          <div className="w-full h-2 rounded-full bg-[#16382D] overflow-hidden border border-[#F4F6F4]/10">
            <div
              className={`h-full transition-all duration-200 rounded-full ${
                !cameraComposition || cameraComposition.framingScore < 60
                  ? 'bg-[#FF9F43]'
                  : cameraComposition.framingScore >= 80
                  ? 'bg-[#4ADE80]'
                  : 'bg-[#C5A059]'
              }`}
              style={{ width: cameraComposition ? `${cameraComposition.framingScore}%` : '0%' }}
            />
          </div>

          {/* Camera Directorial Cue */}
          <div className="flex items-center justify-between text-[11px] pt-0.5">
            <span className="text-[#94A39E] flex items-center gap-1 truncate pr-2">
              <Focus className="w-3 h-3 text-[#C5A059] shrink-0" />
              <span className="truncate">{cameraComposition ? cameraComposition.guidanceCue : 'Position yourself in frame'}</span>
            </span>
            {cameraComposition && (
              <span
                className={`text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                  cameraComposition.status === 'optimal'
                    ? 'text-[#4ADE80]'
                    : cameraComposition.status === 'acceptable'
                    ? 'text-[#C5A059]'
                    : 'text-[#FF9F43]'
                }`}
              >
                {cameraComposition.status}
              </span>
            )}
          </div>
        </div>

        {/* Engine 2: Pose Match Score Bar */}
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
              <div className="p-3.5 bg-[#FF9F43]/20 border-2 border-[#FF9F43]/40 rounded-xl flex items-start gap-3 text-xs text-[#F4F6F4] shadow-md">
                <AlertCircle className="w-5 h-5 text-[#FF9F43] shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <span className="font-bold text-[#FF9F43] uppercase text-[11px] tracking-wider block">
                    Directorial Cue
                  </span>
                  <p className="font-bold text-base mt-0.5 text-[#F4F6F4]">{primaryInstruction.text}</p>
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
