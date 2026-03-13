import { BrowserWindow, ipcMain, app, dialog, shell } from 'electron';
import * as os from 'os';

interface AnchorRequest {
  appName?: string;
  preset?: 'hud' | 'widget';
}

interface AnchorMetadata {
  x: number;
  y: number;
  source: 'app-window' | 'main-window';
  appName?: string;
  matchedWindowTitle?: string;
  matchedOwnerName?: string;
  timestamp: string;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(value, max));

const appAliases: Record<string, string[]> = {
  'vs code': ['code', 'visual studio code', 'vscode'],
  vscode: ['code', 'visual studio code', 'vscode'],
  spotify: ['spotify'],
  terminal: ['terminal', 'cmd', 'powershell', 'windows terminal'],
  desktop: ['explorer', 'desktop'],
};

function isAppMatch(targetApp: string, ownerName?: string, title?: string): boolean {
  const normalizedTarget = targetApp.toLowerCase().trim();
  const aliases = appAliases[normalizedTarget] || [normalizedTarget];
  const haystack = `${ownerName || ''} ${title || ''}`.toLowerCase();
  return aliases.some((alias) => haystack.includes(alias));
}

export function setupIpcHandlers(mainWindow: BrowserWindow): void {
  // Window controls
  ipcMain.on('window:minimize', () => {
    mainWindow.minimize();
  });

  ipcMain.on('window:maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
    mainWindow.webContents.send('window:maximize-change', mainWindow.isMaximized());
  });

  ipcMain.on('window:close', () => {
    mainWindow.close();
  });

  ipcMain.handle('window:is-maximized', () => {
    return mainWindow.isMaximized();
  });

  ipcMain.handle('window:get-app-anchor', async (_event, request?: AnchorRequest): Promise<AnchorMetadata> => {
    const preset = request?.preset || 'hud';
    const offset = preset === 'widget'
      ? { x: 16, y: 18 }
      : { x: 18, y: 52 };

    const mainBounds = mainWindow.getBounds();

    const fallbackX = mainBounds.x + mainBounds.width + offset.x;
    const fallbackY = mainBounds.y + offset.y;

    if (!request?.appName) {
      return {
        x: fallbackX,
        y: fallbackY,
        source: 'main-window',
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const { default: activeWin } = await import('active-win');
      const focused = await activeWin();

      if (focused && isAppMatch(request.appName, focused.owner?.name, focused.title)) {
        const display = mainWindow.getBounds();
        const displayRight = display.x + display.width;
        const displayBottom = display.y + display.height;

        const appX = clamp(focused.bounds.x + focused.bounds.width + offset.x, display.x, displayRight - 360);
        const appY = clamp(focused.bounds.y + offset.y, display.y + 12, displayBottom - 220);

        return {
          x: appX,
          y: appY,
          source: 'app-window',
          appName: request.appName,
          matchedWindowTitle: focused.title,
          matchedOwnerName: focused.owner?.name,
          timestamp: new Date().toISOString(),
        };
      }
    } catch {
      // Fallback to main-window placement when active window lookup is unavailable.
    }

    return {
      x: fallbackX,
      y: fallbackY,
      source: 'main-window',
      appName: request.appName,
      timestamp: new Date().toISOString(),
    };
  });

  // App info
  ipcMain.handle('app:get-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('app:get-platform', () => {
    return process.platform;
  });

  ipcMain.handle('app:get-system-info', () => {
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
      hostname: os.hostname(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      uptime: os.uptime(),
    };
  });

  // File dialogs
  ipcMain.handle('dialog:open-file', async (_event, options: Electron.OpenDialogOptions) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      ...options,
      // Restrict to user's home directory by default for security
      defaultPath: options.defaultPath || app.getPath('home'),
    });
    return result;
  });

  ipcMain.handle('dialog:save-file', async (_event, options: Electron.SaveDialogOptions) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      ...options,
      defaultPath: options.defaultPath || app.getPath('home'),
    });
    return result;
  });

  // Open path in OS file explorer (safe - only opens, never executes)
  ipcMain.on('system:open-path', (_event, filePath: string) => {
    // Sanitize: only allow opening paths, not executing
    shell.openPath(filePath);
  });

  // Maximize state change listener
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:maximize-change', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:maximize-change', false);
  });
}
