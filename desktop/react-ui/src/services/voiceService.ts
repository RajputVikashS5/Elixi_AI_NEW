import { api } from './api';

export interface VoiceStatusResponse {
  active: boolean;
  sessionId?: string;
  wakeWordActive: boolean;
  status: 'idle' | 'listening' | 'processing' | 'speaking' | 'wake-word';
  engineHealthy: boolean;
}

export interface VoiceSettingsResponse {
  rate: number;
  volume: number;
  voice_id: string | null;
}

export interface VoiceEntry {
  id: string;
  name: string;
  gender: string;
  culture: string;
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

  getSettings: async (): Promise<{ success: boolean; data: VoiceSettingsResponse }> => {
    const res = await api.get<{ success: boolean; data: VoiceSettingsResponse }>('/api/voice/settings');
    return res.data;
  },

  updateSettings: async (settings: Partial<{ rate: number; volume: number; voice_id: string | null }>) => {
    const res = await api.post<{ success: boolean; data: VoiceSettingsResponse }>('/api/voice/settings', settings);
    return res.data;
  },

  listVoices: async (): Promise<{ success: boolean; data: { voices: VoiceEntry[]; count: number } }> => {
    const res = await api.get<{ success: boolean; data: { voices: VoiceEntry[]; count: number } }>('/api/voice/voices');
    return res.data;
  },

  getCapabilities: async () => {
    const res = await api.get<{ success: boolean; data: unknown }>('/api/voice/capabilities');
    return res.data;
  },
};
