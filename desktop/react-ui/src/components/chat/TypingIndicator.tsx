import React from 'react';
import { Bot } from 'lucide-react';

export const TypingIndicator: React.FC = () => {
  return (
    <div className="flex gap-3 chat-message-enter">
      <div className="w-8 h-8 rounded-full border border-cyan-300/20 bg-elixi-accent/15 flex items-center justify-center shrink-0 mt-1 shadow-[0_0_20px_rgba(34,211,238,0.2)]">
        <Bot size={14} className="text-elixi-accent" />
      </div>
      <div className="chat-bubble-assistant chat-bubble-assistant-elevated px-4 py-3">
        <div className="mb-1 text-[11px] uppercase tracking-wide text-cyan-200/85">ELIXI</div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-elixi-muted">Thinking</span>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-cyan-200 voice-bar"
              style={{
                '--duration': `${0.8 + i * 0.15}s`,
                '--max-height': '8px',
                animationDelay: `${i * 0.15}s`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
