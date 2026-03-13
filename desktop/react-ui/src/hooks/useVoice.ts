import { useCallback } from 'react';
import { useVoiceStore } from '../store/voiceStore';

export function useVoice() {
  const voice = useVoiceStore();

  const startListening = useCallback(() => {
    voice.setStatus('listening');
  }, [voice]);

  const stopListening = useCallback(() => {
    voice.reset();
  }, [voice]);

  return {
    ...voice,
    startListening,
    stopListening,
  };
}
