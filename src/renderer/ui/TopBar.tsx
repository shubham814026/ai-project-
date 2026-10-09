import React from 'react';
import { Camera, ShieldCheck, Cpu, Sliders, HelpCircle } from 'lucide-react';

interface TopBarProps {
  modelVariant: string;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ modelVariant, onOpenSettings, onOpenHelp }) => {
  return (
    <header className="h-14 border-b border-[#F4F6F4]/10 bg-[#16382D] px-4 flex items-center justify-between select-none">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#C5A059] flex items-center justify-center text-[#0F251E] font-bold shadow">
          <Camera className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-[#F4F6F4] tracking-tight leading-tight flex items-center gap-2">
            Pose Coach
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#C5A059]/20 text-[#C5A059] border border-[#C5A059]/30">
              Desktop
            </span>
          </h1>
          <p className="text-[11px] text-[#94A39E] leading-tight">Live Visual Form Guidance</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* On-device verification badge */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#94A39E] px-2.5 py-1 rounded-full bg-[#0F251E]/60 border border-[#F4F6F4]/10">
          <ShieldCheck className="w-3.5 h-3.5 text-[#5EEAD4]" />
          <span>Local & Private</span>
        </div>

        {/* Model badge */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-[#94A39E] px-2.5 py-1 rounded-full bg-[#0F251E]/60 border border-[#F4F6F4]/10">
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
