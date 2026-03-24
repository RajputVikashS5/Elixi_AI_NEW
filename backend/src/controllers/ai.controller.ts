import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { aiService } from '../services/ai.service';
import { logger } from '../utils/logger';

const aiChatSchema = z.object({
  message: z.string().min(1).max(20_000),
  personalityMode: z.enum(['professional', 'casual', 'friendly', 'calm', 'concise', 'creative', 'focus', 'silent']).optional(),
  llmProvider: z.enum(['ollama', 'openrouter', 'gemini', 'online']).optional(),
  onlineModel: z.string().min(1).max(200).optional(),
  ollamaModel: z.string().min(1).max(100).optional(),
  emotionContext: z.object({
    state: z.string().min(1).max(100).optional(),
    confidence: z.number().min(0).max(1).optional(),
  }).optional(),
  stream: z.boolean().optional().default(false),
});

function splitIntoChunks(text: string, chunkSize = 80): string[] {
  const chunks: string[] = [];
  for (let start = 0; start < text.length; start += chunkSize) {
    chunks.push(text.slice(start, start + chunkSize));
  }
  return chunks;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function chatWithAi(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = aiChatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: parsed.error.issues,
      });
    }

    const result = await aiService.chatWithFallback(parsed.data);

    if (!parsed.data.stream) {
      return res.json(result);
    }

    // Streaming mode uses SSE, sending the same final payload progressively as chunks.
    let clientDisconnected = false;
    req.on('close', () => {
      clientDisconnected = true;
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const chunks = splitIntoChunks(result.reply);
    for (const chunk of chunks) {
      if (clientDisconnected || res.writableEnded) {
        break;
      }
      res.write(`data: ${JSON.stringify({ success: true, provider: result.provider, chunk })}\n\n`);
      await delay(15);
    }

    if (!clientDisconnected && !res.writableEnded) {
      res.write(`data: ${JSON.stringify(result)}\n\n`);
      res.write('event: done\\ndata: [DONE]\\n\\n');
      res.end();
    }
    return;
  } catch (err) {
    logger.error('AI chat endpoint failed', {
      error: err instanceof Error ? err.message : String(err),
      path: req.path,
      method: req.method,
    });
    next(err);
  }
}

export async function getProviderStatus(_req: Request, res: Response, next: NextFunction) {
  try {
    const status = await aiService.getProviderStatus();
    return res.json(status);
  } catch (err) {
    logger.error('Provider status check failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    next(err);
  }
}

export function getActiveProviderDebug(_req: Request, res: Response) {
  return res.json(aiService.getActiveProviderDebug());
}
