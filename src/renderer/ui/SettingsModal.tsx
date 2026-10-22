import React from 'react';
import { X, Sliders, Video, Cpu, FlipHorizontal, Eye, Sparkles, RefreshCw, Bug, ShieldCheck } from 'lucide-react';
import { AppSettings } from '../core/settings/settingsManager';
import { CameraDeviceInfo } from '../core/camera/cameraManager';
import { CAMERA_CONFIG } from '../core/settings/constants';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  devices: CameraDeviceInfo[];
  modelVariant: 'lite' | 'full' | 'heavy';
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onSwitchModelVariant: (variant: 'lite' | 'full' | 'heavy') => Promise<void>;
  onOpenDiagnostics: () => void;
  onResetDefaults: () => void;
}

const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  accentColor?: string;
  ariaLabel?: string;
}> = ({ checked, onChange, accentColor = '#C5A059', ariaLabel }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    onClick={() => onChange(!checked)}
    className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none select-none"
    style={{
      backgroundColor: checked ? accentColor : '#0F251E',
      borderColor: checked ? 'transparent' : 'rgba(244, 246, 244, 0.25)',
    }}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
        checked ? 'translate-x-5' : 'translate-x-0 opacity-75'
      }`}
    />
  </button>
);

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  devices,
  modelVariant,
  onUpdateSettings,
  onSwitchModelVariant,
  onOpenDiagnostics,
  onResetDefaults,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl max-h-[85vh] bg-[#16382D] border border-[#F4F6F4]/15 rounded-3xl flex flex-col shadow-2xl overflow-hidden select-none">
        {/* Header */}
        <div className="p-5 border-b border-[#F4F6F4]/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#C5A059]/20 border border-[#C5A059]/40 flex items-center justify-center text-[#C5A059] shadow">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#F4F6F4]">Application Settings</h2>
              <p className="text-xs text-[#94A39E]">Configure AI vision model, camera hardware, and visual overlays</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#94A39E] hover:text-[#F4F6F4] hover:bg-[#0F251E] rounded-xl transition"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-[#F4F6F4]">
          {/* Section 1: Camera Hardware & Resolution */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#C5A059] flex items-center gap-2">
              <Video className="w-4 h-4" />
              Camera & Input Stream
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Camera Device */}
              <div className="p-3 bg-[#0F251E]/60 border border-[#F4F6F4]/10 rounded-2xl space-y-1.5">
                <label className="text-[11px] text-[#94A39E] font-medium block">Camera Device</label>
                <select
                  value={settings.selectedCameraId ?? ''}
                  onChange={(e) => onUpdateSettings({ selectedCameraId: e.target.value || null })}
                  className="w-full bg-[#16382D] border border-[#F4F6F4]/15 rounded-xl px-3 py-2 text-xs text-[#F4F6F4] focus:outline-none focus:border-[#C5A059] cursor-pointer"
                >
                  <option value="">Default Camera</option>
                  {devices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Resolution */}
              <div className="p-3 bg-[#0F251E]/60 border border-[#F4F6F4]/10 rounded-2xl space-y-1.5">
                <label className="text-[11px] text-[#94A39E] font-medium block">Video Resolution</label>
                <select
                  value={`${settings.selectedResolution.width}x${settings.selectedResolution.height}`}
                  onChange={(e) => {
                    const [w, h] = e.target.value.split('x').map(Number);
                    onUpdateSettings({ selectedResolution: { width: w, height: h } });
                  }}
                  className="w-full bg-[#16382D] border border-[#F4F6F4]/15 rounded-xl px-3 py-2 text-xs text-[#F4F6F4] focus:outline-none focus:border-[#C5A059] cursor-pointer"
                >
                  {CAMERA_CONFIG.SUPPORTED_RESOLUTIONS.map((res) => (
                    <option key={res.label} value={`${res.width}x${res.height}`}>
                      {res.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Mirror Toggle */}
            <div className="p-3 bg-[#0F251E]/60 border border-[#F4F6F4]/10 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FlipHorizontal className="w-4 h-4 text-[#5EEAD4]" />
                <div>
                  <h4 className="font-semibold text-xs text-[#F4F6F4]">Mirror Webcam Stream</h4>
                  <p className="text-[11px] text-[#94A39E]">Horizontally flip preview like looking in a real mirror (Key: M)</p>
                </div>
              </div>
              <ToggleSwitch
                checked={settings.mirror}
                onChange={(checked) => onUpdateSettings({ mirror: checked })}
                accentColor="#5EEAD4"
                ariaLabel="Toggle mirror stream"
              />
            </div>
          </div>

          {/* Section 2: AI Vision Model & Biomechanics */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#C5A059] flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              AI Model & Biomechanics
            </h3>

            {/* Model Variant Selector */}
            <div className="p-3.5 bg-[#0F251E]/60 border border-[#F4F6F4]/10 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-xs text-[#F4F6F4]">MediaPipe Model Variant</h4>
                  <p className="text-[11px] text-[#94A39E]">Choose trade-off between inference speed and landmark precision</p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#5EEAD4]/20 text-[#5EEAD4] border border-[#5EEAD4]/30">
                  {modelVariant}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { id: 'lite', label: 'Lite (5.8 MB)', desc: 'Fastest 30+ FPS, Low CPU' },
                  { id: 'full', label: 'Full (9.4 MB)', desc: 'Balanced accuracy & speed' },
                  { id: 'heavy', label: 'Heavy (30.7 MB)', desc: 'Highest precision accuracy' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => onSwitchModelVariant(m.id as 'lite' | 'full' | 'heavy')}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      modelVariant === m.id
                        ? 'border-[#C5A059] bg-[#C5A059]/20 text-[#F4F6F4]'
                        : 'border-[#F4F6F4]/10 bg-[#16382D] text-[#94A39E] hover:text-[#F4F6F4]'
                    }`}
                  >
                    <div className="font-bold text-xs">{m.label}</div>
                    <div className="text-[10px] text-[#94A39E] mt-0.5">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Smoothing Filter Toggle */}
            <div className="p-3 bg-[#0F251E]/60 border border-[#F4F6F4]/10 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="w-4 h-4 text-[#C5A059]" />
                <div>
                  <h4 className="font-semibold text-xs text-[#F4F6F4]">One Euro Jitter Filter</h4>
                  <p className="text-[11px] text-[#94A39E]">Dynamic speed-adaptive cutoff filter reducing raw sensor jitter by &gt; 50%</p>
                </div>
              </div>
              <ToggleSwitch
                checked={settings.smoothingEnabled}
                onChange={(checked) => onUpdateSettings({ smoothingEnabled: checked })}
                accentColor="#C5A059"
                ariaLabel="Toggle One Euro filter"
              />
            </div>

            {/* Symmetric / Mirrored Matching Toggle */}
            <div className="p-3 bg-[#0F251E]/60 border border-[#F4F6F4]/10 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FlipHorizontal className="w-4 h-4 text-[#4ADE80]" />
                <div>
                  <h4 className="font-semibold text-xs text-[#F4F6F4]">Allow Mirrored Pose Matching</h4>
                  <p className="text-[11px] text-[#94A39E]">Permit opposite-side execution for asymmetric poses (e.g. left-hand wave)</p>
                </div>
              </div>
              <ToggleSwitch
                checked={settings.allowMirroredMatching}
                onChange={(checked) => onUpdateSettings({ allowMirroredMatching: checked })}
                accentColor="#4ADE80"
                ariaLabel="Toggle mirrored pose matching"
              />
            </div>
          </div>

          {/* Section 3: Visual Overlays & Director Automation */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#C5A059] flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Director Automation & Visual Overlays
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-[#0F251E]/60 border border-[#F4F6F4]/10 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-xs text-[#F4F6F4]">Live Skeleton Overlay</h4>
                  <p className="text-[11px] text-[#94A39E]">Show Mint Cyan body joints (Key: S)</p>
                </div>
                <ToggleSwitch
                  checked={settings.showSkeleton}
                  onChange={(checked) => onUpdateSettings({ showSkeleton: checked })}
                  accentColor="#5EEAD4"
                  ariaLabel="Toggle live skeleton"
                />
              </div>

              <div className="p-3 bg-[#0F251E]/60 border border-[#F4F6F4]/10 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-xs text-[#F4F6F4]">Target Pose Guide</h4>
                  <p className="text-[11px] text-[#94A39E]">Show dashed reference ghost (Key: G)</p>
                </div>
                <ToggleSwitch
                  checked={settings.showTargetGuide}
                  onChange={(checked) => onUpdateSettings({ showTargetGuide: checked })}
                  accentColor="#C5A059"
                  ariaLabel="Toggle target pose guide"
                />
              </div>

              <div className="p-3 bg-[#0F251E]/60 border border-[#F4F6F4]/10 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-xs text-[#F4F6F4]">AI Mathematical Inspector HUD</h4>
                  <p className="text-[11px] text-[#94A39E]">Live arccos angle degrees & Cauchy loss telemetry (Key: X)</p>
                </div>
                <ToggleSwitch
                  checked={settings.inspectorMode ?? false}
                  onChange={(checked) => onUpdateSettings({ inspectorMode: checked })}
                  accentColor="#5EEAD4"
                  ariaLabel="Toggle inspector mode"
                />
              </div>

              <div className="p-3 bg-[#0F251E]/60 border border-[#F4F6F4]/10 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-xs text-[#F4F6F4]">Offline Voice Director</h4>
                  <p className="text-[11px] text-[#94A39E]">100% offline spoken directorial coaching</p>
                </div>
                <ToggleSwitch
                  checked={settings.voiceDirectorEnabled ?? true}
                  onChange={(checked) => onUpdateSettings({ voiceDirectorEnabled: checked })}
                  accentColor="#C5A059"
                  ariaLabel="Toggle voice director"
                />
              </div>

              <div className="p-3 bg-[#0F251E]/60 border border-[#F4F6F4]/10 rounded-2xl flex items-center justify-between sm:col-span-2">
                <div>
                  <h4 className="font-semibold text-xs text-[#F4F6F4]">Autonomous AI Auto-Shutter</h4>
                  <p className="text-[11px] text-[#94A39E]">
                    Automatically snaps high-resolution studio headshot when composition & pose hold reaches 1.5s
                  </p>
                </div>
                <ToggleSwitch
                  checked={settings.autoShutterEnabled ?? true}
                  onChange={(checked) => onUpdateSettings({ autoShutterEnabled: checked })}
                  accentColor="#4ADE80"
                  ariaLabel="Toggle auto shutter"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Diagnostics */}
          <div className="pt-2 border-t border-[#F4F6F4]/10 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => {
                onClose();
                onOpenDiagnostics();
              }}
              className="px-3.5 py-2 text-xs font-semibold bg-[#0F251E] border border-[#C5A059]/40 text-[#C5A059] hover:bg-[#C5A059]/15 rounded-xl flex items-center gap-2 transition"
            >
              <Bug className="w-4 h-4" />
              <span>Open Biomechanical Diagnostics (Ctrl+Shift+D)</span>
            </button>

            <button
              onClick={onResetDefaults}
              className="px-3 py-2 text-xs text-[#94A39E] hover:text-[#F4F6F4] flex items-center gap-1.5 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset to Defaults</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#F4F6F4]/10 bg-[#0F251E]/60 flex items-center justify-between">
          <span className="text-[11px] text-[#94A39E] flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#5EEAD4]" />
            Settings saved locally in browser storage
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold bg-[#C5A059] text-[#0F251E] rounded-xl hover:bg-[#D4B473] transition shadow"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
