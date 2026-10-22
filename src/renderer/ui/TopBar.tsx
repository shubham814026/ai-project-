import React from 'react';
import { Activity, ShieldCheck, Cpu, Sliders, HelpCircle, Eye, Volume2, VolumeX, Camera, FileText } from 'lucide-react';

interface TopBarProps {
  modelVariant: string;
  inspectorMode: boolean;
  onToggleInspector: () => void;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  snapshotsCount: number;
  onOpenGallery: () => void;
  onOpenAudit: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  modelVariant,
  inspectorMode,
  onToggleInspector,
  voiceEnabled,
  onToggleVoice,
  snapshotsCount,
  onOpenGallery,
  onOpenAudit,
  onOpenSettings,
  onOpenHelp,
}) => {
  return (
    <header className="h-14 border-b border-[#F4F6F4]/10 bg-[#16382D] px-4 flex items-center justify-between select-none">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#5EEAD4] flex items-center justify-center text-[#0F251E] font-bold shadow">
          <Activity className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-[#F4F6F4] tracking-tight leading-tight flex items-center gap-2">
            DirectAI Studio
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#5EEAD4]/20 text-[#5EEAD4] border border-[#5EEAD4]/30">
              Dual-Engine AI
            </span>
          </h1>
          <p className="text-[11px] text-[#94A39E] leading-tight">Autonomous AI Studio Director & Headshot Creator</p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Gallery button with capture count badge */}
        <button
          onClick={onOpenGallery}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
            snapshotsCount > 0
              ? 'bg-[#0F251E] border-[#5EEAD4]/40 text-[#5EEAD4] hover:bg-[#5EEAD4]/10'
              : 'border-[#F4F6F4]/10 text-[#94A39E] hover:text-[#F4F6F4]'
          }`}
          title="Open Studio Headshot Gallery"
          aria-label="Open Studio Gallery"
        >
          <Camera className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Gallery</span>
          {snapshotsCount > 0 && (
            <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-[#5EEAD4] text-[#0F251E] font-extrabold">
              {snapshotsCount}
            </span>
          )}
        </button>

        {/* AI Inspector Mode Toggle (Key: X) */}
        <button
          onClick={onToggleInspector}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
            inspectorMode
              ? 'bg-[#5EEAD4]/20 border-[#5EEAD4]/60 text-[#5EEAD4] shadow-[0_0_12px_rgba(94,234,212,0.3)]'
              : 'border-[#F4F6F4]/10 text-[#94A39E] hover:text-[#F4F6F4] hover:bg-[#0F251E]'
          }`}
          title="Toggle AI Mathematical Inspector HUD (Shortcut: X)"
          aria-label="Toggle AI Inspector"
        >
          <Eye className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Inspector (X)</span>
        </button>

        {/* Voice Director Mute/Unmute */}
        <button
          onClick={onToggleVoice}
          className={`p-1.5 rounded-xl text-xs border transition ${
            voiceEnabled
              ? 'bg-[#C5A059]/20 border-[#C5A059]/40 text-[#C5A059]'
              : 'border-[#F4F6F4]/10 text-[#94A39E] hover:text-[#F4F6F4]'
          }`}
          title={voiceEnabled ? 'Director Voice: ON (Click to mute)' : 'Director Voice: OFF (Click to unmute)'}
          aria-label="Toggle Voice Director"
        >
          {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* Session Telemetry & Audit Report */}
        <button
          onClick={onOpenAudit}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[#C5A059]/20 border border-[#C5A059]/40 text-[#C5A059] hover:bg-[#C5A059]/30 transition"
          title="Open Session Telemetry & Audit Report"
          aria-label="Open Session Audit"
        >
          <FileText className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Session Audit</span>
        </button>

        <div className="w-[1px] h-6 bg-[#F4F6F4]/10 mx-1 hidden sm:block" />

        {/* On-device verification badge */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-[#94A39E] px-2.5 py-1 rounded-full bg-[#0F251E]/60 border border-[#F4F6F4]/10">
          <ShieldCheck className="w-3.5 h-3.5 text-[#5EEAD4]" />
          <span>Local & Private</span>
        </div>

        {/* Model badge */}
        <div className="hidden xl:flex items-center gap-1.5 text-xs text-[#94A39E] px-2.5 py-1 rounded-full bg-[#0F251E]/60 border border-[#F4F6F4]/10">
          <Cpu className="w-3.5 h-3.5 text-[#C5A059]" />
          <span className="capitalize">MediaPipe {modelVariant}</span>
        </div>

        {/* Help button */}
        <button
          onClick={onOpenHelp}
          className="p-1.5 text-[#94A39E] hover:text-[#F4F6F4] hover:bg-[#0F251E] rounded-md transition"
          title="Manual Guide & Verification"
          aria-label="Open manual checklist and help"
        >
          <HelpCircle className="w-5 h-5" />
        </button>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="p-1.5 text-[#94A39E] hover:text-[#F4F6F4] hover:bg-[#0F251E] rounded-md transition"
          title="Settings"
          aria-label="Open settings"
        >
          <Sliders className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};
