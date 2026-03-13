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
  fontSize: 'small' | 'medium' | 'large';
  reducedMotion: boolean;
  setPersonalityMode: (mode: PersonalityMode) => void;
  setOllamaModel: (model: OllamaModel) => void;
  setOllamaUrl: (url: string) => void;
  setBackendUrl: (url: string) => void;
  setVoiceEnabled: (enabled: boolean) => void;
  setWakeWordEnabled: (enabled: boolean) => void;
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
  fontSize: 'medium',
  reducedMotion: false,
  setPersonalityMode: (mode) => set({ personalityMode: mode }),
  setOllamaModel: (model) => set({ ollamaModel: model }),
  setOllamaUrl: (url) => set({ ollamaUrl: url }),
  setBackendUrl: (url) => set({ backendUrl: url }),
  setVoiceEnabled: (enabled) => set({ voiceEnabled: enabled }),
  setWakeWordEnabled: (enabled) => set({ wakeWordEnabled: enabled }),
  setFontSize: (size) => set({ fontSize: size }),
  setReducedMotion: (reduced) => set({ reducedMotion: reduced }),
}));
