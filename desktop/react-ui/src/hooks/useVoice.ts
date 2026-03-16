import { useCallback, useEffect } from 'react';
import { useVoiceStore } from '../store/voiceStore';
import { useChatStore } from '../store/chatStore';
import { useSocket } from './useSocket';
import { voiceService } from '../services/voiceService';

export function useVoice() {
  const voice = useVoiceStore();
  const { sessionId } = useChatStore();
  const { startVoiceSession: emitVoiceStart, stopVoiceSession: emitVoiceStop } = useSocket();

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const status = await voiceService.getStatus();
        if (!mounted) return;
        voice.setStatus(status.status);
        voice.setWakeWordActive(status.wakeWordActive);
      } catch {
        // Keep local defaults if backend voice status is unavailable.
      }
    };

    init();
    return () => {
      mounted = false;
    };
  }, [voice]);

  const startListening = useCallback(() => {
    voice.setStatus('listening');
    void voiceService.startSession(sessionId).catch(() => {
      // Status remains best-effort from UI standpoint.
    });
    emitVoiceStart(sessionId);
  }, [voice, sessionId, emitVoiceStart]);

  const stopListening = useCallback(() => {
    voice.reset();
    void voiceService.stopSession().catch(() => {
      // Ignore stop failures in UI.
    });
    emitVoiceStop();
  }, [voice, emitVoiceStop]);

  return {
    ...voice,
    startListening,
    stopListening,
  };
}
