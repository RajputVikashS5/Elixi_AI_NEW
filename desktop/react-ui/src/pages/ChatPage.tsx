import React, { useEffect, useRef, useCallback } from 'react';
import { Trash2, RefreshCw } from 'lucide-react';
import { useChatStore } from '../store/chatStore';
import { useSettingsStore } from '../store/settingsStore';
import { useEmotionStore } from '../store/emotionStore';
import { useSocket } from '../hooks/useSocket';
import { MessageBubble } from '../components/chat/MessageBubble';
import { TypingIndicator } from '../components/chat/TypingIndicator';
import { ChatInput } from '../components/chat/ChatInput';
import { CommandSuggestions } from '../components/chat/CommandSuggestions';
import { VoiceStatusBadge } from '../components/voice/VoiceStatusBadge';
import { WorkflowVisualizer } from '../components/automation/WorkflowVisualizer';
import { useVoiceStore } from '../store/voiceStore';
import { Button } from '../components/ui/Button';

const ChatPage: React.FC = () => {
  const { messages, sessionId, isLoading, isStreaming, addMessage, newSession } = useChatStore();
  const { personalityMode, ollamaModel } = useSettingsStore();
  const { emotion } = useEmotionStore();
  const { status: voiceStatus, transcript } = useVoiceStore();
  const { sendMessage } = useSocket();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleSend = useCallback((text: string) => {
    if (!text.trim() || isLoading || isStreaming) return;

    // Add user message
    addMessage({ role: 'user', content: text });

    // Add empty assistant message placeholder
    const assistantId = addMessage({ role: 'assistant', content: '', isStreaming: true });

    // Send via socket
    sendMessage(
      text,
      sessionId,
      assistantId,
      { state: emotion.state, confidence: emotion.confidence },
      personalityMode,
      ollamaModel
    );
  }, [isLoading, isStreaming, addMessage, sendMessage, sessionId, emotion, personalityMode, ollamaModel]);

  const showWelcome = messages.length === 0;

  return (
    <div className="flex flex-col h-full bg-elixi-bg">
      {/* Chat header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-elixi-border bg-elixi-surface shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-medium text-elixi-text">Chat</span>
          <VoiceStatusBadge status={voiceStatus} />
          {transcript ? (
            <span className="text-xs text-elixi-muted truncate max-w-[320px]" title={transcript}>
              "{transcript}"
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1 no-drag">
          <Button variant="ghost" size="sm" onClick={newSession} title="New session">
            <RefreshCw size={13} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => useChatStore.getState().clearMessages()}
            title="Clear chat"
          >
            <Trash2 size={13} />
          </Button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <WorkflowVisualizer />

        {showWelcome ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div>
              <h2 className="text-2xl font-bold text-elixi-text mb-2">
                Hello, I'm <span className="text-elixi-primary">ELIXI</span>
              </h2>
              <p className="text-elixi-muted text-sm max-w-sm">
                Your local AI assistant. I can chat, automate tasks, and help you stay productive — all privately, on your device.
              </p>
            </div>
            <CommandSuggestions onSelect={handleSend} />
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isLoading && !isStreaming && <TypingIndicator />}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <ChatInput
        onSend={handleSend}
        disabled={isLoading || isStreaming}
        placeholder={`Message ELIXI (${personalityMode} mode)...`}
      />
    </div>
  );
};

export default ChatPage;
