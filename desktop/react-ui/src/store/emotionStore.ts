import { create } from 'zustand';

export type EmotionState = 'focused' | 'stressed' | 'fatigued' | 'frustrated' | 'motivated' | 'neutral';

export interface EmotionSignalItem {
  source: string;
  state: string;
  confidence: number;
  weight?: number;
  summary?: string;
}

interface EmotionSignalsSnapshot {
  typing?: { wpm: number; errorRate: number };
  timeOfDay?: string;
  sources?: string[];
  summaries?: string[];
  rawSignals?: EmotionSignalItem[];
}

export interface EmotionData {
  state: EmotionState;
  confidence: number;
  signals: EmotionSignalsSnapshot;
  updatedAt: Date;
}

interface EmotionStoreState {
  emotion: EmotionData;
  history: EmotionData[];
  updateEmotion: (state: EmotionState, confidence: number, signals?: EmotionSignalsSnapshot) => void;
  recordTypingSignal: (wpm: number, errors: number) => void;
}

export const useEmotionStore = create<EmotionStoreState>((set, get) => ({
  emotion: {
    state: 'neutral',
    confidence: 1.0,
    signals: {},
    updatedAt: new Date(),
  },
  history: [],

  updateEmotion: (state, confidence, signals = {}) => {
    const newEmotion: EmotionData = {
      state,
      confidence,
      signals,
      updatedAt: new Date(),
    };
    set((s) => ({
      emotion: newEmotion,
      history: [...s.history.slice(-49), newEmotion],
    }));
  },

  recordTypingSignal: (wpm, errors) => {
    const current = get().emotion;
    set({
      emotion: {
        ...current,
        signals: {
          ...current.signals,
          typing: { wpm, errorRate: errors },
        },
      },
    });
  },
}));
