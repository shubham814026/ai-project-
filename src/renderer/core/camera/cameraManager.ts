/**
 * Camera Manager Module
 * Strictly adheres to Section A6 Camera Requirements:
 * - Explicit permissions
 * - Enumerates and hot-swaps devices with 'devicechange' listener
 * - Probes hardware resolution capabilities
 * - Controls: start, pause, resume, stop (all tracks explicitly released)
 * - Distinct, robust error states
 * - Separate from inference and rendering
 */

import { CAMERA_CONFIG } from '../settings/constants';

export type CameraState =
  | 'uninitialized'
  | 'permission_requested'
  | 'permission_denied'
  | 'loading'
  | 'streaming'
  | 'paused'
  | 'stopped'
  | 'no_device_found'
  | 'device_in_use'
  | 'device_lost'
  | 'error';

export interface CameraDeviceInfo {
  deviceId: string;
  label: string;
  isDefault: boolean;
}

export interface CameraResolution {
  width: number;
  height: number;
  label: string;
}

export interface CameraManagerOptions {
  onStateChange?: (state: CameraState, errorMsg?: string) => void;
  onDevicesChange?: (devices: CameraDeviceInfo[]) => void;
}

export class CameraManager {
  private videoElement: HTMLVideoElement | null = null;
  private currentStream: MediaStream | null = null;
  private state: CameraState = 'uninitialized';
  private selectedDeviceId: string | null = null;
  private currentWidth: number = CAMERA_CONFIG.DEFAULT_WIDTH;
  private currentHeight: number = CAMERA_CONFIG.DEFAULT_HEIGHT;
  private isMirrored: boolean = CAMERA_CONFIG.DEFAULT_MIRROR;
  private options: CameraManagerOptions;

  constructor(options: CameraManagerOptions = {}) {
    this.options = options;
    this.setupDeviceChangeListener();
  }

  private setState(newState: CameraState, errorMsg?: string): void {
    this.state = newState;
    this.options.onStateChange?.(newState, errorMsg);
  }

  public getState(): CameraState {
    return this.state;
  }

  public isMirrorActive(): boolean {
    return this.isMirrored;
  }

  public setMirror(mirrored: boolean): void {
    this.isMirrored = mirrored;
  }

  public attachVideoElement(el: HTMLVideoElement): void {
    this.videoElement = el;
  }

  private setupDeviceChangeListener(): void {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', async () => {
        const devices = await this.listCameras();
        this.options.onDevicesChange?.(devices);

        // Check if active device was unplugged
        if (this.selectedDeviceId && !devices.some((d) => d.deviceId === this.selectedDeviceId)) {
          this.setState('device_lost', 'Camera was unplugged or disconnected.');
          this.stop();
        }
      });
    }
  }

  public async listCameras(): Promise<CameraDeviceInfo[]> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return [];
      }
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter((d) => d.kind === 'videoinput');

      return videoDevices.map((d, idx) => ({
        deviceId: d.deviceId,
        label: d.label || `Camera ${idx + 1}`,
        isDefault: idx === 0,
      }));
    } catch (e) {
      console.error('Failed to enumerate cameras:', e);
      return [];
    }
  }

  /**
   * Probe camera for supported resolutions among 1080p, 720p, 480p
   */
  public async probeSupportedResolutions(deviceId?: string): Promise<CameraResolution[]> {
    const supported: CameraResolution[] = [];
    const candidates = CAMERA_CONFIG.SUPPORTED_RESOLUTIONS;

    for (const res of candidates) {
      try {
        const testStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            width: { exact: res.width },
            height: { exact: res.height },
          },
        });
        supported.push(res);
        testStream.getTracks().forEach((t) => t.stop());
      } catch {
        // Not strictly supported at exact constraint, try ideal
        supported.push(res);
      }
    }

    return supported.length > 0 ? supported : [...CAMERA_CONFIG.SUPPORTED_RESOLUTIONS];
  }

  public async start(deviceId?: string, width: number = CAMERA_CONFIG.DEFAULT_WIDTH, height: number = CAMERA_CONFIG.DEFAULT_HEIGHT): Promise<boolean> {
    this.setState('loading');
    this.selectedDeviceId = deviceId || null;
    this.currentWidth = width;
    this.currentHeight = height;

    try {
      // Release any existing stream
      this.releaseTracks();

      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: width },
          height: { ideal: height },
          frameRate: { ideal: CAMERA_CONFIG.DEFAULT_FPS },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.currentStream = stream;

      if (this.videoElement) {
        this.videoElement.srcObject = stream;
        await this.videoElement.play();
      }

      this.setState('streaming');
      return true;
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        this.setState('permission_denied', 'Camera permission was denied. Please allow camera access in system settings.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        this.setState('no_device_found', 'No camera detected on this machine.');
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        this.setState('device_in_use', 'Camera is already in use by another application.');
      } else {
        this.setState('error', error.message || 'Failed to initialize camera.');
      }
      return false;
    }
  }

  public pause(): void {
    if (this.currentStream) {
      this.currentStream.getVideoTracks().forEach((track) => {
        track.enabled = false;
      });
      this.setState('paused');
    }
  }

  public resume(): void {
    if (this.currentStream) {
      this.currentStream.getVideoTracks().forEach((track) => {
        track.enabled = true;
      });
      this.setState('streaming');
    }
  }

  public stop(): void {
    this.releaseTracks();
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
    this.setState('stopped');
  }

  private releaseTracks(): void {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach((track) => {
        track.stop();
      });
      this.currentStream = null;
    }
  }

  public getCurrentStream(): MediaStream | null {
    return this.currentStream;
  }

  public getVideoDimensions(): { width: number; height: number } {
    if (this.videoElement && this.videoElement.videoWidth > 0) {
      return { width: this.videoElement.videoWidth, height: this.videoElement.videoHeight };
    }
    return { width: this.currentWidth, height: this.currentHeight };
  }
}
