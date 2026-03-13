import { create } from 'zustand';

export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'speaking' | 'wake-word';

interface VoiceState {
  status: VoiceStatus;
  transcript: string;
  isWakeWordActive: boolean;
  volume: number;
  setStatus: (status: VoiceStatus) => void;
  setTranscript: (text: string) => void;
  appendTranscript: (text: string) => void;
  setWakeWordActive: (active: boolean) => void;
  setVolume: (volume: number) => void;
  reset: () => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  status: 'idle',
  transcript: '',
  isWakeWordActive: false,
  volume: 0,
  setStatus: (status) => set({ status }),
  setTranscript: (text) => set({ transcript: text }),
  appendTranscript: (text) => set((s) => ({ transcript: s.transcript + text })),
  setWakeWordActive: (active) => set({ isWakeWordActive: active }),
  setVolume: (volume) => set({ volume }),
  reset: () => set({ status: 'idle', transcript: '', volume: 0 }),
}));
