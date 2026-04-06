import React, { Suspense, lazy } from 'react';
import { Bot, Check, Copy, Sparkles, User } from 'lucide-react';
import { ChatMessage } from '../../store/chatStore';
import { clsx } from 'clsx';

const MarkdownRenderer = lazy(() =>
  import('./MarkdownRenderer').then((m) => ({ default: m.MarkdownRenderer }))
);

interface MessageBubbleProps {
  message: ChatMessage;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const [copied, setCopied] = React.useState(false);
  const isUser = message.role === 'user';
  const isAssistant = !isUser;
  const tone = typeof message.voiceTone === 'string' ? message.voiceTone.trim().toLowerCase() : '';
  const toneLabel = tone ? `${tone.charAt(0).toUpperCase()}${tone.slice(1)}` : '';
  const toneClass =
    tone === 'calm'
      ? 'border-sky-300/30 bg-sky-400/12 text-sky-100'
      : tone === 'supportive'
        ? 'border-emerald-300/30 bg-emerald-400/12 text-emerald-100'
        : tone === 'energetic'
          ? 'border-amber-300/30 bg-amber-400/12 text-amber-100'
          : 'border-slate-300/25 bg-slate-400/10 text-slate-100';

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className={clsx(
        'flex gap-3 group chat-message-enter',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div className={clsx(
        'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 border',
        isUser
          ? 'bg-elixi-primary/20 border-elixi-primary/30'
          : 'bg-elixi-accent/15 border-cyan-300/20 shadow-[0_0_20px_rgba(34,211,238,0.2)]'
      )}>
        {isUser
          ? <User size={14} className="text-elixi-primary" />
          : <Bot size={14} className="text-elixi-accent" />
        }
      </div>

      {/* Bubble */}
      <div className={clsx('relative max-w-[min(82%,54rem)]', isUser ? 'items-end' : 'items-start')}>
        <div className={clsx('mb-1 flex items-center gap-2 px-1', isUser ? 'justify-end' : 'justify-start')}>
          <span className={clsx(
            'text-[11px] tracking-wide uppercase',
            isUser ? 'text-elixi-primary/90' : 'text-cyan-200/90'
          )}>
            {isUser ? 'You' : 'ELIXI'}
          </span>

          {isAssistant && (
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-100">
              <Sparkles size={10} />
              Response
            </span>
          )}

          {isAssistant && toneLabel && (
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${toneClass}`}>
              Tone: {toneLabel}
            </span>
          )}

          {isAssistant && !message.isStreaming && message.content.trim() && (
            <button
              type="button"
              onClick={() => copyToClipboard(message.content)}
              className="no-drag inline-flex items-center gap-1 rounded-md border border-elixi-border/70 bg-elixi-surface/60 px-2 py-0.5 text-[10px] text-elixi-muted opacity-0 transition-opacity hover:text-elixi-text group-hover:opacity-100"
              title="Copy response"
            >
              {copied ? <Check size={10} /> : <Copy size={10} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}

          <span className="text-[11px] text-elixi-muted/80">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div className={clsx(
          'relative overflow-hidden px-4 py-3.5 text-sm leading-7 selectable',
          isUser ? 'chat-bubble-user' : 'chat-bubble-assistant chat-bubble-assistant-elevated'
        )}>
          {isAssistant && message.isStreaming && (
            <div className="pointer-events-none absolute inset-0 chat-stream-shimmer bg-[linear-gradient(105deg,transparent_0%,rgba(255,255,255,0.04)_38%,transparent_66%)]" />
          )}

          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            message.content.trim() ? (
              <Suspense fallback={<p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>}>
                <MarkdownRenderer
                  content={message.content}
                  copied={copied}
                  onCopy={copyToClipboard}
                />
              </Suspense>
            ) : (
              <p className="whitespace-pre-wrap leading-relaxed text-elixi-muted">Preparing response...</p>
            )
          )}

          {/* Streaming cursor */}
          {message.isStreaming && (
            <span className="inline-block w-0.5 h-4 bg-elixi-accent ml-0.5 align-middle animate-pulse" />
          )}

        </div>
      </div>
    </div>
  );
};
