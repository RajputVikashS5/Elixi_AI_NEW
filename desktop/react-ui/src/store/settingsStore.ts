import { create } from 'zustand';

export type PersonalityMode = 'professional' | 'friendly' | 'calm' | 'focus' | 'silent';
export type OllamaModel = 'llama3' | 'mistral' | 'llama3:8b' | 'mistral:7b';

interface SettingsState {
  personalityMode: PersonalityMode;
  ollamaModel: OllamaModel;
  ollamaUrl: string;
  backendUrl: string;
  voiceEnabled: boolean;
  wakeWordEnabled: boolean;
  ttsSpeed: number;   // words-per-minute, 50–400
  ttsVolume: number;  // 0.0–1.0
  ttsVoiceId: string; // SAPI voice ID / name; '' = system default
  fontSize: 'small' | 'medium' | 'large';
  reducedMotion: boolean;
  setPersonalityMode: (mode: PersonalityMode) => void;
  setOllamaModel: (model: OllamaModel) => void;
  setOllamaUrl: (url: string) => void;
  setBackendUrl: (url: string) => void;
  setVoiceEnabled: (enabled: boolean) => void;
  setWakeWordEnabled: (enabled: boolean) => void;
  setTtsSpeed: (speed: number) => void;
  setTtsVolume: (volume: number) => void;
  setTtsVoiceId: (id: string) => void;
  setFontSize: (size: 'small' | 'medium' | 'large') => void;
  setReducedMotion: (reduced: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  personalityMode: 'professional',
  ollamaModel: 'llama3',
  ollamaUrl: 'http://localhost:11434',
  backendUrl: 'http://localhost:3001',
  voiceEnabled: false,
  wakeWordEnabled: false,
  ttsSpeed: 175,
  ttsVolume: 1.0,
  ttsVoiceId: '',
  fontSize: 'medium',
  reducedMotion: false,
  setPersonalityMode: (mode) => set({ personalityMode: mode }),
  setOllamaModel: (model) => set({ ollamaModel: model }),
  setOllamaUrl: (url) => set({ ollamaUrl: url }),
  setBackendUrl: (url) => set({ backendUrl: url }),
  setVoiceEnabled: (enabled) => set({ voiceEnabled: enabled }),
  setWakeWordEnabled: (enabled) => set({ wakeWordEnabled: enabled }),
  setTtsSpeed: (speed) => set({ ttsSpeed: Math.max(50, Math.min(400, speed)) }),
  setTtsVolume: (volume) => set({ ttsVolume: Math.max(0, Math.min(1, volume)) }),
  setTtsVoiceId: (id) => set({ ttsVoiceId: id }),
  setFontSize: (size) => set({ fontSize: size }),
  setReducedMotion: (reduced) => set({ reducedMotion: reduced }),
}));
