import React, { useState, useRef, useCallback } from 'react';
import { Send, Mic, MicOff, Bug } from 'lucide-react';
import { useEmotion } from '../../hooks/useEmotion';
import { useVoice } from '../../hooks/useVoice';
import { useVoiceStore } from '../../store/voiceStore';
import { VoiceWaveform } from '../voice/VoiceWaveform';
import { clsx } from 'clsx';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  disabled = false,
  placeholder = 'Message ELIXI...',
}) => {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { recordKeystroke } = useEmotion();
  const { status, volume, startListening, stopListening } = useVoice();
  const { debugVisible, debugMetrics, setDebugVisible } = useVoiceStore();
  const keyCountRef = useRef(0);
  const errorCountRef = useRef(0);
  const isDev = import.meta.env.DEV;

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
      return;
    }

    // Track typing for emotion detection
    keyCountRef.current++;
    if (e.key === 'Backspace' && value.length > 0) {
      errorCountRef.current++;
    }
    recordKeystroke(e.key === 'Backspace');
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    // Auto-resize textarea
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  };

  const isVoiceActive = status === 'listening';

  return (
    <div className="border-t border-elixi-border bg-elixi-surface px-4 py-3">
      {/* Quick command suggestions */}
      <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
        {['Open VS Code', 'Check system info', 'What can you do?'].map((cmd) => (
          <button
            key={cmd}
            onClick={() => onSend(cmd)}
            disabled={disabled}
            className="shrink-0 text-xs px-3 py-1 rounded-full border border-elixi-border text-elixi-muted hover:text-elixi-text hover:border-elixi-primary/50 transition-colors no-drag disabled:opacity-40"
          >
            {cmd}
          </button>
        ))}
      </div>

      {/* Input row */}
      <div className={clsx(
        'flex items-end gap-2 bg-elixi-bg border rounded-xl px-3 py-2 transition-all duration-200',
        disabled ? 'border-elixi-border opacity-60' : 'border-elixi-border focus-within:border-elixi-primary/50'
      )}>
        <div className="hidden md:block pb-1">
          <VoiceWaveform status={status} volume={volume} />
        </div>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          className="flex-1 bg-transparent text-sm text-elixi-text placeholder:text-elixi-muted resize-none outline-none leading-relaxed selectable min-h-[20px] max-h-40"
          aria-label="Chat message input"
        />

        {/* Voice toggle */}
        <button
          onClick={() => (isVoiceActive ? stopListening() : startListening())}
          className={clsx(
            'p-1.5 rounded-lg transition-all duration-200 no-drag shrink-0',
            isVoiceActive
              ? 'text-red-400 bg-red-400/10'
              : 'text-elixi-muted hover:text-elixi-text hover:bg-elixi-surface'
          )}
          aria-label={isVoiceActive ? 'Stop voice' : 'Start voice'}
        >
          {isVoiceActive ? <MicOff size={16} /> : <Mic size={16} />}
        </button>

        {/* Send button */}
        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className={clsx(
            'p-1.5 rounded-lg transition-all duration-200 no-drag shrink-0 active:scale-95',
            value.trim() && !disabled
              ? 'bg-elixi-primary text-white hover:bg-indigo-400'
              : 'text-elixi-muted opacity-40 cursor-not-allowed'
          )}
          aria-label="Send message"
        >
          <Send size={16} />
        </button>
      </div>

      {isDev ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <button
            onClick={() => setDebugVisible(!debugVisible)}
            className={clsx(
              'no-drag inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] transition-colors',
              debugVisible
                ? 'border-amber-400/50 text-amber-300 bg-amber-400/10'
                : 'border-elixi-border text-elixi-muted hover:text-elixi-text'
            )}
            aria-label={debugVisible ? 'Hide voice debug' : 'Show voice debug'}
            type="button"
          >
            <Bug size={12} />
            Voice Debug
          </button>

          {debugVisible ? (
            <div className="text-[11px] text-elixi-muted/70">
              Live capture diagnostics
            </div>
          ) : null}
        </div>
      ) : null}

      {isDev && debugVisible ? (
        <div className="mt-2 grid grid-cols-3 gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-[11px] text-elixi-text">
          <div>
            <div className="text-elixi-muted/70">Sample Rate</div>
            <div>{debugMetrics.sampleRate || 0} Hz</div>
          </div>
          <div>
            <div className="text-elixi-muted/70">Frame Size</div>
            <div>{debugMetrics.frameBytes || 0} bytes</div>
          </div>
          <div>
            <div className="text-elixi-muted/70">Send Cadence</div>
            <div>
              {debugMetrics.cadenceMs || 0} ms
              {debugMetrics.cadenceMs > 0 ? ` (${(1000 / debugMetrics.cadenceMs).toFixed(1)} fps)` : ''}
            </div>
          </div>
        </div>
      ) : null}

      <p className="mt-1.5 text-center text-xs text-elixi-muted/60">
        Press Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
};
