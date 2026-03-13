import React from 'react';
import { motion } from 'framer-motion';
import { useEmotionStore } from '../../store/emotionStore';
import { useSettingsStore } from '../../store/settingsStore';

const palette = {
  calm: '#38BDF8',
  professional: '#F59E0B',
  friendly: '#10B981',
  focus: '#F59E0B',
  silent: '#64748B',
  neutral: '#38BDF8',
};

const getOrbTone = (emotion: string, mode: string) => {
  if (mode === 'friendly') return palette.friendly;
  if (mode === 'professional' || mode === 'focus') return palette.professional;
  if (mode === 'silent') return palette.silent;
  if (emotion === 'stressed' || emotion === 'frustrated') return '#F59E0B';
  if (emotion === 'fatigued') return '#7DD3FC';
  if (emotion === 'motivated') return '#10B981';
  return palette.calm;
};

export const AmbientOrb: React.FC = () => {
  const { emotion } = useEmotionStore();
  const { personalityMode, reducedMotion } = useSettingsStore();

  const tone = getOrbTone(emotion.state, personalityMode);
  const speed = reducedMotion ? 0 : personalityMode === 'calm' ? 8 : emotion.state === 'focused' ? 5 : 6;

  return (
    <div className="pointer-events-none absolute inset-0 z-0 hidden md:flex items-center justify-center pr-[24rem]">
      <section className="glass-panel neon-outline relative h-[76vh] max-h-[640px] w-[68%] max-w-[920px] border border-cyan-200/20 p-6">
        <div className="mb-4 flex items-center justify-between text-xs tracking-[0.2em] text-slate-200/85 uppercase">
          <span>ELIXI AI</span>
          <span className="rounded-full border border-cyan-300/50 bg-cyan-400/10 px-4 py-1 text-[11px] text-cyan-200">
            Volume muted
          </span>
        </div>

        <motion.div
          className="relative mx-auto mt-6 h-[78%] max-h-[500px] aspect-square rounded-full"
          style={{
            background: `radial-gradient(circle at 32% 24%, #c4b5fd55 0%, ${tone}bb 28%, #170d45 66%, #0b122e 100%)`,
          }}
        animate={
          reducedMotion
            ? undefined
            : {
                scale: [1, 1.06, 1],
                filter: [
                  `drop-shadow(0 0 48px ${tone}66)`,
                  `drop-shadow(0 0 94px ${tone}aa)`,
                  `drop-shadow(0 0 48px ${tone}66)`,
                ],
              }
        }
        transition={{ duration: speed, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.div
          className="absolute inset-0 rounded-full opacity-80"
          style={{
            background: `radial-gradient(circle at 35% 30%, #6ee7ff88 0%, ${tone}66 42%, transparent 72%)`,
            filter: 'blur(2px)',
          }}
          animate={reducedMotion ? undefined : { rotate: [0, 360] }}
          transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute inset-6 rounded-full"
          style={{
            background: `radial-gradient(circle at 40% 35%, #ffffff88 0%, ${tone}aa 26%, ${tone}1a 68%)`,
            backdropFilter: 'blur(8px)',
          }}
          animate={reducedMotion ? undefined : { scale: [0.92, 1.05, 0.92] }}
          transition={{ duration: speed * 0.8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(from 120deg, transparent 0%, #67e8f955 20%, transparent 42%, #c084fc66 62%, transparent 82%)`,
          }}
          animate={reducedMotion ? undefined : { rotate: [0, -360] }}
          transition={{ duration: 26, repeat: Infinity, ease: 'linear' }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-5xl tracking-wide text-white/90">
          Orb
        </div>
      </motion.div>
      </section>
    </div>
  );
};
