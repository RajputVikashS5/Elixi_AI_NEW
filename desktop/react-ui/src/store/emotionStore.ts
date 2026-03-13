import { create } from 'zustand';

export type EmotionState = 'focused' | 'stressed' | 'fatigued' | 'frustrated' | 'motivated' | 'neutral';

interface EmotionData {
  state: EmotionState;
  confidence: number;
  signals: {
    typing?: { wpm: number; errorRate: number };
    timeOfDay?: string;
  };
  updatedAt: Date;
}

interface EmotionStoreState {
  emotion: EmotionData;
  history: EmotionData[];
  updateEmotion: (state: EmotionState, confidence: number, signals?: EmotionData['signals']) => void;
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
