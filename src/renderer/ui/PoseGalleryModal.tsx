import React, { useState } from 'react';
import { ReferencePose } from '../core/library/types';
import { SEED_POSES } from '../core/library/seedPoses';
import { X, Search, Check } from 'lucide-react';

interface PoseGalleryModalProps {
  currentPoseId: string | null;
  onSelectPose: (pose: ReferencePose) => void;
  onClose: () => void;
}

export const PoseGalleryModal: React.FC<PoseGalleryModalProps> = ({
  currentPoseId,
  onSelectPose,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [framingFilter, setFramingFilter] = useState<'all' | 'upper-body' | 'full-body'>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all');

  const filteredPoses = SEED_POSES.filter((pose) => {
    const matchesSearch =
      pose.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pose.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pose.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesFraming =
      framingFilter === 'all' || pose.framing === 'either' || pose.framing === framingFilter;

    const matchesDifficulty =
      difficultyFilter === 'all' || pose.difficulty === difficultyFilter;

    return matchesSearch && matchesFraming && matchesDifficulty;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[85vh] bg-[#16382D] border border-[#F4F6F4]/15 rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-[#F4F6F4]/10 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#F4F6F4]">Exercise & Pose Library</h2>
            <p className="text-xs text-[#94A39E]">Select a therapeutic exercise or postural assessment form</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#94A39E] hover:text-[#F4F6F4] hover:bg-[#0F251E] rounded-lg transition"
            aria-label="Close pose library"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filters */}
        <div className="p-4 border-b border-[#F4F6F4]/10 bg-[#0F251E]/40 flex flex-wrap gap-3 items-center justify-between">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-[#94A39E] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search poses, tags, categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#16382D] border border-[#F4F6F4]/15 rounded-xl pl-9 pr-3 py-1.5 text-xs text-[#F4F6F4] placeholder-[#94A39E] focus:outline-none focus:border-[#C5A059]"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[#16382D] border border-[#F4F6F4]/10 rounded-xl p-1 text-xs">
              <span className="text-[11px] text-[#94A39E] px-1.5">Framing:</span>
              {(['all', 'upper-body', 'full-body'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setFramingFilter(mode)}
                  className={`px-2 py-0.5 rounded-lg capitalize transition ${
                    framingFilter === mode
                      ? 'bg-[#C5A059] text-[#0F251E] font-semibold'
                      : 'text-[#94A39E] hover:text-[#F4F6F4]'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 bg-[#16382D] border border-[#F4F6F4]/10 rounded-xl p-1 text-xs">
              <span className="text-[11px] text-[#94A39E] px-1.5">Level:</span>
              {(['all', 'beginner', 'intermediate', 'advanced'] as const).map((diff) => (
                <button
                  key={diff}
                  onClick={() => setDifficultyFilter(diff)}
                  className={`px-2 py-0.5 rounded-lg capitalize transition ${
                    difficultyFilter === diff
                      ? 'bg-[#C5A059] text-[#0F251E] font-semibold'
                      : 'text-[#94A39E] hover:text-[#F4F6F4]'
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Pose Cards Grid */}
        <div className="p-6 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filteredPoses.map((pose) => {
            const isSelected = pose.id === currentPoseId;
            return (
              <div
                key={pose.id}
                onClick={() => {
                  onSelectPose(pose);
                  onClose();
                }}
                className={`group cursor-pointer bg-[#0F251E]/60 border rounded-2xl p-3 flex flex-col justify-between transition relative hover:border-[#C5A059] hover:shadow-lg ${
                  isSelected ? 'border-[#C5A059] ring-2 ring-[#C5A059]/40 bg-[#16382D]' : 'border-[#F4F6F4]/10'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#C5A059] text-[#0F251E] flex items-center justify-center text-xs font-bold shadow">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className="w-full aspect-[4/5] rounded-xl overflow-hidden mb-2.5 bg-[#16382D] border border-[#F4F6F4]/5 flex items-center justify-center"
                  dangerouslySetInnerHTML={{ __html: pose.thumbnail }}
                />

                <div>
                  <h4 className="text-xs font-semibold text-[#F4F6F4] group-hover:text-[#C5A059] transition truncate">
                    {pose.name}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-1 text-[10px] text-[#94A39E]">
                    <span className="capitalize">{pose.category}</span>
                    <span>•</span>
                    <span className="capitalize">{pose.difficulty}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
