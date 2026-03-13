import { BrowserWindow, screen } from 'electron';

interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

export class WindowManager {
  private state: WindowState = {
    width: 1200,
    height: 800,
    isMaximized: false,
  };

  saveWindowState(win: BrowserWindow): void {
    if (!win.isDestroyed()) {
      const bounds = win.getBounds();
      this.state = {
        ...bounds,
        isMaximized: win.isMaximized(),
      };
    }
  }

  restoreWindowState(win: BrowserWindow): void {
    if (this.state.isMaximized) {
      win.maximize();
      return;
    }

    const { width, height, x, y } = this.state;

    // Validate position is within visible screen area
    if (x !== undefined && y !== undefined) {
      const displays = screen.getAllDisplays();
      const isVisible = displays.some((display) => {
        const bounds = display.workArea;
        return (
          x >= bounds.x &&
          y >= bounds.y &&
          x + width <= bounds.x + bounds.width &&
          y + height <= bounds.y + bounds.height
        );
      });

      if (isVisible) {
        win.setBounds({ x, y, width, height });
        return;
      }
    }

    // Default centered position
    win.setSize(width, height);
    win.center();
  }
}
