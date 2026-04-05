import { Server as SocketServer } from 'socket.io';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { sanitizeInput } from '../utils/sanitizer';
import { memoryService } from './memory.service';
import { automationService, WorkflowPermissionError, WorkflowProgressEvent } from './automation.service';
import { voiceService } from './voice.service';
import { getAiEngineAuthHeaders } from './aiAuth.service';

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://127.0.0.1:8000';
const AI_READY_TIMEOUT_MS = 45_000;

function isRetryableAiStreamError(err: unknown): boolean {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    if (status === 408 || status === 429 || (typeof status === 'number' && status >= 500)) {
      return true;
    }
    return ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED'].includes(err.code || '');
  }

  const code = (err as { code?: string })?.code;
  return ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED'].includes(code || '');
}

function normalizeSocketError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const detail = typeof err.response?.data === 'string'
      ? err.response.data
      : JSON.stringify(err.response?.data || {});
    return `code=${err.code || 'n/a'} status=${status || 'n/a'} detail=${detail}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

async function waitForAiEngineReady(timeoutMs = AI_READY_TIMEOUT_MS): Promise<boolean> {
  const startedAt = Date.now();
  let attempt = 0;

  while (Date.now() - startedAt < timeoutMs) {
    attempt += 1;
    try {
      await axios.get(`${AI_ENGINE_URL}/health`, { timeout: 2_500 });
      return true;
    } catch {
      // AI engine may still be booting.
    }

    const delayMs = Math.min(300 + attempt * 350, 2_500);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return false;
}

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
      llmProvider?: 'ollama' | 'openrouter' | 'gemini' | 'online';
      ollamaModel?: string;
      onlineModel?: string;
    }) => {
      const { message, sessionId, emotionContext, personalityMode, llmProvider, ollamaModel, onlineModel } = data;

      if (!message || typeof message !== 'string') return;

      const sanitizedMsg = sanitizeInput(message);
      if (!sanitizedMsg) {
        socket.emit('chat:complete', {
          messageId: uuidv4(),
          error: true,
          message: 'Message cannot be empty',
        });
        return;
      }

      const resolvedSessionId = sessionId || uuidv4();
      const userMsgId = uuidv4();
      const assistantMsgId = uuidv4();

      try {
        // Store user message before contacting AI; do not fail chat if persistence fails.
        try {
          await memoryService.storeMessage({
            id: userMsgId,
            sessionId: resolvedSessionId,
            role: 'user',
            content: sanitizedMsg,
          });
        } catch (persistErr) {
          logger.warn('Unable to persist user message before AI request', {
            socketId: socket.id,
            sessionId: resolvedSessionId,
            error: persistErr instanceof Error ? persistErr.message : String(persistErr),
          });
        }

        const requestChatStream = async () => {
          let lastErr: unknown;

          const ready = await waitForAiEngineReady();
          if (!ready) {
            throw new Error('AI engine is not ready yet. Please wait a moment and try again.');
          }

          for (let attempt = 1; attempt <= 8; attempt++) {
            try {
              const headers = await getAiEngineAuthHeaders();
              return await axios.post(
                `${AI_ENGINE_URL}/ai/chat`,
                {
                  sessionId: resolvedSessionId,
                  message: sanitizedMsg,
                  emotionContext,
                  personalityMode,
                  llmProvider,
                  ollamaModel,
                  onlineModel,
                  stream: true,
                },
                {
                  responseType: 'stream',
                  timeout: 150_000,
                  headers,
                }
              );
            } catch (err) {
              lastErr = err;
              const retryable = isRetryableAiStreamError(err);

              logger.warn('AI stream request failed', {
                socketId: socket.id,
                sessionId: resolvedSessionId,
                attempt,
                retryable,
                error: normalizeSocketError(err),
              });

              if (!retryable || attempt === 8) {
                throw err;
              }

              // Give AI engine more time during cold starts.
              await new Promise((resolve) => setTimeout(resolve, Math.min(attempt * 1_000, 5_000)));
            }
          }

          throw lastErr;
        };

        // Stream from AI engine
        const response = await requestChatStream();

        let fullContent = '';
        let finalActions: unknown[] | undefined;
        let finalIntent: string | undefined;
        let finalError: string | undefined;
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

            if (typeof parsed.error === 'string' && parsed.error.trim()) {
              finalError = parsed.error;
              // Make error visible in chat timeline instead of ending with an empty assistant bubble.
              if (!fullContent) {
                fullContent = parsed.error;
              }
              socket.emit('chat:token', { token: parsed.error });
            }

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
            error: Boolean(finalError),
          });

          // Store assistant message; log and continue if persistence fails.
          if (fullContent) {
            try {
              await memoryService.storeMessage({
                id: assistantMsgId,
                sessionId: resolvedSessionId,
                role: 'assistant',
                content: fullContent,
              });
            } catch (persistErr) {
              logger.warn('Unable to persist assistant message after AI stream', {
                socketId: socket.id,
                sessionId: resolvedSessionId,
                error: persistErr instanceof Error ? persistErr.message : String(persistErr),
              });
            }
          }
        });

        response.data.on('error', (err: Error) => {
          logger.error('AI stream error', {
            socketId: socket.id,
            sessionId: resolvedSessionId,
            error: err.message,
          });
          socket.emit('chat:complete', { messageId: assistantMsgId, error: true, message: 'AI stream interrupted' });
        });
      } catch (err) {
        logger.error('Failed to connect to AI engine', {
          socketId: socket.id,
          sessionId: resolvedSessionId,
          error: normalizeSocketError(err),
        });
        // Fallback: send an error message token
        const errMsg = 'I could not connect to the AI engine. Ensure the AI engine is running (npm run start:ai) and your selected model provider is configured.';
        for (const char of errMsg) {
          socket.emit('chat:token', { token: char });
          await new Promise((r) => setTimeout(r, 10));
        }
        socket.emit('chat:complete', { messageId: assistantMsgId, error: true, message: errMsg });
      }
    });

    // Emotion signal handler
    socket.on('emotion:signal', async (data: {
      typing_wpm?: number;
      errors?: number;
      typing_pause_ms?: number;
      time_of_day?: string;
      voice_pitch?: number;
      voice_energy?: number;
      voice_speech_rate?: number;
      voice_jitter?: number;
      webcam_face_engagement?: number;
      webcam_eye_strain?: number;
    }) => {
      try {
        const headers = await getAiEngineAuthHeaders();
        const res = await axios.post<{ state: string; confidence: number }>(
          `${AI_ENGINE_URL}/ai/emotion`,
          data,
          { timeout: 5_000, headers }
        );
        socket.emit('emotion:update', res.data);
      } catch (err) {
        logger.debug('Emotion update failed', {
          socketId: socket.id,
          error: err instanceof Error ? err.message : String(err),
        });
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
      } catch (err) {
        logger.warn('voice:start failed', {
          socketId: socket.id,
          error: err instanceof Error ? err.message : String(err),
        });
        socket.emit('voice:status', { status: 'idle', error: true });
      }
    });

    socket.on('voice:stop', async () => {
      try {
        voiceService.stopStreamConnection(socket.id);
        const session = await voiceService.stopSession();
        socket.emit('voice:status', { status: session.status });
      } catch (err) {
        logger.warn('voice:stop failed', {
          socketId: socket.id,
          error: err instanceof Error ? err.message : String(err),
        });
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
          // Stream may still be opening; drop frame quietly to avoid false idle/error churn.
          logger.debug('voice:audio dropped frame (stream not ready)', {
            socketId: socket.id,
          });
        }
      } catch (err) {
        logger.warn('voice:audio processing failed', {
          socketId: socket.id,
          error: err instanceof Error ? err.message : String(err),
        });
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
