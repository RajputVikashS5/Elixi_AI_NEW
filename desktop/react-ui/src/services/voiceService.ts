import { api } from './api';

export interface VoiceStatusResponse {
  active: boolean;
  sessionId?: string;
  wakeWordActive: boolean;
  status: 'idle' | 'listening' | 'processing' | 'speaking' | 'wake-word';
  engineHealthy: boolean;
}

export const voiceService = {
  getStatus: async (): Promise<VoiceStatusResponse> => {
    const res = await api.get<VoiceStatusResponse>('/api/voice/status');
    return res.data;
  },

  startSession: async (sessionId: string) => {
    const res = await api.post<{ success: boolean; session: VoiceStatusResponse }>('/api/voice/start', { sessionId });
    return res.data;
  },

  stopSession: async () => {
    const res = await api.post<{ success: boolean; session: VoiceStatusResponse }>('/api/voice/stop');
    return res.data;
  },

  setWakeWord: async (active: boolean) => {
    const res = await api.post<{ success: boolean; session: VoiceStatusResponse }>('/api/voice/wake-word', { active });
    return res.data;
  },

  tts: async (text: string) => {
    const res = await api.post<{ success: boolean; data: unknown }>('/api/voice/tts', { text });
    return res.data;
  },
};
