import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSettingsStore } from '../store/settingsStore';
import { useChatStore } from '../store/chatStore';
import { useEmotionStore } from '../store/emotionStore';
import { useVoiceStore } from '../store/voiceStore';

let socket: Socket | null = null;
let socketBaseUrl: string | null = null;

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

export function useSocket() {
  const { backendUrl } = useSettingsStore();
  const { appendToken, updateMessage, setStreaming } = useChatStore();
  const { updateEmotion } = useEmotionStore();
  const { setStatus, setTranscript } = useVoiceStore();
  const currentMsgId = useRef<string | null>(null);

  useEffect(() => {
    if (socket && socketBaseUrl === backendUrl) return;

    if (socket && socketBaseUrl !== backendUrl) {
      socket.disconnect();
      socket = null;
    }

    socket = io(backendUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketBaseUrl = backendUrl;

    const onConnect = () => {
      console.log('[ELIXI] Socket connected');
    };

    const onDisconnect = () => {
      console.log('[ELIXI] Socket disconnected');
    };

    const onChatToken = ({ token }: { token: string }) => {
      if (currentMsgId.current) {
        appendToken(currentMsgId.current, token);
      }
    };

    const onChatComplete = ({ actions, intent }: {
      messageId: string;
      actions?: unknown[];
      intent?: string;
    }) => {
      if (currentMsgId.current) {
        updateMessage(currentMsgId.current, {
          isStreaming: false,
          actions: actions as never,
          intent,
        });
        currentMsgId.current = null;
      }
      setStreaming(false);
    };

    const onEmotionUpdate = ({ state, confidence }: { state: string; confidence: number }) => {
      updateEmotion(state as never, confidence);
    };

    const onVoiceTranscript = ({ text, final }: { text: string; final: boolean }) => {
      setTranscript(text);
      if (final) {
        setStatus('processing');
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('chat:token', onChatToken);
    socket.on('chat:complete', onChatComplete);
    socket.on('emotion:update', onEmotionUpdate);
    socket.on('voice:transcript', onVoiceTranscript);

    return () => {
      socket?.off('connect', onConnect);
      socket?.off('disconnect', onDisconnect);
      socket?.off('chat:token', onChatToken);
      socket?.off('chat:complete', onChatComplete);
      socket?.off('emotion:update', onEmotionUpdate);
      socket?.off('voice:transcript', onVoiceTranscript);
    };
  }, [backendUrl, appendToken, updateMessage, setStreaming, updateEmotion, setStatus, setTranscript]);

  const sendMessage = useCallback((
    message: string,
    sessionId: string,
    assistantMsgId: string,
    emotionContext?: object,
    personalityMode?: string,
    ollamaModel?: string,
  ) => {
    currentMsgId.current = assistantMsgId;
    setStreaming(true);
    socket?.emit('chat:send', { message, sessionId, emotionContext, personalityMode, ollamaModel });
  }, [setStreaming]);

  const sendEmotionSignal = useCallback((wpm: number, errors: number) => {
    socket?.emit('emotion:signal', { typing_wpm: wpm, errors });
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
    runWorkflowWithProgress,
    isConnected: socket?.connected ?? false,
  };
}
