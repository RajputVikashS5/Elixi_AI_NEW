import React, { useMemo } from 'react';
import { clsx } from 'clsx';
import { VoiceStatus } from '../../store/voiceStore';

interface VoiceReactiveOrbProps {
  volume: number;
  status: VoiceStatus;
  reducedMotion?: boolean;
}

const PARTICLE_COUNT = 20;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export const VoiceReactiveOrb: React.FC<VoiceReactiveOrbProps> = ({
  volume,
  status,
  reducedMotion = false,
}) => {
  const normalizedVolume = clamp(volume, 0, 1);
  const active = status === 'listening' || status === 'processing' || status === 'speaking' || status === 'wake-word';

  const intensity = active ? 0.32 + normalizedVolume * 0.86 : 0.16;
  const pulseScale = active ? 1 + normalizedVolume * 0.18 : 1;
  const rippleSpeed = reducedMotion ? 0 : Math.max(0.9, 2.6 - normalizedVolume * 1.5);

  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, index) => {
        const theta = (Math.PI * 2 * index) / PARTICLE_COUNT;
        const jitter = (index % 3) * 0.12;
        const orbit = 124 + (index % 5) * 15;
        const size = 2 + (index % 4);
        return {
          id: index,
          angleDeg: ((theta + jitter) * 180) / Math.PI,
          orbit,
          size,
          delay: index * 0.17,
          duration: 5.2 + (index % 4) * 0.85,
        };
      }),
    [],
  );

  return (
    <div
      className={clsx('orb-space', reducedMotion && 'orb-space-reduced')}
      style={{
        ['--orb-intensity' as string]: intensity,
        ['--orb-pulse-scale' as string]: pulseScale,
        ['--orb-ripple-speed' as string]: rippleSpeed,
      }}
      aria-hidden
    >
      <div className="orb-volumetric-haze" />

      <div className="orb-ripple-layer">
        {[0, 1, 2, 3].map((ripple) => (
          <span
            key={ripple}
            className={clsx('orb-ripple', active && 'orb-ripple-active')}
            style={{
              animationDelay: `${ripple * (rippleSpeed > 0 ? rippleSpeed / 4 : 0)}s`,
              opacity: 0.18 + normalizedVolume * 0.12,
            }}
          />
        ))}
      </div>

      <div className={clsx('orb-core-wrap', active && 'orb-core-wrap-active')}>
        <div className="orb-core-sheen" />
        <div className="orb-core" />
        <div className="orb-inner-glow" />
      </div>

      <div className="orb-particle-field">
        {particles.map((particle) => (
          <span
            key={particle.id}
            className={clsx('orb-particle', active && 'orb-particle-active')}
            style={{
              ['--particle-angle' as string]: `${particle.angleDeg}deg`,
              ['--particle-orbit' as string]: `${particle.orbit}px`,
              ['--particle-size' as string]: `${particle.size}px`,
              ['--particle-delay' as string]: `${particle.delay}s`,
              ['--particle-duration' as string]: `${particle.duration}s`,
              ['--particle-energy' as string]: active ? 1 + normalizedVolume * 1.6 : 0.55,
            }}
          />
        ))}
      </div>

      <div className="orb-bloom" />
    </div>
  );
};
