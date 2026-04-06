import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: string;
  voiceTone?: 'calm' | 'energetic' | 'supportive' | 'neutral' | string;
  actions?: ActionResult[];
  isStreaming?: boolean;
}

export interface ActionResult {
  type: string;
  target?: string;
  status: 'pending' | 'executed' | 'failed';
  error?: string;
}

interface ChatState {
  messages: ChatMessage[];
  sessionId: string;
  isLoading: boolean;
  isStreaming: boolean;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => string;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  appendToken: (id: string, token: string) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  newSession: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  sessionId: uuidv4(),
  isLoading: false,
  isStreaming: false,

  addMessage: (message) => {
    const id = uuidv4();
    set((state) => ({
      messages: [
        ...state.messages,
        { ...message, id, timestamp: new Date() },
      ],
    }));
    return id;
  },

  updateMessage: (id, updates) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    }));
  },

  appendToken: (id, token) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + token } : m
      ),
    }));
  },

  clearMessages: () => set({ messages: [] }),
  setLoading: (loading) => set({ isLoading: loading }),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  newSession: () => set({ messages: [], sessionId: uuidv4() }),
}));
