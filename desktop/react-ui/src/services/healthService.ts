import { checkBackendHealth, checkAiEngineHealth } from './api';

export interface HealthStatus {
  backend: boolean;
  aiEngine: boolean;
  allHealthy: boolean;
  timestamp: Date;
}

class HealthService {
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private healthCheckCallbacks: ((status: HealthStatus) => void)[] = [];
  private currentStatus: HealthStatus = {
    backend: false,
    aiEngine: false,
    allHealthy: false,
    timestamp: new Date(),
  };

  /**
   * Subscribe to health status changes
   */
  subscribe(callback: (status: HealthStatus) => void): () => void {
    this.healthCheckCallbacks.push(callback);
    // Immediately call with current status
    callback(this.currentStatus);
    return () => {
      this.healthCheckCallbacks = this.healthCheckCallbacks.filter((cb) => cb !== callback);
    };
  }

  /**
   * Notify all subscribers of status change
   */
  private notifySubscribers() {
    this.healthCheckCallbacks.forEach((callback) => {
      try {
        callback(this.currentStatus);
      } catch (error) {
        console.error('[HealthService] Subscriber callback error:', error);
      }
    });
  }

  /**
   * Perform a single health check
   */
  async checkHealth(): Promise<HealthStatus> {
    try {
      const [backendHealthy, aiEngineHealthy] = await Promise.all([
        checkBackendHealth(),
        checkAiEngineHealth(),
      ]);

      this.currentStatus = {
        backend: backendHealthy,
        aiEngine: aiEngineHealthy,
        allHealthy: backendHealthy && aiEngineHealthy,
        timestamp: new Date(),
      };

      this.notifySubscribers();
      return this.currentStatus;
    } catch (error) {
      console.error('[HealthService] Health check failed:', error);
      this.currentStatus = {
        backend: false,
        aiEngine: false,
        allHealthy: false,
        timestamp: new Date(),
      };
      this.notifySubscribers();
      return this.currentStatus;
    }
  }

  /**
   * Start periodic health checks
   */
  startMonitoring(intervalMs: number = 10000): void {
    if (this.healthCheckInterval) {
      return; // Already running
    }

    console.log('[HealthService] Starting health monitoring');
    this.checkHealth(); // Check immediately

    this.healthCheckInterval = setInterval(async () => {
      await this.checkHealth();
    }, intervalMs);
  }

  /**
   * Stop periodic health checks
   */
  stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('[HealthService] Stopped health monitoring');
    }
  }

  /**
   * Get current status
   */
  getStatus(): HealthStatus {
    return this.currentStatus;
  }
}

// Singleton instance
export const healthService = new HealthService();
