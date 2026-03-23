import { Server as SocketServer } from 'socket.io';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { sanitizeInput } from '../utils/sanitizer';
import { memoryService } from './memory.service';
import { automationService, WorkflowPermissionError, WorkflowProgressEvent } from './automation.service';
import { voiceService } from './voice.service';

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://localhost:8000';

export function setupSocketHandlers(io: SocketServer): void {
  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    socket.on('disconnect', () => {
      voiceService.stopStreamConnection(socket.id);
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
        let finalActions: unknown[] | undefined;
        let finalIntent: string | undefined;
        let pendingChunk = '';

        const processStreamLine = (line: string) => {
          const trimmed = line.trim();
          if (!trimmed) return;

          const payload = trimmed.startsWith('data:')
            ? trimmed.slice(5).trim()
            : trimmed;

          if (!payload || payload === '[DONE]') {
            return;
          }

          try {
            const parsed = JSON.parse(payload);

            if (parsed.done) {
              finalActions = parsed.actions;
              finalIntent = parsed.intent;
              if (!fullContent && typeof parsed.content === 'string') {
                fullContent = parsed.content;
              }
              return;
            }

            const token = typeof parsed.token === 'string'
              ? parsed.token
              : (typeof parsed.message?.content === 'string' ? parsed.message.content : '');

            if (token) {
              fullContent += token;
              socket.emit('chat:token', { token });
            }
          } catch {
            // If JSON parsing fails, treat the payload as a raw text token.
            fullContent += payload;
            socket.emit('chat:token', { token: payload });
          }
        };

        response.data.on('data', (chunk: Buffer) => {
          const text = pendingChunk + chunk.toString('utf8');
          const lines = text.split(/\r?\n/);
          pendingChunk = lines.pop() || '';

          for (const line of lines) {
            processStreamLine(line);
          }
        });

        response.data.on('end', async () => {
          if (pendingChunk.trim()) {
            processStreamLine(pendingChunk);
            pendingChunk = '';
          }

          socket.emit('chat:complete', {
            messageId: assistantMsgId,
            intent: finalIntent || 'chat.general',
            actions: finalActions,
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

    socket.on('voice:start', async (data: { sessionId?: string }) => {
      try {
        const sessionId = data?.sessionId || uuidv4();
        const session = await voiceService.startSession(sessionId);

        await voiceService.startStreamConnection(socket.id, sessionId, {
          onTranscript: ({ text, final }) => {
            socket.emit('voice:transcript', { text, final });
          },
          onStatus: ({ status }) => {
            socket.emit('voice:status', { status });
          },
          onError: () => {
            socket.emit('voice:status', { status: 'idle', error: true });
          },
        });

        socket.emit('voice:status', { status: session.status });
      } catch {
        socket.emit('voice:status', { status: 'idle', error: true });
      }
    });

    socket.on('voice:stop', async () => {
      try {
        voiceService.stopStreamConnection(socket.id);
        const session = await voiceService.stopSession();
        socket.emit('voice:status', { status: session.status });
      } catch {
        socket.emit('voice:status', { status: 'idle', error: true });
      }
    });

    socket.on('voice:audio', (data: { audioBase64?: string; format?: string; sampleRate?: number; channels?: number }) => {
      const audioBase64 = data?.audioBase64;
      if (!audioBase64) {
        return;
      }

      try {
        const frame = Buffer.from(audioBase64, 'base64');
        if (!frame.length) {
          return;
        }

        const format = data?.format === 'wav' ? 'wav' : 'pcm_s16le';
        const sampleRate = Number.isFinite(data?.sampleRate) && (data?.sampleRate ?? 0) > 0
          ? Number(data?.sampleRate)
          : 16000;
        const channels = Number.isFinite(data?.channels) && (data?.channels ?? 0) > 0
          ? Number(data?.channels)
          : 1;

        const forwarded = voiceService.sendAudioFrame(socket.id, {
          audioBase64,
          format,
          sampleRate,
          channels,
        });
        if (!forwarded) {
          socket.emit('voice:status', { status: 'idle', error: true });
        }
      } catch {
        socket.emit('voice:status', { status: 'idle', error: true });
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

        if (err instanceof WorkflowPermissionError) {
          socket.emit('automation:complete', {
            runId,
            workflowId,
            error: true,
            message: err.message,
            requiresApproval: err.detail.requiresApproval,
            prohibited: err.detail.prohibited,
            commandPattern: err.detail.commandPattern,
            tier: err.detail.tier,
            stepIndex: err.detail.stepIndex,
          });
          return;
        }

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
