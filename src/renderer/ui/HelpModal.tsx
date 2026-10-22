import React, { useState } from 'react';
import { X, BookOpen, Sparkles, ShieldCheck, Keyboard, CheckCircle2, Eye, Target, Cpu } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'quickstart' | 'ai' | 'legend' | 'checklist' | 'privacy'>('quickstart');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl max-h-[88vh] bg-[#16382D] border border-[#F4F6F4]/15 rounded-3xl flex flex-col shadow-2xl overflow-hidden select-none">
        {/* Header */}
        <div className="p-5 border-b border-[#F4F6F4]/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#C5A059]/20 border border-[#C5A059]/40 flex items-center justify-center text-[#C5A059] shadow">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#F4F6F4] flex items-center gap-2">
                AI Pose Recommendation & Camera Guidance Guide
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#5EEAD4]/20 text-[#5EEAD4] border border-[#5EEAD4]/30">
                  DirectAI Studio v2.0
                </span>
              </h2>
              <p className="text-xs text-[#94A39E]">DirectAI Studio: Dual-Engine Camera Framing & Kinematic Posture Engine</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#94A39E] hover:text-[#F4F6F4] hover:bg-[#0F251E] rounded-xl transition"
            aria-label="Close help"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#F4F6F4]/10 bg-[#0F251E]/50 px-5 gap-2 overflow-x-auto text-xs">
          {[
            { id: 'quickstart', label: 'Quick Start & Shortcuts', icon: Keyboard },
            { id: 'ai', label: 'AI Architecture', icon: Cpu },
            { id: 'legend', label: 'Display & Overlay Legend', icon: Eye },
            { id: 'checklist', label: 'Evaluation Checklist', icon: CheckCircle2 },
            { id: 'privacy', label: 'Privacy & Security', icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`py-3 px-3 font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
                  isActive
                    ? 'border-[#C5A059] text-[#C5A059]'
                    : 'border-transparent text-[#94A39E] hover:text-[#F4F6F4]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-[#F4F6F4]/90 leading-relaxed">
          {activeTab === 'quickstart' && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-[#F4F6F4] mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#5EEAD4]" />
                  How to Use KinoAssist Tele-Rehab
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-[#94A39E]">
                  <li><strong className="text-[#F4F6F4]">Start Camera:</strong> Click "Start Camera & Assessment" or press <kbd className="px-1.5 py-0.5 rounded bg-[#0F251E] border border-[#F4F6F4]/20 text-[#F4F6F4] font-mono">Space</kbd> to activate your webcam.</li>
                  <li><strong className="text-[#F4F6F4]">Choose Target Exercise:</strong> Pick a form from the Exercise Library (Lumbar Extension, Shoulder Abduction, Rotator Cuff ROM) or click "Auto-Detect & Suggest" to let AI find the closest match.</li>
                  <li><strong className="text-[#F4F6F4]">Align with Guide Skeleton:</strong> Follow the Antique Brass guide skeleton displayed on your live video.</li>
                  <li><strong className="text-[#F4F6F4]">Follow Biomechanical Feedback:</strong> Observe real-time Warm Amber arrows pointing to unaligned joints and follow concise joint angle cues (bend/straighten).</li>
                  <li><strong className="text-[#F4F6F4]">Isometric Hold (1.5s):</strong> Once your posture similarity reaches &ge; 85%, hold steady for 1.5 seconds until the green verification banner completes.</li>
                </ol>
              </div>

              <div>
                <h3 className="text-sm font-bold text-[#F4F6F4] mb-3 flex items-center gap-2">
                  <Keyboard className="w-4 h-4 text-[#5EEAD4]" />
                  Keyboard Shortcuts
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { key: 'Space', desc: 'Pause / Resume / Start camera stream' },
                    { key: 'C', desc: 'Toggle Rule-of-Thirds Composition Grid' },
                    { key: 'M', desc: 'Toggle Camera Mirror Mode' },
                    { key: 'S', desc: 'Toggle Live Skeleton Overlay' },
                    { key: 'G', desc: 'Toggle Target Guide Skeleton' },
                    { key: 'Ctrl + Shift + D', desc: 'Toggle Hidden Biomechanical Diagnostics' },
                    { key: 'T', desc: 'Toggle Alignment & Test Pattern Grid' },
                  ].map((s) => (
                    <div key={s.key} className="p-2.5 bg-[#0F251E]/60 border border-[#F4F6F4]/10 rounded-xl flex items-center justify-between">
                      <span className="text-[#94A39E]">{s.desc}</span>
                      <kbd className="px-2 py-0.5 rounded bg-[#16382D] border border-[#C5A059]/40 text-[#C5A059] font-mono font-bold text-[11px] shrink-0 ml-2">
                        {s.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="space-y-4">
              <div className="p-4 bg-[#0F251E]/60 border border-[#C5A059]/30 rounded-2xl space-y-2">
                <h4 className="text-sm font-bold text-[#C5A059] flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Engine 1: Camera Composition & Framing Guidance
                </h4>
                <p className="text-[#94A39E] text-xs leading-relaxed">
                  Calculates real-time Headroom Ratio (<code className="text-[#C5A059]">y_crown / H</code>), Horizontal Centering Offset (<code className="text-[#C5A059]">|x_center - 0.5|</code>), and Rule-of-Thirds eye-line alignment. Implements Cauchy loss heuristics to generate directional cues (<em className="text-[#F4F6F4]">"Step back for full-body view"</em>, <em className="text-[#F4F6F4]">"Shift right to center"</em>) before resolving limb kinematics (Hierarchical Planning).
                </p>
              </div>

              <div className="p-4 bg-[#0F251E]/60 border border-[#5EEAD4]/30 rounded-2xl space-y-2">
                <h4 className="text-sm font-bold text-[#5EEAD4] flex items-center gap-2">
                  <Cpu className="w-4 h-4" />
                  Engine 2: 16-D Kinematic Manifold & Cauchy Heuristic
                </h4>
                <p className="text-[#94A39E] text-xs leading-relaxed">
                  Raw landmarks are transformed via Torso-Normalized Affine scaling to a 16-D scale-invariant joint angle vector. Heuristic evaluation uses a Lorentzian/Cauchy function <code className="text-[#C5A059]">h(n) = 1 / (1 + (r / &tau;)&sup2;)</code> with production rules generating imperative corrections with fuzzy qualifiers.
                </p>
              </div>

              <div className="p-4 bg-[#0F251E]/60 border border-[#4ADE80]/30 rounded-2xl space-y-2">
                <h4 className="text-sm font-bold text-[#4ADE80] flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Phase 1: Dataset Engineering & Perceptual Audit (12,014 Images)
                </h4>
                <p className="text-[#94A39E] text-xs leading-relaxed">
                  Benchmarked against 12,014 diverse reference images audited for blur (Laplacian variance) and deduplicated using 64-bit Difference Hashing (dHash, 610 clusters filtered). Keypoint data is geometrically augmented in <code className="text-[#C5A059]">dataset_augmented.json</code> (185 MB).
                </p>
              </div>

              <div className="p-4 bg-[#0F251E]/60 border border-[#FF9F43]/30 rounded-2xl space-y-2">
                <h4 className="text-sm font-bold text-[#FF9F43] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Perception Backbone: BlazePose CNN via WASM SIMD
                </h4>
                <p className="text-[#94A39E] text-xs leading-relaxed">
                  Self-hosted MediaPipe 2-stage Convolutional Neural Network (<code className="text-[#C5A059]">pose_landmarker_lite.task</code>) running 100% locally on-device via WebAssembly GPU/CPU delegates at $0 budget, zero cloud latency, and 100% privacy.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'legend' && (
            <div className="space-y-4">
              <p className="text-[#94A39E]">
                The visual overlay adheres strictly to color psychology and contrast standards with a 1.5px dark halo backing for readability across all lighting environments:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-[#0F251E]/60 border border-[#F4F6F4]/10 rounded-2xl flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#5EEAD4] flex items-center justify-center shrink-0 border border-[#0F251E] shadow">
                    <div className="w-2 h-2 rounded-full bg-[#0F251E]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#5EEAD4]">Mint Cyan (#5EEAD4)</h4>
                    <p className="text-[#94A39E] text-[11px] mt-0.5">
                      Detected User Skeleton. Drawn with a 3px stroke and dark halo backing. Face landmarks are protected to avoid occluding eyes and nose.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 bg-[#0F251E]/60 border border-[#F4F6F4]/10 rounded-2xl flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#C5A059] flex items-center justify-center shrink-0 border border-[#0F251E] shadow">
                    <div className="w-2 h-2 rounded-full bg-[#0F251E]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#C5A059]">Antique Brass (#C5A059)</h4>
                    <p className="text-[#94A39E] text-[11px] mt-0.5">
                      Target Guide Skeleton. 2.5px dashed reference lines at 55% opacity. Persistently visible to guide your positioning.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 bg-[#0F251E]/60 border border-[#F4F6F4]/10 rounded-2xl flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#FF9F43] flex items-center justify-center shrink-0 border border-[#0F251E] shadow">
                    <div className="w-2 h-2 rounded-full bg-[#0F251E]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#FF9F43]">Warm Amber (#FF9F43)</h4>
                    <p className="text-[#94A39E] text-[11px] mt-0.5">
                      Needs Adjustment. Outlined joint ring with directional vector arrow and text pill indicating exact corrective movement.
                    </p>
                  </div>
                </div>

                <div className="p-3.5 bg-[#0F251E]/60 border border-[#F4F6F4]/10 rounded-2xl flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#4ADE80] flex items-center justify-center shrink-0 border border-[#0F251E] shadow">
                    <div className="w-2 h-2 rounded-full bg-[#0F251E]" />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#4ADE80]">Fresh Green (#4ADE80)</h4>
                    <p className="text-[#94A39E] text-[11px] mt-0.5">
                      Aligned / Completed Match. Solid ring with inner dot indicating joint is within calibrated angular tolerance.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'checklist' && (
            <div className="space-y-3">
              <p className="text-[#94A39E]">
                Reference verification scenarios for real-world studio hardware evaluation:
              </p>

              <div className="space-y-2">
                {[
                  { title: 'Camera Lifecycle', desc: 'Hot-plugging USB cameras refreshes devices; stopping releases all MediaStream hardware tracks immediately.' },
                  { title: 'Lighting Invariance', desc: 'Maintains tracking in daylight, dim lighting (< 50 lux), and complex background clutter.' },
                  { title: 'Framing & Distance', desc: 'Gracefully switches between upper-body (1.5m) and full-body (3m) with appropriate prompt hints.' },
                  { title: 'Tracking Re-engagement', desc: 'When leaving camera frame, skeleton fades within 300ms; returns instantly upon re-entering.' },
                  { title: 'Mirror & Symmetry', desc: 'In mirror mode, coordinates and arrows flip with zero misalignment (mathematical error <= 2px).' },
                ].map((item, idx) => (
                  <div key={idx} className="p-3 bg-[#0F251E]/60 border border-[#F4F6F4]/10 rounded-xl flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#4ADE80] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-[#F4F6F4]">{item.title}</h4>
                      <p className="text-[#94A39E] text-[11px] mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <div className="p-4 bg-[#4ADE80]/10 border border-[#4ADE80]/30 rounded-2xl space-y-2">
                <h4 className="text-sm font-bold text-[#4ADE80] flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5" />
                  100% On-Device & Zero Video Storage
                </h4>
                <p className="text-[#F4F6F4]/90">
                  KinoAssist operates with strict clinical privacy guarantees designed for sensitive camera environments:
                </p>
                <ul className="list-disc list-inside space-y-1 text-[#94A39E] pt-1">
                  <li>Zero frame saving: Video frames are processed in volatile memory only and discarded instantly.</li>
                  <li>Zero network requests: All models, WebAssembly runtimes, and typography are bundled locally.</li>
                  <li>Hardened Electron sandbox: Strict Content Security Policy (CSP), context isolation, and disabled node integration.</li>
                  <li>Immediate hardware release: Clicking "Stop Camera" stops all hardware webcam LED indicators instantly.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#F4F6F4]/10 bg-[#0F251E]/60 flex items-center justify-between">
          <span className="text-[11px] text-[#94A39E]">
            B.Tech CSE &bull; Artificial Intelligence Subject Project
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-[#C5A059] text-[#0F251E] rounded-xl hover:bg-[#D4B473] transition shadow"
          >
            Got it, Back to Coach
          </button>
        </div>
      </div>
    </div>
  );
};
