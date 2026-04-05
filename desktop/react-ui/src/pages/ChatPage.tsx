import React, { useEffect, useRef, useCallback } from 'react';
import { Trash2, RefreshCw, AlertTriangle, WifiOff, LoaderCircle } from 'lucide-react';
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
import { EmotionTimelinePanel } from '../components/emotion/EmotionTimelinePanel';
import { useVoiceStore } from '../store/voiceStore';
import { Button } from '../components/ui/Button';

const ChatPage: React.FC = () => {
  const { messages, sessionId, isLoading, isStreaming, addMessage, newSession } = useChatStore();
  const { personalityMode, llmProvider, ollamaModel, onlineModel } = useSettingsStore();
  const { emotion, history: emotionHistory } = useEmotionStore();
  const { status: voiceStatus, transcript } = useVoiceStore();
  const { sendMessage, isConnected, connectionState, connectionError } = useSocket();
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
      llmProvider,
      ollamaModel,
      onlineModel
    );
  }, [
    isLoading,
    isStreaming,
    addMessage,
    sendMessage,
    sessionId,
    emotion,
    personalityMode,
    llmProvider,
    ollamaModel,
    onlineModel,
  ]);

  const showWelcome = messages.length === 0;
  const backendUnavailable = !isConnected;
  const backendStatusTitle =
    connectionState === 'connecting'
      ? 'Connecting to backend'
      : connectionState === 'reconnecting'
        ? 'Reconnecting to backend'
        : connectionState === 'failed'
          ? 'Backend connection failed'
          : 'Backend disconnected';
  const backendStatusMessage =
    connectionError || 'ELIXI cannot reach the backend on http://127.0.0.1:3001. Restart the backend to send chat requests.';

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

      {backendUnavailable && (
        <div className="mx-4 mt-3 flex items-start gap-3 rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-400/15 text-rose-200">
            {connectionState === 'connecting' || connectionState === 'reconnecting' ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <WifiOff size={16} />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle size={14} className="text-rose-200" />
              {backendStatusTitle}
            </div>
            <p className="mt-1 text-xs text-rose-100/85">
              {backendStatusMessage}
            </p>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <WorkflowVisualizer />
        <EmotionTimelinePanel current={emotion} history={emotionHistory} />

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
        disabled={isLoading || isStreaming || backendUnavailable}
        placeholder={backendUnavailable ? `Backend ${connectionState}. Restart the backend to chat.` : `Message ELIXI (${personalityMode} mode)...`}
      />
    </div>
  );
};

export default ChatPage;
