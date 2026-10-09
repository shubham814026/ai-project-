import React from 'react';
import { ShieldCheck, Video, Lock, X } from 'lucide-react';

interface ConsentModalProps {
  onAccept: () => void;
  onDecline: () => void;
}

export const ConsentModal: React.FC<ConsentModalProps> = ({ onAccept, onDecline }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#16382D] border border-[#F4F6F4]/15 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#C5A059]/20 border border-[#C5A059]/30 flex items-center justify-center text-[#C5A059]">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#F4F6F4]">Camera & Privacy Consent</h2>
            <p className="text-xs text-[#94A39E]">Local on-device processing only</p>
          </div>
        </div>

        <div className="space-y-3 mb-6 text-sm text-[#F4F6F4]/90">
          <div className="flex items-start gap-2.5">
            <Video className="w-4 h-4 text-[#5EEAD4] mt-0.5 shrink-0" />
            <p className="text-xs text-[#94A39E]">
              <strong className="text-[#F4F6F4]">Live Pose Guidance:</strong> Your webcam is used strictly to estimate joint angles in real time and guide you toward your chosen target pose.
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-[#4ADE80] mt-0.5 shrink-0" />
            <p className="text-xs text-[#94A39E]">
              <strong className="text-[#F4F6F4]">Zero Video Storage:</strong> Video frames never leave your local hardware. No frames, face images, or telemetry are ever saved to disk or uploaded to any cloud.
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <X className="w-4 h-4 text-[#FF9F43] mt-0.5 shrink-0" />
            <p className="text-xs text-[#94A39E]">
              <strong className="text-[#F4F6F4]">Instant Control:</strong> You can pause or stop the camera stream at any second using the bottom controls. Stopping releases every video track immediately.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#F4F6F4]/10">
          <button
            onClick={onDecline}
            className="px-4 py-2 text-xs font-medium text-[#94A39E] hover:text-[#F4F6F4] rounded-lg transition"
          >
            Not Now
          </button>
          <button
            onClick={onAccept}
            className="px-5 py-2 text-xs font-semibold bg-[#C5A059] text-[#0F251E] hover:bg-[#D4B473] rounded-lg shadow-md transition"
          >
            I Agree, Start Camera
          </button>
        </div>
      </div>
    </div>
  );
};
