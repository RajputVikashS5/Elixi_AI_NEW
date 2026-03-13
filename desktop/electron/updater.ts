import { BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';

export function setupUpdater(mainWindow: BrowserWindow): void {
  autoUpdater.logger = null; // Disable logger in production (set up proper logging if needed)
  autoUpdater.autoDownload = false;

  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('app:update-available', info);
  });

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow.webContents.send('app:update-downloaded', info);
  });

  autoUpdater.on('error', () => {
    // Silently fail update checks in Phase 1
  });

  // Check for updates every 4 hours
  autoUpdater.checkForUpdates();
  setInterval(() => {
    autoUpdater.checkForUpdates();
  }, 4 * 60 * 60 * 1000);
}
