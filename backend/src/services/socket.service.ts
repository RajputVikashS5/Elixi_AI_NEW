import { Server as SocketServer } from 'socket.io';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { sanitizeInput } from '../utils/sanitizer';
import { memoryService } from './memory.service';
import { automationService, WorkflowProgressEvent } from './automation.service';

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8000';

export function setupSocketHandlers(io: SocketServer): void {
  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });

    // Main chat streaming handler
    socket.on('chat:send', async (data: {
      message: string;
      sessionId: string;
      emotionContext?: object;
      personalityMode?: string;
      ollamaModel?: string;
    }) => {
      const { message, sessionId, emotionContext, personalityMode, ollamaModel } = data;

      if (!message || typeof message !== 'string') return;

      const sanitizedMsg = sanitizeInput(message);
      const userMsgId = uuidv4();
      const assistantMsgId = uuidv4();

      // Store user message
      await memoryService.storeMessage({
        id: userMsgId,
        sessionId: sessionId || uuidv4(),
        role: 'user',
        content: sanitizedMsg,
      });

      try {
        // Stream from AI engine
        const response = await axios.post(
          `${AI_ENGINE_URL}/ai/chat`,
          { sessionId, message: sanitizedMsg, emotionContext, personalityMode, ollamaModel, stream: true },
          {
            responseType: 'stream',
            timeout: 120_000,
          }
        );

        let fullContent = '';

        response.data.on('data', (chunk: Buffer) => {
          const text = chunk.toString();
          // Parse SSE-style chunks from FastAPI
          const lines = text.split('\n').filter((l: string) => l.startsWith('data: '));
          for (const line of lines) {
            const payload = line.slice(6).trim();
            if (payload === '[DONE]') continue;
            try {
              const parsed = JSON.parse(payload);
              const token = parsed.token || parsed.content || '';
              if (token) {
                fullContent += token;
                socket.emit('chat:token', { token });
              }
            } catch {
              // Non-JSON chunk, treat as raw token
              if (payload && payload !== '[DONE]') {
                fullContent += payload;
                socket.emit('chat:token', { token: payload });
              }
            }
          }
        });

        response.data.on('end', async () => {
          socket.emit('chat:complete', {
            messageId: assistantMsgId,
            intent: 'chat.general',
          });

          // Store assistant message
          await memoryService.storeMessage({
            id: assistantMsgId,
            sessionId: sessionId || uuidv4(),
            role: 'assistant',
            content: fullContent,
          });
        });

        response.data.on('error', (err: Error) => {
          logger.error('AI stream error:', err);
          socket.emit('chat:complete', { messageId: assistantMsgId, error: true });
        });
      } catch (err) {
        logger.error('Failed to connect to AI engine:', err);
        // Fallback: send an error message token
        const errMsg = 'I could not connect to the AI engine. Please ensure Ollama is running and the AI engine is started (npm run start:ai).';
        for (const char of errMsg) {
          socket.emit('chat:token', { token: char });
          await new Promise((r) => setTimeout(r, 10));
        }
        socket.emit('chat:complete', { messageId: assistantMsgId });
      }
    });

    // Emotion signal handler
    socket.on('emotion:signal', async (data: { typing_wpm: number; errors: number }) => {
      try {
        const res = await axios.post<{ state: string; confidence: number }>(
          `${AI_ENGINE_URL}/ai/emotion`,
          data,
          { timeout: 5_000 }
        );
        socket.emit('emotion:update', res.data);
      } catch {
        // Silently fail emotion updates
      }
    });

    socket.on('automation:run', async (data: { workflowId?: string }) => {
      const workflowId = data?.workflowId;
      if (!workflowId) {
        socket.emit('automation:complete', {
          workflowId,
          error: true,
          message: 'workflowId is required',
        });
        return;
      }

      const runId = uuidv4();

      try {
        socket.emit('automation:started', { runId, workflowId });

        const result = await automationService.runWorkflow(workflowId, {
          runId,
          onProgress: (event: WorkflowProgressEvent) => {
            socket.emit('automation:progress', event);
          },
        });

        socket.emit('automation:complete', {
          runId,
          workflowId,
          result,
        });
      } catch (err) {
        logger.error('Socket automation run failed:', err);
        socket.emit('automation:complete', {
          runId,
          workflowId,
          error: true,
          message: err instanceof Error ? err.message : 'Failed to run workflow',
        });
      }
    });
  });
}
