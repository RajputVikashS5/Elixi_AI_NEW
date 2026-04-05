import { Router, Request, Response } from 'express';
import axios from 'axios';
import { chatWithAi, getActiveProviderDebug, getProviderStatus } from '../controllers/ai.controller';
import { getAiEngineAuthHeaders } from '../services/aiAuth.service';
import { logger } from '../utils/logger';

export const aiRoutes = Router();

aiRoutes.post('/chat', chatWithAi);
aiRoutes.get('/providers/status', getProviderStatus);
aiRoutes.get('/providers/active', getActiveProviderDebug);

/**
 * Retry helper for AI engine requests with exponential backoff
 */
async function retryWithBackoff(
  fn: () => Promise<any>,
  maxAttempts: number = 3,
  baseDelayMs: number = 500,
): Promise<any> {
  let lastError: any;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts - 1) {
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        logger.debug(`[AI Proxy] Retry ${attempt + 1}/${maxAttempts} after ${delayMs}ms`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}

function isRetryableConnectionError(err: unknown): boolean {
  if (!axios.isAxiosError(err)) {
    return false;
  }
  const code = err.code || '';
  return ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED'].includes(code);
}

/**
 * Catch-all proxy for unknown /ai/* routes
 * Forwards unmatched requests to the AI engine with retry logic
 */
aiRoutes.all('*', async (req: Request, res: Response) => {
  try {
    const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://127.0.0.1:8000';
    const authHeaders = await getAiEngineAuthHeaders();
    
    // Construct full path: /ai/camera/disable becomes http://localhost:8000/ai/camera/disable
    const fullPath = `/ai${req.baseUrl}${req.path}`.replace('/ai/ai', '/ai');
    const fullUrl = `${AI_ENGINE_URL}${fullPath}`;
    
    logger.debug(`[AI Proxy] ${req.method} ${fullPath} -> ${fullUrl}`);

    const response = await retryWithBackoff(() =>
      axios({
        method: req.method.toLowerCase() as any,
        url: fullUrl,
        data: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
        headers: {
          ...authHeaders,
          'Content-Type': req.headers['content-type'] || 'application/json',
        },
        timeout: 10000,
        validateStatus: () => true, // Don't throw on any status code
      }),
    );

    res.status(response.status).set(response.headers).json(response.data);
  } catch (error: any) {
    const fullPath = `/ai${req.baseUrl}${req.path}`.replace('/ai/ai', '/ai');
    const isCameraDisable = req.method === 'POST' && fullPath === '/ai/camera/disable';

    // Camera disable is idempotent; if AI is not up yet, treat as effectively disabled.
    if (isCameraDisable && isRetryableConnectionError(error)) {
      logger.warn('[AI Proxy] AI unavailable during camera disable; returning graceful success');
      res.status(200).json({
        enabled: false,
        status: {
          state: 'unavailable',
          detail: 'AI engine unreachable during startup; camera considered disabled.',
        },
      });
      return;
    }

    logger.warn(`[AI Proxy] Failed to proxy request: ${error.message}`);
    res.status(502).json({
      error: 'AI Engine proxy failed',
      message: error.message,
    });
  }
});
