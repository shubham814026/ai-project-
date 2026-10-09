import { contextBridge, ipcRenderer } from 'electron';

/**
 * Secure Electron Preload Script
 * Strict context isolation with minimal surface area
 */
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  getAppMetrics: async () => {
    return await ipcRenderer.invoke('get-app-metrics');
  },
  onWindowBlur: (callback: () => void) => {
    ipcRenderer.on('window-blur', callback);
  },
  onWindowFocus: (callback: () => void) => {
    ipcRenderer.on('window-focus', callback);
  },
});
