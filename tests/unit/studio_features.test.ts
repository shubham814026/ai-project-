import { describe, it, expect, beforeEach } from 'vitest';
import { AudioSynthesizer } from '../../src/renderer/core/camera/audioSynthesizer';
import { VoiceDirector } from '../../src/renderer/core/guidance/voiceDirector';
import { SettingsManager } from '../../src/renderer/core/settings/settingsManager';
import { calculate2DAngle, calculateHorizontalTilt } from '../../src/renderer/core/geometry/angles';

describe('DirectAI Studio Features Unit Tests', () => {
  describe('AudioSynthesizer', () => {
    let synth: AudioSynthesizer;

    beforeEach(() => {
      synth = new AudioSynthesizer();
    });

    it('initializes in unmuted state', () => {
      expect(synth.isMuted()).toBe(false);
    });

    it('toggles and sets mute state cleanly', () => {
      synth.setMuted(true);
      expect(synth.isMuted()).toBe(true);

      const toggled = synth.toggleMute();
      expect(toggled).toBe(false);
      expect(synth.isMuted()).toBe(false);
    });

    it('does not throw when play methods are called in headless environment', () => {
      expect(() => synth.playShutterSound()).not.toThrow();
      expect(() => synth.playSuccessChime()).not.toThrow();
      expect(() => synth.playCountdownBeep(880, 0.05)).not.toThrow();
    });
  });

  describe('VoiceDirector', () => {
    let director: VoiceDirector;

    beforeEach(() => {
      director = new VoiceDirector();
    });

    it('initializes enabled by default', () => {
      expect(director.isEnabled()).toBe(true);
    });

    it('toggles enable/disable state', () => {
      director.toggle();
      expect(director.isEnabled()).toBe(false);
      director.toggle();
      expect(director.isEnabled()).toBe(true);
    });

    it('processes directorial feedback without exceptions in headless environment', () => {
      expect(() => {
        director.provideFeedback('Move back slightly', 'Straighten arm', 0.1, 1000);
      }).not.toThrow();
    });

    it('notifies capture safely', () => {
      expect(() => {
        director.notifyCapture('Studio Portrait');
      }).not.toThrow();
    });
  });

  describe('Mathematical Inspector Angles & Tilts', () => {
    it('accurately computes 90-degree orthogonal elbow angle', () => {
      const shoulder = { x: 0.5, y: 0.2 };
      const elbow = { x: 0.5, y: 0.5 };
      const wrist = { x: 0.8, y: 0.5 };

      const angle = calculate2DAngle(shoulder, elbow, wrist);
      expect(angle).toBeCloseTo(90.0, 1);
    });

    it('accurately computes 180-degree straight arm angle', () => {
      const shoulder = { x: 0.5, y: 0.2 };
      const elbow = { x: 0.5, y: 0.5 };
      const wrist = { x: 0.5, y: 0.8 };

      const angle = calculate2DAngle(shoulder, elbow, wrist);
      expect(angle).toBeCloseTo(180.0, 1);
    });

    it('computes 0-degree horizontal tilt for perfectly level shoulders', () => {
      const leftShoulder = { x: 0.4, y: 0.3 };
      const rightShoulder = { x: 0.6, y: 0.3 };

      const tilt = calculateHorizontalTilt(leftShoulder, rightShoulder);
      expect(tilt).toBeCloseTo(0.0, 1);
    });
  });

  describe('SettingsManager Studio Defaults', () => {
    it('exposes inspectorMode, voiceDirectorEnabled, and autoShutterEnabled in defaults', () => {
      const manager = new SettingsManager();
      const s = manager.getSettings();
      expect(s.inspectorMode).toBe(false);
      expect(s.voiceDirectorEnabled).toBe(true);
      expect(s.autoShutterEnabled).toBe(true);
    });

    it('persists changes to studio settings', () => {
      const manager = new SettingsManager();
      const updated = manager.update({
        inspectorMode: true,
        voiceDirectorEnabled: false,
        autoShutterEnabled: true,
      });
      expect(updated.inspectorMode).toBe(true);
      expect(updated.voiceDirectorEnabled).toBe(false);
      expect(updated.autoShutterEnabled).toBe(true);
    });
  });
});
