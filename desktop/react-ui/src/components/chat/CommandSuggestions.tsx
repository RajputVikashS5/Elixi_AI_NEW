import React from 'react';
import { Zap } from 'lucide-react';

const SUGGESTIONS = [
  { label: 'Open VS Code', command: 'Open VS Code' },
  { label: 'System info', command: 'Show me system information' },
  { label: 'Help', command: 'What can you help me with?' },
  { label: 'Create a folder', command: 'Create a new folder named Projects' },
];

interface CommandSuggestionsProps {
  onSelect: (command: string) => void;
}

export const CommandSuggestions: React.FC<CommandSuggestionsProps> = ({ onSelect }) => {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {SUGGESTIONS.map(({ label, command }) => (
        <button
          key={label}
          onClick={() => onSelect(command)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-elixi-border bg-elixi-surface hover:border-elixi-primary/50 hover:bg-elixi-primary/10 text-sm text-elixi-muted hover:text-elixi-text transition-all duration-200 no-drag"
        >
          <Zap size={12} className="text-elixi-primary" />
          {label}
        </button>
      ))}
    </div>
  );
};
