import React from 'react';
import { motion } from 'framer-motion';
import { VoiceStatus } from '../../store/voiceStore';
import { clsx } from 'clsx';

interface VoiceWaveformProps {
  status: VoiceStatus;
  volume?: number;
}

const BAR_COUNT = 12;

export const VoiceWaveform: React.FC<VoiceWaveformProps> = ({ status, volume = 0 }) => {
  const isActive = status === 'listening' || status === 'speaking';

  return (
    <div className="flex items-center gap-0.5 h-8">
      {Array.from({ length: BAR_COUNT }).map((_, i) => {
        const baseHeight = 4;
        const maxHeight = 28;
        const centerDist = Math.abs(i - BAR_COUNT / 2) / (BAR_COUNT / 2);
        const targetHeight = isActive
          ? baseHeight + (maxHeight - baseHeight) * (1 - centerDist) * (0.4 + volume * 0.6)
          : baseHeight;

        return (
          <motion.div
            key={i}
            className={clsx(
              'w-[3px] rounded-full',
              status === 'listening' ? 'bg-elixi-primary' : 
              status === 'speaking' ? 'bg-elixi-accent' : 'bg-elixi-border'
            )}
            animate={{ height: targetHeight }}
            transition={{
              duration: 0.1,
              delay: i * 0.02,
              repeat: isActive ? Infinity : 0,
              repeatType: 'reverse',
            }}
          />
        );
      })}
    </div>
  );
};
