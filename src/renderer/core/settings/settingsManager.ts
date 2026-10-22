/**
 * Local Settings Manager
 * Stores user preferences in localStorage only (Section A10).
 * No frame persistence, no external storage.
 */

export interface AppSettings {
  selectedCameraId: string | null;
  mirror: boolean;
  showSkeleton: boolean;
  showTargetGuide: boolean;
  framingMode: 'upper-body' | 'full-body';
  selectedResolution: { width: number; height: number };
  allowMirroredMatching: boolean;
  smoothingEnabled: boolean;
  hasConsented: boolean;
  inspectorMode: boolean;
  voiceDirectorEnabled: boolean;
  autoShutterEnabled: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  selectedCameraId: null,
  mirror: true,
  showSkeleton: true,
  showTargetGuide: true,
  framingMode: 'upper-body',
  selectedResolution: { width: 1280, height: 720 },
  allowMirroredMatching: false,
  smoothingEnabled: true,
  hasConsented: false,
  inspectorMode: false,
  voiceDirectorEnabled: true,
  autoShutterEnabled: true,
};

const STORAGE_KEY = 'pose_coach_user_settings_v1';

export class SettingsManager {
  private settings: AppSettings;

  constructor() {
    this.settings = this.load();
  }

  private load(): AppSettings {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          return {
            ...DEFAULT_SETTINGS,
            ...parsed,
            autoShutterEnabled: parsed.autoShutterEnabled !== false,
            voiceDirectorEnabled: parsed.voiceDirectorEnabled !== false,
          };
        }
      }
    } catch (e) {
      console.warn('[SettingsManager] Failed to load settings from localStorage:', e);
    }
    return { ...DEFAULT_SETTINGS };
  }

  public getSettings(): AppSettings {
    return { ...this.settings };
  }

  public update(partial: Partial<AppSettings>): AppSettings {
    this.settings = { ...this.settings, ...partial };
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      }
    } catch (e) {
      console.warn('[SettingsManager] Failed to save settings to localStorage:', e);
    }
    return { ...this.settings };
  }
}
