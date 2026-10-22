import React, { useState } from 'react';
import { StudioSnapshot } from '../core/camera/snapshotTypes';
import { X, Download, Trash2, Camera, Sparkles, ShieldCheck, Eye, Check } from 'lucide-react';

interface SnapshotGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshots: StudioSnapshot[];
  onDeleteSnapshot: (id: string) => void;
  onClearAll: () => void;
}

export const SnapshotGalleryModal: React.FC<SnapshotGalleryModalProps> = ({
  isOpen,
  onClose,
  snapshots,
  onDeleteSnapshot,
  onClearAll,
}) => {
  const [selectedSnapshot, setSelectedSnapshot] = useState<StudioSnapshot | null>(null);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownload = async (snapshot: StudioSnapshot) => {
    const cleanPose = snapshot.poseName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const timestampStr = new Date(snapshot.timestamp).toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `DirectAI_${cleanPose}_${timestampStr}.png`;

    // 1. Electron IPC Direct Save (guarantees real PNG file saved to Downloads, no .tmp file)
    const electronAPI = (window as unknown as { electronAPI?: { saveSnapshot?: (data: string, name: string) => Promise<{ success: boolean; filePath?: string }> } }).electronAPI;
    if (electronAPI && typeof electronAPI.saveSnapshot === 'function') {
      try {
        const res = await electronAPI.saveSnapshot(snapshot.dataUrl, filename);
        if (res && res.success) {
          setDownloadNotice(`Saved to Downloads/${filename}`);
          setTimeout(() => setDownloadNotice(null), 3500);
          return;
        }
      } catch (e) {
        console.warn('[handleDownload Electron fallback]', e);
      }
    }

    // 2. Browser binary Blob download fallback
    try {
      const parts = snapshot.dataUrl.split(',');
      const byteString = atob(parts[1]);
      const mimeString = parts[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      setDownloadNotice(`Downloaded ${filename}`);
      setTimeout(() => setDownloadNotice(null), 3500);
    } catch (err) {
      console.error('[Download error]', err);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in select-none"
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#16382D] border border-[#F4F6F4]/15 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-[#F4F6F4]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F4F6F4]/10 bg-[#0F251E]/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#5EEAD4]/20 border border-[#5EEAD4]/30 flex items-center justify-center text-[#5EEAD4]">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#F4F6F4]">Studio Portrait Gallery</h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#5EEAD4]/20 text-[#5EEAD4] border border-[#5EEAD4]/30">
                  {snapshots.length} {snapshots.length === 1 ? 'Capture' : 'Captures'}
                </span>
                {downloadNotice && (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#4ADE80]/20 text-[#4ADE80] border border-[#4ADE80]/40 flex items-center gap-1 animate-pulse">
                    <Check className="w-3 h-3" />
                    {downloadNotice}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#94A39E]">High-resolution studio headshots captured via AI Auto-Shutter</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {snapshots.length > 0 && (
              <button
                onClick={onClearAll}
                className="px-3 py-1.5 text-xs text-[#F0746B] hover:bg-[#F0746B]/10 rounded-xl transition flex items-center gap-1.5"
                title="Clear all captured snapshots"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-[#94A39E] hover:text-[#F4F6F4] hover:bg-[#0F251E] rounded-xl transition"
              title="Close Gallery"
              aria-label="Close Gallery"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {snapshots.length === 0 ? (
            <div className="py-16 text-center max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-[#0F251E] border border-[#F4F6F4]/10 flex items-center justify-center mx-auto text-[#94A39E]">
                <Camera className="w-8 h-8 opacity-60" />
              </div>
              <div>
                <h4 className="text-base font-bold text-[#F4F6F4]">No Studio Captures Yet</h4>
                <p className="text-xs text-[#94A39E] mt-1 leading-relaxed">
                  Position your camera, achieve optimal Rule-of-Thirds framing, and hold any creator pose for 1.5 seconds.
                  The AI Auto-Shutter will automatically snap high-resolution portraits here!
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold bg-[#C5A059] text-[#0F251E] rounded-xl hover:bg-[#D4B473] transition shadow"
                >
                  Return to Studio Camera
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {snapshots.map((snap) => {
                const dateStr = new Date(snap.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });

                return (
                  <div
                    key={snap.id}
                    className="group relative bg-[#0F251E] border border-[#F4F6F4]/10 hover:border-[#5EEAD4]/40 rounded-2xl overflow-hidden flex flex-col transition duration-200 shadow-lg"
                  >
                    {/* Thumbnail Image */}
                    <div
                      className="relative aspect-video w-full bg-black/40 overflow-hidden cursor-pointer"
                      onClick={() => setSelectedSnapshot(snap)}
                    >
                      <img
                        src={snap.dataUrl}
                        alt={snap.poseName}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                        <button
                          className="px-3 py-1.5 rounded-xl bg-white/20 backdrop-blur text-white text-xs font-medium flex items-center gap-1.5 hover:bg-white/30"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSnapshot(snap);
                          }}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                      </div>

                      {/* Top Badges */}
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-[#0F251E]/80 backdrop-blur text-[10px] font-semibold text-[#F4F6F4] border border-[#F4F6F4]/10">
                        {snap.shotScale}
                      </div>
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-[#5EEAD4]/20 backdrop-blur text-[10px] font-bold text-[#5EEAD4] border border-[#5EEAD4]/30 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>{snap.overallScore}%</span>
                      </div>
                    </div>

                    {/* Meta info */}
                    <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                      <div>
                        <h4 className="text-xs font-bold text-[#F4F6F4] truncate">{snap.poseName}</h4>
                        <div className="flex items-center justify-between text-[11px] text-[#94A39E] mt-0.5">
                          <span>{snap.poseCategory}</span>
                          <span>{dateStr}</span>
                        </div>
                      </div>

                      {/* Quality Breakdown Bars */}
                      <div className="grid grid-cols-2 gap-2 text-[10px] pt-1 border-t border-[#F4F6F4]/5">
                        <div className="flex items-center justify-between">
                          <span className="text-[#94A39E]">Framing:</span>
                          <span className="font-semibold text-[#5EEAD4]">{snap.framingScore}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[#94A39E]">Pose:</span>
                          <span className="font-semibold text-[#C5A059]">{snap.poseScore}%</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 pt-2 border-t border-[#F4F6F4]/10">
                        <button
                          onClick={() => handleDownload(snap)}
                          className="flex-1 py-1.5 px-2 bg-[#C5A059]/15 hover:bg-[#C5A059]/25 text-[#C5A059] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                          title="Download high-resolution PNG snapshot"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download PNG</span>
                        </button>
                        <button
                          onClick={() => onDeleteSnapshot(snap.id)}
                          className="p-1.5 text-[#94A39E] hover:text-[#F0746B] hover:bg-[#F0746B]/10 rounded-xl transition"
                          title="Delete snapshot"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#F4F6F4]/10 bg-[#0F251E]/60 flex items-center justify-between text-xs text-[#94A39E]">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#5EEAD4]" />
            <span>All captures remain strictly in local storage. Zero external uploads.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium border border-[#F4F6F4]/20 text-[#F4F6F4] rounded-xl hover:bg-[#16382D] transition"
          >
            Done
          </button>
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedSnapshot && (
        <div
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4"
          onClick={() => setSelectedSnapshot(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[85vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-3 text-[#F4F6F4]">
              <div>
                <h4 className="text-base font-bold">{selectedSnapshot.poseName}</h4>
                <p className="text-xs text-[#94A39E]">
                  Framing: {selectedSnapshot.framingScore}% &bull; Pose: {selectedSnapshot.poseScore}% &bull; Overall: {selectedSnapshot.overallScore}%
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(selectedSnapshot)}
                  className="px-3 py-1.5 text-xs font-semibold bg-[#C5A059] text-[#0F251E] rounded-xl hover:bg-[#D4B473] flex items-center gap-1.5 shadow"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download High-Res</span>
                </button>
                <button
                  onClick={() => setSelectedSnapshot(null)}
                  className="p-1.5 text-[#94A39E] hover:text-[#F4F6F4] rounded-xl hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <img
              src={selectedSnapshot.dataUrl}
              alt={selectedSnapshot.poseName}
              className="max-h-[75vh] w-auto max-w-full rounded-2xl border border-[#F4F6F4]/20 shadow-2xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};
