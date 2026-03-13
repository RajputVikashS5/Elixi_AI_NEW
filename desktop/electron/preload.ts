import { contextBridge, ipcRenderer } from 'electron';

// Whitelist of safe IPC channels
const VALID_SEND_CHANNELS = [
  'window:minimize',
  'window:maximize',
  'window:close',
  'window:toggle-maximize',
  'app:get-version',
  'app:get-platform',
  'dialog:open-file',
  'dialog:save-file',
  'system:open-path',
  'notification:show',
];

const VALID_RECEIVE_CHANNELS = [
  'app:update-available',
  'app:update-downloaded',
  'window:maximize-change',
  'tray:show',
];

const VALID_INVOKE_CHANNELS = [
  'app:get-version',
  'app:get-platform',
  'app:get-system-info',
  'dialog:open-file',
  'dialog:save-file',
  'window:is-maximized',
  'window:get-app-anchor',
];

// Expose safe API to renderer via contextBridge
contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),

  // App info
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  getPlatform: () => ipcRenderer.invoke('app:get-platform'),
  getSystemInfo: () => ipcRenderer.invoke('app:get-system-info'),
  getAppAnchor: (request: { appName?: string; preset?: 'hud' | 'widget' }) =>
    ipcRenderer.invoke('window:get-app-anchor', request),

  // File dialogs
  openFileDialog: (options: Electron.OpenDialogOptions) =>
    ipcRenderer.invoke('dialog:open-file', options),
  saveFileDialog: (options: Electron.SaveDialogOptions) =>
    ipcRenderer.invoke('dialog:save-file', options),

  // Shell
  openPath: (path: string) => ipcRenderer.send('system:open-path', path),

  // Event listeners (receive only from main)
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    if (VALID_RECEIVE_CHANNELS.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },
  off: (channel: string, callback: (...args: unknown[]) => void) => {
    if (VALID_RECEIVE_CHANNELS.includes(channel)) {
      ipcRenderer.removeListener(channel, callback);
    }
  },
});
