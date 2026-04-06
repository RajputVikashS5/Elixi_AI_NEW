import axios from 'axios';
import WebSocket from 'ws';
import { logger } from '../utils/logger';

export interface BrowserTab {
  id: string;
  title: string;
  url: string;
  type: string;
  webSocketDebuggerUrl?: string;
}

export interface BrowserVersionInfo {
  browser: string;
  protocolVersion: string;
  userAgent: string;
  webSocketDebuggerUrl?: string;
}

export interface BrowserEvaluateResult {
  value?: unknown;
  type?: string;
  description?: string;
}

export class BrowserIntegrationService {
  constructor(private readonly debugHost = process.env.BROWSER_DEBUG_HOST || '127.0.0.1', private readonly debugPort = Number(process.env.BROWSER_DEBUG_PORT || 9222)) {}

  private get baseUrl(): string {
    return `http://${this.debugHost}:${this.debugPort}`;
  }

  async getVersion(): Promise<BrowserVersionInfo> {
    const response = await axios.get(`${this.baseUrl}/json/version`, { timeout: 5000 });
    return {
      browser: response.data.Browser,
      protocolVersion: response.data['Protocol-Version'],
      userAgent: response.data['User-Agent'],
      webSocketDebuggerUrl: response.data.webSocketDebuggerUrl,
    };
  }

  async listTabs(): Promise<BrowserTab[]> {
    const response = await axios.get(`${this.baseUrl}/json/list`, { timeout: 5000 });
    const tabs = Array.isArray(response.data) ? response.data : [];
    return tabs.map((tab: any) => ({
      id: String(tab.id || ''),
      title: String(tab.title || ''),
      url: String(tab.url || ''),
      type: String(tab.type || 'page'),
      webSocketDebuggerUrl: tab.webSocketDebuggerUrl ? String(tab.webSocketDebuggerUrl) : undefined,
    }));
  }

  async openUrl(url: string): Promise<void> {
    await axios.get(`${this.baseUrl}/json/new?${encodeURIComponent(url)}`, { timeout: 5000 });
  }

  async closeTab(tabId: string): Promise<void> {
    await axios.get(`${this.baseUrl}/json/close/${encodeURIComponent(tabId)}`, { timeout: 5000 });
  }

  async activateTab(tabId: string): Promise<void> {
    await axios.get(`${this.baseUrl}/json/activate/${encodeURIComponent(tabId)}`, { timeout: 5000 });
  }

  async evaluate(tabId: string, expression: string): Promise<BrowserEvaluateResult> {
    const tabs = await this.listTabs();
    const target = tabs.find((tab) => tab.id === tabId && tab.webSocketDebuggerUrl);
    if (!target?.webSocketDebuggerUrl) {
      throw new Error('Target tab not found or not debuggable');
    }

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    return await new Promise<BrowserEvaluateResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.terminate();
        reject(new Error('Browser evaluate timeout'));
      }, 7000);

      ws.on('open', () => {
        const payload = {
          id: 1,
          method: 'Runtime.evaluate',
          params: {
            expression,
            returnByValue: true,
            awaitPromise: true,
          },
        };
        ws.send(JSON.stringify(payload));
      });

      ws.on('message', (raw) => {
        try {
          const data = JSON.parse(raw.toString());
          if (data.id !== 1) {
            return;
          }
          clearTimeout(timeout);
          ws.close();

          if (data.error) {
            reject(new Error(data.error.message || 'CDP error'));
            return;
          }

          if (data.result?.exceptionDetails) {
            reject(new Error(data.result.exceptionDetails.text || 'Evaluation exception'));
            return;
          }

          const result = data.result?.result;
          resolve({
            value: result?.value,
            type: result?.type,
            description: result?.description,
          });
        } catch (error) {
          clearTimeout(timeout);
          ws.close();
          reject(error instanceof Error ? error : new Error('Failed to parse CDP response'));
        }
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  async healthCheck(): Promise<{ available: boolean; details?: BrowserVersionInfo; error?: string }> {
    try {
      const details = await this.getVersion();
      return { available: true, details };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Browser debug endpoint unavailable';
      logger.warn('Browser integration health check failed', { error: message });
      return { available: false, error: message };
    }
  }
}

export const browserIntegrationService = new BrowserIntegrationService();
