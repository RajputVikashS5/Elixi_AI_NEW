import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { aiService } from '../services/ai.service';
import { memoryService } from '../services/memory.service';
import { sanitizeInput } from '../utils/sanitizer';

const sendMessageSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1).max(4000),
  emotionContext: z.object({
    state: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
  }).optional(),
  personalityMode: z.enum(['professional', 'friendly', 'calm', 'focus', 'silent']).optional(),
  llmProvider: z.enum(['ollama', 'openrouter', 'gemini', 'online']).optional(),
  ollamaModel: z.enum(['llama3', 'mistral', 'llama3:8b', 'mistral:7b']).optional(),
  onlineModel: z.string().min(1).max(200).optional(),
});

export async function sendMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
    }

    const { sessionId, message, emotionContext, personalityMode, llmProvider, ollamaModel, onlineModel } = parsed.data;
    const sanitizedMessage = sanitizeInput(message);

    // Store user message
    await memoryService.storeMessage({
      id: uuidv4(),
      sessionId,
      role: 'user',
      content: sanitizedMessage,
      emotionState: emotionContext?.state,
    });

    // Get AI response (prefer AI engine; fallback to provider router for resiliency)
    let response = await aiService.chat({
      sessionId,
      message: sanitizedMessage,
      emotionContext,
      personalityMode,
      llmProvider,
      ollamaModel,
      onlineModel,
    }).catch(async () => {
      if (llmProvider !== 'ollama') {
        throw new Error('AI Engine unavailable for requested provider');
      }

      const fallback = await aiService.chatWithFallback({
        message: sanitizedMessage,
        personalityMode,
        llmProvider,
        ollamaModel,
        onlineModel,
        emotionContext,
        stream: false,
      });

      return {
        content: fallback.reply,
        intent: 'chat.general',
        actions: [],
      };
    });

    const assistantMessageId = uuidv4();

    // Store assistant message
    await memoryService.storeMessage({
      id: assistantMessageId,
      sessionId,
      role: 'assistant',
      content: response.content,
      intent: response.intent,
    });

    return res.json({
      success: true,
      messageId: assistantMessageId,
      response: response.content,
      intent: response.intent,
      actions: response.actions,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function getHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }
    const messages = await memoryService.getMessages(sessionId);
    return res.json({ messages });
  } catch (err) {
    next(err);
  }
}

export async function clearHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }
    await memoryService.clearMessages(sessionId);
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
