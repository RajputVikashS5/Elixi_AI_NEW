import React from 'react';
import { Bot } from 'lucide-react';

export const TypingIndicator: React.FC = () => {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-elixi-accent/20 flex items-center justify-center shrink-0 mt-1">
        <Bot size={14} className="text-elixi-accent" />
      </div>
      <div className="chat-bubble-assistant px-4 py-3">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-elixi-muted voice-bar"
              style={{
                '--duration': `${0.8 + i * 0.15}s`,
                '--max-height': '10px',
                animationDelay: `${i * 0.15}s`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
