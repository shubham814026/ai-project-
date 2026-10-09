import React from 'react';
import { PoseRecommendation } from '../core/library/recommendationEngine';
import { Sparkles, Check, X, Camera, Zap } from 'lucide-react';

interface SuggestPoseModalProps {
  isOpen: boolean;
  onClose: () => void;
  recommendations: PoseRecommendation[];
  onSelectPose: (pose: PoseRecommendation) => void;
}

export const SuggestPoseModal: React.FC<SuggestPoseModalProps> = ({
  isOpen,
  onClose,
  recommendations,
  onSelectPose,
}) => {
  if (!isOpen) return null;

  const topMatch = recommendations[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-[#16382D] border border-[#C5A059]/40 rounded-3xl p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#C5A059]/20 border border-[#C5A059]/40 flex items-center justify-center text-[#C5A059] shadow">
              <Sparkles className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#F4F6F4] flex items-center gap-2">
                Pose Suggested From Live Frame
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#4ADE80]/20 text-[#4ADE80] border border-[#4ADE80]/30">
                  Live Match
                </span>
              </h2>
              <p className="text-xs text-[#94A39E]">
                We analyzed your current posture and found the closest matching exercises:
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#94A39E] hover:text-[#F4F6F4] rounded-lg transition"
            aria-label="Close suggestions"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Recommendation Hero Card */}
        {topMatch && (
          <div className="p-4 rounded-2xl bg-[#0F251E] border-2 border-[#C5A059] shadow-xl relative overflow-hidden">
            <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#C5A059] text-[#0F251E] text-xs font-bold shadow">
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Best Match: {topMatch.matchPercentage}%</span>
            </div>

            <div className="flex gap-4 items-center">
              <div
                className="w-20 h-24 rounded-xl overflow-hidden shrink-0 border border-[#C5A059]/30 bg-[#16382D]"
                dangerouslySetInnerHTML={{ __html: topMatch.pose.thumbnail }}
              />
              <div className="space-y-1.5 flex-1 pr-24">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#C5A059]">
                  Highest Similarity
                </span>
                <h3 className="text-base font-bold text-[#F4F6F4]">{topMatch.pose.name}</h3>
                <p className="text-xs text-[#94A39E] capitalize">
                  {topMatch.pose.category} • {topMatch.pose.difficulty}
                </p>
                <p className="text-xs text-[#F4F6F4]/90 font-medium">{topMatch.reason}</p>

                {/* Match bar */}
                <div className="w-full h-2 rounded-full bg-[#16382D] overflow-hidden mt-2">
                  <div
                    className="h-full bg-gradient-to-r from-[#C5A059] to-[#4ADE80] rounded-full transition-all duration-300"
                    style={{ width: `${topMatch.matchPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                onSelectPose(topMatch);
                onClose();
              }}
              className="mt-4 w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-[#C5A059] text-[#0F251E] hover:bg-[#D4B473] transition flex items-center justify-center gap-2 shadow-lg"
            >
              <Check className="w-4 h-4" />
              <span>Adopt This Pose & Start Coaching</span>
            </button>
          </div>
        )}

        {/* Other Close Candidates */}
        <div className="space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94A39E]">
            Other Close Candidates
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {recommendations.slice(1, 4).map((rec) => (
              <div
                key={rec.pose.id}
                onClick={() => {
                  onSelectPose(rec);
                  onClose();
                }}
                className="p-3 rounded-xl bg-[#0F251E]/60 border border-[#F4F6F4]/10 hover:border-[#C5A059]/50 hover:bg-[#0F251E] cursor-pointer transition flex gap-3 items-center"
              >
                <div
                  className="w-12 h-14 rounded-lg overflow-hidden shrink-0 border border-[#F4F6F4]/10 bg-[#16382D]"
                  dangerouslySetInnerHTML={{ __html: rec.pose.thumbnail }}
                />
                <div className="overflow-hidden flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[#F4F6F4] truncate">{rec.pose.name}</h4>
                    <span className="text-xs font-bold text-[#4ADE80] tabular-nums">
                      {rec.matchPercentage}%
                    </span>
                  </div>
                  <p className="text-[10px] text-[#94A39E] capitalize truncate">
                    {rec.pose.category} • {rec.pose.difficulty}
                  </p>
                  <p className="text-[10px] text-[#94A39E]/80 truncate mt-0.5">{rec.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-2 border-t border-[#F4F6F4]/10 flex items-center justify-between text-[11px] text-[#94A39E]">
          <span className="flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-[#5EEAD4]" />
            Continuous real-time posture analysis
          </span>
          <button
            onClick={onClose}
            className="text-xs font-semibold text-[#94A39E] hover:text-[#F4F6F4] transition"
          >
            Keep Current Pose
          </button>
        </div>
      </div>
    </div>
  );
};
