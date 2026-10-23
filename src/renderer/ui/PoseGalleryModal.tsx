import React, { useState, useMemo, useEffect } from 'react';
import { ReferencePose } from '../core/library/types';
import { SEED_POSES } from '../core/library/seedPoses';
import { DatasetLoader } from '../core/library/datasetLoader';
import { X, Search, Check, Layers } from 'lucide-react';

interface PoseGalleryModalProps {
  currentPoseId: string | null;
  onSelectPose: (pose: ReferencePose) => void;
  onClose: () => void;
  datasetLoader?: DatasetLoader;
}

export const PoseGalleryModal: React.FC<PoseGalleryModalProps> = ({
  currentPoseId,
  onSelectPose,
  onClose,
  datasetLoader,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [framingFilter, setFramingFilter] = useState<'all' | 'upper-body' | 'full-body'>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all');
  const [personCountFilter, setPersonCountFilter] = useState<'all' | 'solo' | 'duo' | 'trio' | 'group'>('all');
  const [allPoses, setAllPoses] = useState<ReferencePose[]>(SEED_POSES);
  const [categories, setCategories] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState<number>(48);

  // Load dataset poses asynchronously if loader provided
  useEffect(() => {
    if (!datasetLoader) return;

    if (datasetLoader.isDatasetLoaded()) {
      const datasetEntries = datasetLoader.getAllPoses();
      const mapped = datasetEntries.slice(0, 1000).map((d) => datasetLoader.toReferencePose(d));
      setAllPoses([...SEED_POSES, ...mapped]);
      setCategories(datasetLoader.getCategories());
    } else {
      datasetLoader.loadDataset().then((ok) => {
        if (ok) {
          const datasetEntries = datasetLoader.getAllPoses();
          const mapped = datasetEntries.slice(0, 1000).map((d) => datasetLoader.toReferencePose(d));
          setAllPoses([...SEED_POSES, ...mapped]);
          setCategories(datasetLoader.getCategories());
        }
      });
    }
  }, [datasetLoader]);

  const filteredPoses = useMemo(() => {
    return allPoses.filter((pose) => {
      const matchesSearch =
        searchTerm === '' ||
        pose.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pose.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (pose.tags && pose.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase())));

      const matchesCategory =
        selectedCategory === 'all' || pose.category === selectedCategory;

      const matchesFraming =
        framingFilter === 'all' || pose.framing === 'either' || pose.framing === framingFilter;

      const matchesDifficulty =
        difficultyFilter === 'all' || pose.difficulty === difficultyFilter;

      const matchesPersonCount =
        personCountFilter === 'all' ||
        (pose.tags && pose.tags.includes(personCountFilter));

      return matchesSearch && matchesCategory && matchesFraming && matchesDifficulty && matchesPersonCount;
    });
  }, [allPoses, searchTerm, selectedCategory, framingFilter, difficultyFilter, personCountFilter]);

  const displayedPoses = useMemo(() => {
    return filteredPoses.slice(0, visibleCount);
  }, [filteredPoses, visibleCount]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-5xl max-h-[90vh] bg-[#16382D] border border-[#C5A059]/40 rounded-3xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[#F4F6F4]/10 flex items-center justify-between bg-[#0F251E]/60">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-[#F4F6F4]">Pose & Reference Library</h2>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#C5A059]/20 text-[#C5A059] border border-[#C5A059]/30">
                {filteredPoses.length} Poses Available
              </span>
            </div>
            <p className="text-xs text-[#94A39E] mt-0.5">
              Select any photography reference or assessment form to coach against live in the studio
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#94A39E] hover:text-[#F4F6F4] hover:bg-[#16382D] rounded-xl transition"
            aria-label="Close pose library"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filters */}
        <div className="p-4 border-b border-[#F4F6F4]/10 bg-[#0F251E]/40 flex flex-wrap gap-3 items-center justify-between">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-[#94A39E] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search poses, tags, categories..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setVisibleCount(48);
              }}
              className="w-full bg-[#16382D] border border-[#F4F6F4]/15 rounded-xl pl-9 pr-3 py-2 text-xs text-[#F4F6F4] placeholder-[#94A39E] focus:outline-none focus:border-[#C5A059]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter */}
            {categories.length > 0 && (
              <div className="flex items-center gap-1 bg-[#16382D] border border-[#F4F6F4]/10 rounded-xl px-2 py-1 text-xs">
                <Layers className="w-3.5 h-3.5 text-[#C5A059]" />
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setVisibleCount(48);
                  }}
                  className="bg-transparent text-xs text-[#F4F6F4] focus:outline-none cursor-pointer pr-1"
                >
                  <option value="all" className="bg-[#16382D] text-[#F4F6F4]">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat} className="bg-[#16382D] text-[#F4F6F4]">
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Person Count Filter */}
            <div className="flex items-center gap-1 bg-[#16382D] border border-[#F4F6F4]/10 rounded-xl p-1 text-xs">
              <span className="text-[11px] text-[#94A39E] px-1.5">Group:</span>
              {(['all', 'solo', 'duo', 'trio', 'group'] as const).map((cnt) => (
                <button
                  key={cnt}
                  onClick={() => {
                    setPersonCountFilter(cnt);
                    setVisibleCount(48);
                  }}
                  className={`px-2 py-1 rounded-lg capitalize transition text-[11px] ${
                    personCountFilter === cnt
                      ? 'bg-[#C5A059] text-[#0F251E] font-bold shadow'
                      : 'text-[#94A39E] hover:text-[#F4F6F4]'
                  }`}
                >
                  {cnt === 'all' ? 'All' : cnt === 'solo' ? '1 Solo' : cnt === 'duo' ? '2 Duo' : cnt === 'trio' ? '3 Trio' : '4+ Group'}
                </button>
              ))}
            </div>

            {/* Framing Filter */}
            <div className="flex items-center gap-1 bg-[#16382D] border border-[#F4F6F4]/10 rounded-xl p-1 text-xs">
              <span className="text-[11px] text-[#94A39E] px-1.5">Framing:</span>
              {(['all', 'upper-body', 'full-body'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    setFramingFilter(mode);
                    setVisibleCount(48);
                  }}
                  className={`px-2 py-1 rounded-lg capitalize transition text-[11px] ${
                    framingFilter === mode
                      ? 'bg-[#C5A059] text-[#0F251E] font-bold shadow'
                      : 'text-[#94A39E] hover:text-[#F4F6F4]'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Difficulty Filter */}
            <div className="flex items-center gap-1 bg-[#16382D] border border-[#F4F6F4]/10 rounded-xl p-1 text-xs">
              <span className="text-[11px] text-[#94A39E] px-1.5">Level:</span>
              {(['all', 'beginner', 'intermediate'] as const).map((diff) => (
                <button
                  key={diff}
                  onClick={() => {
                    setDifficultyFilter(diff);
                    setVisibleCount(48);
                  }}
                  className={`px-2 py-1 rounded-lg capitalize transition text-[11px] ${
                    difficultyFilter === diff
                      ? 'bg-[#C5A059] text-[#0F251E] font-bold shadow'
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
        <div className="p-6 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {displayedPoses.map((pose) => {
            const isSelected = pose.id === currentPoseId;
            return (
              <div
                key={pose.id}
                onClick={() => {
                  onSelectPose(pose);
                  onClose();
                }}
                className={`group cursor-pointer bg-[#0F251E]/70 border rounded-2xl p-3 flex flex-col justify-between transition relative hover:border-[#C5A059] hover:shadow-xl hover:-translate-y-0.5 ${
                  isSelected
                    ? 'border-[#C5A059] ring-2 ring-[#C5A059]/40 bg-[#16382D]'
                    : 'border-[#F4F6F4]/10'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#C5A059] text-[#0F251E] flex items-center justify-center text-xs font-bold shadow z-10">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}

                <div className="relative w-full aspect-[4/5] rounded-xl overflow-hidden mb-2.5 bg-[#16382D] border border-[#F4F6F4]/10 flex items-center justify-center">
                  {pose.sourceImage ? (
                    <img
                      src={pose.sourceImage}
                      alt={pose.name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                        const fallback = e.currentTarget.parentElement?.querySelector('.gallery-svg-thumb');
                        if (fallback) (fallback as HTMLElement).style.display = 'block';
                      }}
                    />
                  ) : null}
                  <div
                    className="gallery-svg-thumb w-full h-full"
                    style={{ display: pose.sourceImage ? 'none' : 'block' }}
                    dangerouslySetInnerHTML={{ __html: pose.thumbnail }}
                  />
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-[#F4F6F4] group-hover:text-[#C5A059] transition truncate">
                    {pose.name}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-1 text-[10px] text-[#94A39E]">
                    <span className="capitalize truncate max-w-[100px]">{pose.category}</span>
                    <span>•</span>
                    <span className="capitalize">{pose.difficulty}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Load More Button if filtered items exceed visibleCount */}
        {filteredPoses.length > visibleCount && (
          <div className="p-3 border-t border-[#F4F6F4]/10 bg-[#0F251E]/60 flex justify-center">
            <button
              onClick={() => setVisibleCount((prev) => prev + 48)}
              className="py-1.5 px-4 rounded-xl text-xs font-semibold bg-[#16382D] border border-[#C5A059]/40 text-[#C5A059] hover:bg-[#C5A059] hover:text-[#0F251E] transition shadow"
            >
              Load More Poses ({filteredPoses.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
