import React from 'react';
import { EmotionState } from '../../store/emotionStore';
import { clsx } from 'clsx';

const EMOTION_CONFIG: Record<EmotionState, { emoji: string; color: string; label: string }> = {
  focused: { emoji: '🟢', color: 'text-green-400', label: 'Focused' },
  stressed: { emoji: '🔴', color: 'text-red-400', label: 'Stressed' },
  fatigued: { emoji: '🟡', color: 'text-yellow-400', label: 'Fatigued' },
  frustrated: { emoji: '🟠', color: 'text-orange-400', label: 'Frustrated' },
  motivated: { emoji: '💜', color: 'text-purple-400', label: 'Motivated' },
  neutral: { emoji: '⚪', color: 'text-elixi-muted', label: 'Neutral' },
};

interface EmotionIndicatorProps {
  state: EmotionState;
  compact?: boolean;
}

export const EmotionIndicator: React.FC<EmotionIndicatorProps> = ({ state, compact = false }) => {
  const config = EMOTION_CONFIG[state] || EMOTION_CONFIG.neutral;

  if (compact) {
    return (
      <span className={clsx('text-xs font-medium', config.color)} title={config.label}>
        {config.emoji} {config.label}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-elixi-surface border border-elixi-border">
      <span>{config.emoji}</span>
      <span className={clsx('text-sm font-medium', config.color)}>{config.label}</span>
    </div>
  );
};
