export {};

declare global {
  interface Window {
    electronAPI?: {
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      isMaximized: () => Promise<boolean>;
      getAppAnchor: (request: {
        appName?: string;
        preset?: 'hud' | 'widget';
      }) => Promise<{
        x: number;
        y: number;
        source: 'app-window' | 'main-window';
        appName?: string;
        matchedWindowTitle?: string;
        matchedOwnerName?: string;
        timestamp: string;
      }>;
      on: (channel: string, cb: (...args: unknown[]) => void) => void;
      off: (channel: string, cb: (...args: unknown[]) => void) => void;
    };
  }
}
