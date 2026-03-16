import { create } from 'zustand';

export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'speaking' | 'wake-word';

interface VoiceDebugMetrics {
  sampleRate: number;
  frameBytes: number;
  cadenceMs: number;
}

interface VoiceState {
  status: VoiceStatus;
  transcript: string;
  isWakeWordActive: boolean;
  volume: number;
  debugVisible: boolean;
  debugMetrics: VoiceDebugMetrics;
  setStatus: (status: VoiceStatus) => void;
  setTranscript: (text: string) => void;
  appendTranscript: (text: string) => void;
  setWakeWordActive: (active: boolean) => void;
  setVolume: (volume: number) => void;
  setDebugVisible: (visible: boolean) => void;
  setDebugMetrics: (metrics: Partial<VoiceDebugMetrics>) => void;
  reset: () => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  status: 'idle',
  transcript: '',
  isWakeWordActive: false,
  volume: 0,
  debugVisible: false,
  debugMetrics: {
    sampleRate: 0,
    frameBytes: 0,
    cadenceMs: 0,
  },
  setStatus: (status) => set({ status }),
  setTranscript: (text) => set({ transcript: text }),
  appendTranscript: (text) => set((s) => ({ transcript: s.transcript + text })),
  setWakeWordActive: (active) => set({ isWakeWordActive: active }),
  setVolume: (volume) => set({ volume }),
  setDebugVisible: (visible) => set({ debugVisible: visible }),
  setDebugMetrics: (metrics) => set((state) => ({
    debugMetrics: {
      ...state.debugMetrics,
      ...metrics,
    },
  })),
  reset: () => set((state) => ({
    status: 'idle',
    transcript: '',
    volume: 0,
    debugMetrics: {
      ...state.debugMetrics,
      frameBytes: 0,
      cadenceMs: 0,
    },
  })),
}));
