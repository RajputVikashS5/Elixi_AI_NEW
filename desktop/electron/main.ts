import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import { setupIpcHandlers } from './ipc-handlers';
import { createTray, destroyTray } from './tray-manager';
import { WindowManager } from './window-manager';
import { setupUpdater } from './updater';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const shouldOpenDevTools = process.env.ELIXI_OPEN_DEVTOOLS === '1';

const DEV_CONSOLE_NOISE_PATTERNS: RegExp[] = [
  /Autofill\.enable failed/i,
  /React Router Future Flag Warning/i,
  /Download the React DevTools/i,
];

let mainWindow: BrowserWindow | null = null;
const windowManager = new WindowManager();

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0f0f1a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, '..', 'react-ui', 'public', 'assets', 'icon.png'),
    show: false,
  });

  const trustedOrigins = new Set(['http://localhost:5173', 'http://127.0.0.1:5173', 'file://']);
  const mediaPermissions = new Set(['media', 'camera', 'microphone']);

  const isTrustedUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'file:') {
        return true;
      }
      return trustedOrigins.has(`${parsed.protocol}//${parsed.host}`);
    } catch {
      return false;
    }
  };

  win.webContents.session.setPermissionCheckHandler((_wc, permission, requestingOrigin) => {
    if (mediaPermissions.has(permission)) {
      return isTrustedUrl(requestingOrigin);
    }
    return false;
  });

  win.webContents.session.setPermissionRequestHandler((_wc, permission, callback, details) => {
    if (mediaPermissions.has(permission) && isTrustedUrl(details.requestingUrl)) {
      callback(true);
      return;
    }
    callback(false);
  });

  // Content Security Policy
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const csp = isDev
      ? "default-src 'self' http://localhost:5173; " +
        "script-src 'self' 'unsafe-inline' http://localhost:5173; " +
        "style-src 'self' 'unsafe-inline' http://localhost:5173; " +
        "connect-src 'self' ws://localhost:5173 http://localhost:5173 ws://localhost:3001 http://localhost:3001 http://localhost:8000 http://localhost:8001; " +
        "img-src 'self' data: blob: http://localhost:5173; " +
        "font-src 'self' data: http://localhost:5173"
      : "default-src 'self'; " +
        "script-src 'self'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "connect-src 'self' ws://localhost:3001 http://localhost:3001 http://localhost:8000 http://localhost:8001; " +
        "img-src 'self' data:; " +
        "font-src 'self' data:";

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });

  // Load UI
  if (isDev) {
    win.loadURL('http://localhost:5173');
    if (shouldOpenDevTools) {
      win.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    win.loadFile(path.join(__dirname, '..', 'react-ui', 'dist', 'index.html'));
  }

  // Show when ready to avoid white flash
  win.once('ready-to-show', () => {
    win.show();
    windowManager.restoreWindowState(win);
  });

  if (isDev) {
    win.webContents.on('console-message', (event, _level, message) => {
      if (DEV_CONSOLE_NOISE_PATTERNS.some((pattern) => pattern.test(message))) {
        event.preventDefault();
      }
    });
  }

  // Handle external links in default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Save window state on close
  win.on('close', () => {
    windowManager.saveWindowState(win);
  });

  win.on('closed', () => {
    mainWindow = null;
  });

  return win;
}

app.whenReady().then(() => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return;
  }

  mainWindow = createMainWindow();
  setupIpcHandlers(mainWindow);
  createTray(mainWindow);
  if (!isDev) {
    setupUpdater(mainWindow);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
      setupIpcHandlers(mainWindow);
      createTray(mainWindow);
      if (!isDev) {
        setupUpdater(mainWindow);
      }
    } else if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });
});

app.on('second-instance', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  destroyTray();
});

// Security: prevent new window creation
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    const allowedOrigins = ['http://localhost:5173', 'http://localhost:3001'];
    if (!allowedOrigins.includes(parsedUrl.origin)) {
      event.preventDefault();
    }
  });
});
