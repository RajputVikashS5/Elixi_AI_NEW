import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSettingsStore } from '../store/settingsStore';
import { useChatStore } from '../store/chatStore';
import { useEmotionStore } from '../store/emotionStore';
import { useVoiceStore } from '../store/voiceStore';
import { voiceService } from '../services/voiceService';
import { ActionResult } from '../store/chatStore';

let socket: Socket | null = null;
let socketBaseUrl: string | null = null;
const STREAM_TIMEOUT_MS = 90_000;

function normalizeActions(actions: unknown[] | undefined): ActionResult[] | undefined {
  if (!Array.isArray(actions) || actions.length === 0) {
    return undefined;
  }

  const normalized = actions
    .map((raw) => {
      if (!raw || typeof raw !== 'object') {
        return null;
      }

      const source = raw as {
        type?: unknown;
        target?: unknown;
        status?: unknown;
        error?: unknown;
      };

      const type = typeof source.type === 'string' && source.type.trim().length > 0
        ? source.type
        : 'action';
      const status = source.status === 'executed' || source.status === 'failed' || source.status === 'pending'
        ? source.status
        : 'pending';

      return {
        type,
        target: typeof source.target === 'string' ? source.target : undefined,
        status,
        error: typeof source.error === 'string' ? source.error : undefined,
      } satisfies ActionResult;
    })
    .filter((item): item is ActionResult => Boolean(item));

  return normalized.length ? normalized : undefined;
}

function stripSpeechMarkup(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s{0,3}[#>*-]\s+/gm, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/\{\s*"[^"]+"\s*:\s*[^}]+\}/g, ' ')
    .replace(/[\*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function speakWithBrowser(text: string): Promise<boolean> {
  const speechApi = window.speechSynthesis;
  if (!speechApi || typeof SpeechSynthesisUtterance === 'undefined') {
    return false;
  }

  return await new Promise<boolean>((resolve) => {
    try {
      speechApi.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.onend = () => resolve(true);
      utterance.onerror = () => resolve(false);
      speechApi.speak(utterance);
    } catch {
      resolve(false);
    }
  });
}

export type SocketConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'failed';

export type AutomationProgressStatus = 'started' | 'running' | 'success' | 'failed' | 'completed';

export interface AutomationProgressEvent {
  runId: string;
  workflowId: string;
  workflowName?: string;
  status: AutomationProgressStatus;
  stepIndex: number;
  totalSteps: number;
  step?: {
    action: string;
    target?: string;
    cmd?: string;
    url?: string;
    delay?: number;
  };
  error?: string;
  timestamp?: string;
}

interface AutomationStartedPayload {
  runId: string;
  workflowId: string;
}

interface AutomationCompletePayload {
  runId: string;
  workflowId: string;
  error?: boolean;
  message?: string;
}

interface UseSocketOptions {
  enableRealtimeHandlers?: boolean;
}

export function useSocket(options: UseSocketOptions = {}) {
  const enableRealtimeHandlers = options.enableRealtimeHandlers ?? true;
  const { backendUrl, voiceEnabled } = useSettingsStore();
  const { appendToken, updateMessage, setStreaming } = useChatStore();
  const { updateEmotion } = useEmotionStore();
  const { setStatus, setTranscript } = useVoiceStore();
  const currentMsgId = useRef<string | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const streamTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [connectionState, setConnectionState] = useState<SocketConnectionState>('connecting');
  const [connectionError, setConnectionError] = useState<string>('Connecting to backend...');

  const clearStreamWatchdog = useCallback(() => {
    if (streamTimeoutRef.current) {
      clearTimeout(streamTimeoutRef.current);
      streamTimeoutRef.current = null;
    }
  }, []);

  const startStreamWatchdog = useCallback(() => {
    clearStreamWatchdog();
    streamTimeoutRef.current = setTimeout(() => {
      const pendingId = currentMsgId.current;
      if (!pendingId) {
        return;
      }

      const currentMessage = useChatStore.getState().messages.find((m) => m.id === pendingId);
      const hasContent = Boolean(currentMessage?.content?.trim());

      updateMessage(pendingId, {
        isStreaming: false,
        intent: 'chat.error',
        content: hasContent
          ? currentMessage?.content || ''
          : 'Connection timed out while waiting for response. Please try again.',
      });
      currentMsgId.current = null;
      setStreaming(false);
      clearStreamWatchdog();
    }, STREAM_TIMEOUT_MS);
  }, [clearStreamWatchdog, setStreaming, updateMessage]);

  const playAssistantTts = useCallback(async (replyText: string) => {
    const text = stripSpeechMarkup(replyText);
    if (!voiceEnabled || !text) {
      return;
    }

    try {
      const tts = await voiceService.tts(text);
      const payload = tts?.data;
      if (!tts?.success || !payload?.audioBase64) {
        return;
      }

      if (ttsAudioRef.current) {
        try {
          ttsAudioRef.current.pause();
        } catch {
          // Ignore pause errors while replacing audio.
        }
      }

      const mimeType = payload.mimeType || 'audio/wav';
      const audio = new Audio(`data:${mimeType};base64,${payload.audioBase64}`);
      ttsAudioRef.current = audio;

      audio.onended = () => {
        setStatus('idle');
      };
      audio.onerror = () => {
        setStatus('idle');
      };

      setStatus('speaking');
      await audio.play();
    } catch (err) {
      console.warn('[ELIXI] Assistant TTS playback failed, falling back to browser speech', err);
      const spoken = await speakWithBrowser(text);
      setStatus('idle');
      if (!spoken) {
        console.warn('[ELIXI] Browser speech synthesis also failed');
      }
    }
  }, [setStatus, voiceEnabled]);

  useEffect(() => {
    if (socket && socketBaseUrl !== backendUrl) {
      socket.disconnect();
      socket = null;
      socketBaseUrl = null;
    }

    if (!socket) {
      setConnectionState('connecting');
      setConnectionError(`Connecting to backend at ${backendUrl}...`);

      socket = io(backendUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });
      socketBaseUrl = backendUrl;
    }

    const onConnect = () => {
      console.log('[ELIXI] Socket connected');
      setConnectionState('connected');
      setConnectionError('');
    };

    const onDisconnect = () => {
      console.log('[ELIXI] Socket disconnected');
      setConnectionState('disconnected');
      setConnectionError(`Backend disconnected. ELIXI cannot chat until ${backendUrl} is available.`);
      const pendingId = currentMsgId.current;
      if (!pendingId) {
        setStreaming(false);
        clearStreamWatchdog();
        return;
      }

      const currentMessage = useChatStore.getState().messages.find((m) => m.id === pendingId);
      const hasContent = Boolean(currentMessage?.content?.trim());

      updateMessage(pendingId, {
        isStreaming: false,
        intent: 'chat.error',
        content: hasContent
          ? currentMessage?.content || ''
          : 'Connection lost before response completed. Please retry.',
      });
      currentMsgId.current = null;
      setStreaming(false);
      clearStreamWatchdog();
    };

    const onConnectError = (err: Error) => {
      setConnectionState('failed');
      setConnectionError(`Unable to reach backend at ${backendUrl}: ${err.message}`);
    };

    const onReconnectAttempt = () => {
      setConnectionState('reconnecting');
      setConnectionError(`Reconnecting to backend at ${backendUrl}...`);
    };

    const onReconnect = () => {
      setConnectionState('connected');
      setConnectionError('');
    };

    const onReconnectFailed = () => {
      setConnectionState('failed');
      setConnectionError(`Unable to reconnect to backend at ${backendUrl}.`);
    };

    const onChatToken = ({ token }: { token: string }) => {
      if (currentMsgId.current) {
        appendToken(currentMsgId.current, token);
        startStreamWatchdog();
      }
    };

    const onChatComplete = ({ actions, intent, voiceTone, error, message }: {
      messageId: string;
      actions?: unknown[];
      intent?: string;
      voiceTone?: string;
      error?: boolean;
      message?: string;
    }) => {
      let finalContent = '';
      if (currentMsgId.current) {
        const currentId = currentMsgId.current;
        const currentMessage = useChatStore.getState().messages.find((m) => m.id === currentId);
        finalContent = currentMessage?.content || '';

        const nextContent = error && !finalContent && message
          ? message
          : undefined;

        const normalizedActions = normalizeActions(actions);

        updateMessage(currentMsgId.current, {
          isStreaming: false,
          actions: normalizedActions,
          intent,
          voiceTone,
          ...(nextContent ? { content: nextContent } : {}),
          ...(error ? { intent: intent || 'chat.error' } : {}),
        });
        currentMsgId.current = null;
      }
      setStreaming(false);
      clearStreamWatchdog();

      if (!error && finalContent) {
        void playAssistantTts(finalContent);
      }
    };

    const onEmotionUpdate = ({
      state,
      confidence,
      signals,
    }: {
      state: string;
      confidence: number;
      signals?: Array<{
        source?: string;
        state?: string;
        confidence?: number;
        weight?: number;
        summary?: string;
      }>;
    }) => {
      const sources = Array.isArray(signals)
        ? Array.from(
            new Set(
              signals
                .map((signal) => (typeof signal?.source === 'string' ? signal.source : null))
                .filter((source): source is string => Boolean(source))
            )
          )
        : [];

      const summaries = Array.isArray(signals)
        ? signals
            .map((signal) => (typeof signal?.summary === 'string' ? signal.summary : null))
            .filter((summary): summary is string => Boolean(summary))
            .slice(0, 3)
        : [];

      const rawSignals = Array.isArray(signals)
        ? signals.map((signal) => ({
            source: typeof signal?.source === 'string' ? signal.source : 'unknown',
            state: typeof signal?.state === 'string' ? signal.state : 'neutral',
            confidence: typeof signal?.confidence === 'number' ? signal.confidence : 0,
            weight: typeof signal?.weight === 'number' ? signal.weight : undefined,
            summary: typeof signal?.summary === 'string' ? signal.summary : undefined,
          }))
        : [];

      updateEmotion(state as never, confidence, {
        sources,
        summaries,
        rawSignals,
      });
    };

    const onVoiceTranscript = ({ text, final }: { text: string; final: boolean }) => {
      setTranscript(text);
      if (final) {
        setStatus('processing');
      }
    };

    const onVoiceStatus = ({ status }: { status: 'idle' | 'listening' | 'processing' | 'speaking' | 'wake-word' }) => {
      setStatus(status);
    };

    if (enableRealtimeHandlers) {
      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      socket.on('connect_error', onConnectError);
      socket.on('reconnect_attempt', onReconnectAttempt);
      socket.on('reconnect', onReconnect);
      socket.on('reconnect_failed', onReconnectFailed);
      socket.on('chat:token', onChatToken);
      socket.on('chat:complete', onChatComplete);
      socket.on('emotion:update', onEmotionUpdate);
      socket.on('voice:transcript', onVoiceTranscript);
      socket.on('voice:status', onVoiceStatus);
    }

    // Ensure state is accurate when reusing an already-connected singleton socket.
    if (enableRealtimeHandlers && socket.connected) {
      setConnectionState('connected');
      setConnectionError('');
    } else if (enableRealtimeHandlers) {
      setConnectionState('reconnecting');
      setConnectionError(`Reconnecting to backend at ${backendUrl}...`);
      socket.connect();
    }

    return () => {
      clearStreamWatchdog();
      if (enableRealtimeHandlers) {
        socket?.off('connect', onConnect);
        socket?.off('disconnect', onDisconnect);
        socket?.off('connect_error', onConnectError);
        socket?.off('reconnect_attempt', onReconnectAttempt);
        socket?.off('reconnect', onReconnect);
        socket?.off('reconnect_failed', onReconnectFailed);
        socket?.off('chat:token', onChatToken);
        socket?.off('chat:complete', onChatComplete);
        socket?.off('emotion:update', onEmotionUpdate);
        socket?.off('voice:transcript', onVoiceTranscript);
        socket?.off('voice:status', onVoiceStatus);
      }
    };
  }, [backendUrl, appendToken, clearStreamWatchdog, enableRealtimeHandlers, playAssistantTts, startStreamWatchdog, updateMessage, setStreaming, updateEmotion, setStatus, setTranscript]);

  const sendMessage = useCallback((
    message: string,
    sessionId: string,
    assistantMsgId: string,
    emotionContext?: object,
    personalityMode?: string,
    llmProvider?: 'ollama' | 'openrouter' | 'gemini' | 'online',
    ollamaModel?: string,
    onlineModel?: string,
  ) => {
    currentMsgId.current = assistantMsgId;
    setStreaming(true);
    startStreamWatchdog();

    if (!socket || !socket.connected) {
      updateMessage(assistantMsgId, {
        isStreaming: false,
        intent: 'chat.error',
        content: 'Socket is not connected. Please wait for reconnect and try again.',
      });
      currentMsgId.current = null;
      setStreaming(false);
      clearStreamWatchdog();
      return;
    }

    socket?.emit('chat:send', {
      message,
      sessionId,
      emotionContext,
      personalityMode,
      llmProvider,
      ollamaModel,
      onlineModel,
    });
  }, [clearStreamWatchdog, setStreaming, startStreamWatchdog, updateMessage]);

  const sendEmotionSignal = useCallback((
    wpm: number,
    errors: number,
    typingPauseMs?: number,
  ) => {
    const timeOfDay = new Date().toTimeString().slice(0, 5);
    socket?.emit('emotion:signal', {
      typing_wpm: wpm,
      errors,
      typing_pause_ms: typingPauseMs,
      time_of_day: timeOfDay,
    });
  }, []);

  const startVoiceSession = useCallback((sessionId: string) => {
    socket?.emit('voice:start', { sessionId });
  }, []);

  const stopVoiceSession = useCallback(() => {
    socket?.emit('voice:stop', {});
  }, []);

  const sendVoiceAudio = useCallback((audioBase64: string, format: 'pcm_s16le' | 'wav', sampleRate = 16000) => {
    if (!audioBase64) return;
    socket?.emit('voice:audio', {
      audioBase64,
      format,
      sampleRate,
      channels: 1,
    });
  }, []);

  const runWorkflowWithProgress = useCallback((
    workflowId: string,
    onProgress?: (event: AutomationProgressEvent) => void,
  ) => {
    return new Promise<AutomationCompletePayload>((resolve, reject) => {
      if (!socket) {
        reject(new Error('Socket is not connected'));
        return;
      }

      let activeRunId: string | null = null;

      const cleanup = () => {
        socket?.off('automation:started', handleStarted);
        socket?.off('automation:progress', handleProgress);
        socket?.off('automation:complete', handleComplete);
      };

      const handleStarted = (payload: AutomationStartedPayload) => {
        if (payload.workflowId !== workflowId || activeRunId) return;
        activeRunId = payload.runId;
      };

      const handleProgress = (event: AutomationProgressEvent) => {
        if (activeRunId && event.runId !== activeRunId) return;
        onProgress?.(event);
      };

      const handleComplete = (payload: AutomationCompletePayload) => {
        if (activeRunId && payload.runId !== activeRunId) return;
        if (!activeRunId && payload.workflowId !== workflowId) return;

        cleanup();
        if (payload.error) {
          reject(new Error(payload.message || 'Workflow execution failed'));
          return;
        }
        resolve(payload);
      };

      socket.on('automation:started', handleStarted);
      socket.on('automation:progress', handleProgress);
      socket.on('automation:complete', handleComplete);
      socket.emit('automation:run', { workflowId });
    });
  }, []);

  return {
    sendMessage,
    sendEmotionSignal,
    startVoiceSession,
    stopVoiceSession,
    sendVoiceAudio,
    runWorkflowWithProgress,
    isConnected: connectionState === 'connected',
    connectionState,
    connectionError,
  };
}
