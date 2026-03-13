import React, { Suspense, lazy } from 'react';
import { Bot, User } from 'lucide-react';
import { ChatMessage } from '../../store/chatStore';
import { ActionCard } from './ActionCard';
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

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={clsx('flex gap-3 group', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* Avatar */}
      <div className={clsx(
        'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1',
        isUser ? 'bg-elixi-primary/20' : 'bg-elixi-accent/20'
      )}>
        {isUser
          ? <User size={14} className="text-elixi-primary" />
          : <Bot size={14} className="text-elixi-accent" />
        }
      </div>

      {/* Bubble */}
      <div className={clsx('relative max-w-[75%]', isUser ? 'items-end' : 'items-start')}>
        <div className={clsx(
          'px-4 py-3 text-sm leading-relaxed selectable',
          isUser ? 'chat-bubble-user' : 'chat-bubble-assistant'
        )}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <Suspense fallback={<p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>}>
              <MarkdownRenderer
                content={message.content}
                copied={copied}
                onCopy={copyToClipboard}
              />
            </Suspense>
          )}

          {/* Streaming cursor */}
          {message.isStreaming && (
            <span className="inline-block w-0.5 h-4 bg-elixi-accent ml-0.5 animate-pulse" />
          )}

          {message.actions?.length ? (
            <div className="mt-2 space-y-2">
              {message.actions.map((action, index) => (
                <ActionCard key={`${message.id}-action-${index}`} action={action} />
              ))}
            </div>
          ) : null}
        </div>

        {/* Timestamp */}
        <div className={clsx(
          'mt-1 px-2 text-xs text-elixi-muted opacity-0 group-hover:opacity-100 transition-opacity',
          isUser ? 'text-right' : 'text-left'
        )}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};
