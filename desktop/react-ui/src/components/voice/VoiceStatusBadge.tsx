import React from 'react';
import { Mic, MicOff, Volume2, Loader2 } from 'lucide-react';
import { VoiceStatus } from '../../store/voiceStore';
import { clsx } from 'clsx';

const STATUS_CONFIG: Record<VoiceStatus, { icon: React.ElementType; label: string; color: string }> = {
  idle: { icon: MicOff, label: 'Voice Off', color: 'text-elixi-muted' },
  listening: { icon: Mic, label: 'Listening...', color: 'text-elixi-primary' },
  processing: { icon: Loader2, label: 'Processing...', color: 'text-yellow-400' },
  speaking: { icon: Volume2, label: 'Speaking', color: 'text-elixi-accent' },
  'wake-word': { icon: Mic, label: 'Wake Word', color: 'text-green-400' },
};

interface VoiceStatusBadgeProps {
  status: VoiceStatus;
}

export const VoiceStatusBadge: React.FC<VoiceStatusBadgeProps> = ({ status }) => {
  const { icon: Icon, label, color } = STATUS_CONFIG[status];
  const isAnimating = status === 'processing';

  return (
    <div className={clsx('flex items-center gap-1.5 text-xs font-medium', color)}>
      <Icon size={12} className={clsx(isAnimating && 'animate-spin')} />
      {label}
    </div>
  );
};
