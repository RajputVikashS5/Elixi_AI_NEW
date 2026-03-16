import React, { useCallback, useEffect, useState } from 'react';
import { Mic, MicOff, Volume2, Wand2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { useVoiceStore } from '../store/voiceStore';
import { useSettingsStore } from '../store/settingsStore';
import { useVoice } from '../hooks/useVoice';
import { VoiceWaveform } from '../components/voice/VoiceWaveform';
import { VoiceStatusBadge } from '../components/voice/VoiceStatusBadge';
import { voiceService } from '../services/voiceService';

// ─── capability badge ────────────────────────────────────────────────────────

interface CapBadgeProps {
  label: string;
  detail?: string;
  active: boolean;
}

const CapBadge: React.FC<CapBadgeProps> = ({ label, detail, active }) => (
  <div
    className={clsx(
      'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
      active
        ? 'border-elixi-primary/30 bg-elixi-primary/10 text-elixi-primary'
        : 'border-elixi-border bg-elixi-surface text-elixi-muted',
    )}
  >
    <span className={clsx('h-1.5 w-1.5 rounded-full', active ? 'bg-elixi-primary' : 'bg-elixi-border')} />
    <span className="font-medium">{label}</span>
    {detail && <span className="opacity-60">{detail}</span>}
  </div>
);

// ─── transcript bubble ────────────────────────────────────────────────────────

interface TranscriptBubbleProps {
  text: string;
}

const TranscriptBubble: React.FC<TranscriptBubbleProps> = ({ text }) => (
  <AnimatePresence mode="wait">
    {text ? (
      <motion.div
        key={text}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25 }}
        className="mx-auto max-w-xl rounded-2xl border border-elixi-border bg-elixi-surface px-6 py-4 text-center text-sm text-elixi-text shadow-lg"
      >
        &ldquo;{text}&rdquo;
      </motion.div>
    ) : (
      <motion.p
        key="placeholder"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="text-center text-sm text-elixi-muted/60"
      >
        Say something — ELIXI is listening
      </motion.p>
    )}
  </AnimatePresence>
);

// ─── main page ────────────────────────────────────────────────────────────────

const VoicePage: React.FC = () => {
  const voice = useVoiceStore();
  const settings = useSettingsStore();
  const { startListening, stopListening } = useVoice();

  const [caps, setCaps] = useState<{
    whisper: boolean;
    whisperModel?: string;
    vosk: boolean;
    windowsFallback: boolean;
    pyttsx3: boolean;
    webrtcvad: boolean;
  } | null>(null);

  const [capsError, setCapsError] = useState(false);

  useEffect(() => {
    voiceService
      .getCapabilities()
      .then((res) => {
        if (res?.success && res.data) {
          const d = res.data as {
            stt: { whisper: boolean; whisperModel?: string; vosk: boolean; windowsFallback: boolean };
            tts: { pyttsx3: boolean };
            vad: { webrtcvad: boolean };
          };
          setCaps({
            whisper: d.stt?.whisper ?? false,
            whisperModel: d.stt?.whisperModel,
            vosk: d.stt?.vosk ?? false,
            windowsFallback: d.stt?.windowsFallback ?? true,
            pyttsx3: d.tts?.pyttsx3 ?? false,
            webrtcvad: d.vad?.webrtcvad ?? false,
          });
        }
      })
      .catch(() => setCapsError(true));
  }, []);

  const isListening = voice.status === 'listening' || voice.status === 'processing';
  const isWakeWordMode = voice.status === 'wake-word';

  const handleToggle = useCallback(async () => {
    if (isListening) {
      await stopListening();
    } else {
      await startListening();
    }
  }, [isListening, startListening, stopListening]);

  const handleWakeWord = useCallback(async () => {
    await voiceService.setWakeWord(!settings.wakeWordEnabled);
    settings.setWakeWordEnabled(!settings.wakeWordEnabled);
  }, [settings]);

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-8 py-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-elixi-text">Voice</h1>
        <p className="mt-0.5 text-sm text-elixi-muted">Hands-free interaction with ELIXI</p>
      </div>

      {/* Main interaction panel */}
      <div className="glass-panel flex flex-col items-center gap-6 rounded-2xl border border-elixi-border bg-elixi-surface/60 px-8 py-10">
        {/* Waveform */}
        <div className="flex h-16 items-center">
          <VoiceWaveform status={voice.status} volume={voice.volume} />
        </div>

        {/* Status badge */}
        <VoiceStatusBadge status={voice.status} />

        {/* Mic button */}
        <motion.button
          onClick={handleToggle}
          disabled={isWakeWordMode && !isListening}
          whileTap={{ scale: 0.93 }}
          className={clsx(
            'flex h-20 w-20 items-center justify-center rounded-full border-2 shadow-lg transition-all duration-300 no-drag focus:outline-none',
            isListening
              ? 'border-elixi-primary bg-elixi-primary/15 text-elixi-primary shadow-elixi-primary/20'
              : 'border-elixi-border bg-elixi-surface text-elixi-muted hover:border-elixi-primary/50 hover:text-elixi-primary',
          )}
          aria-label={isListening ? 'Stop listening' : 'Start listening'}
        >
          {isListening ? <Mic size={32} /> : <MicOff size={32} />}
        </motion.button>

        {/* Transcript */}
        <div className="w-full min-h-[3.5rem] flex items-center justify-center">
          <TranscriptBubble text={voice.transcript} />
        </div>

        {/* Controls row */}
        <div className="flex gap-3">
          <button
            onClick={handleWakeWord}
            className={clsx(
              'flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-medium transition-colors no-drag',
              settings.wakeWordEnabled
                ? 'border-green-500/40 bg-green-500/10 text-green-400'
                : 'border-elixi-border bg-elixi-surface text-elixi-muted hover:border-elixi-primary/30 hover:text-elixi-primary',
            )}
          >
            <Wand2 size={13} />
            {settings.wakeWordEnabled ? 'Wake Word On' : 'Enable Wake Word'}
          </button>

          {voice.status === 'speaking' && (
            <div className="flex items-center gap-2 rounded-lg border border-elixi-accent/30 bg-elixi-accent/10 px-4 py-2 text-xs font-medium text-elixi-accent">
              <Volume2 size={13} />
              Speaking…
            </div>
          )}
        </div>
      </div>

      {/* Voice engine capabilities */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-elixi-muted">Engine capabilities</h2>

        {capsError ? (
          <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-xs text-yellow-400">
            <AlertCircle size={14} />
            Voice engine offline — start it with <span className="ml-1 font-mono">npm run start:voice</span>
          </div>
        ) : caps === null ? (
          <p className="text-xs text-elixi-muted/60">Loading…</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <CapBadge
              label="Whisper STT"
              detail={caps.whisper && caps.whisperModel ? `(${caps.whisperModel})` : undefined}
              active={caps.whisper}
            />
            <CapBadge label="Vosk STT" active={caps.vosk} />
            <CapBadge label="Windows Speech" active={caps.windowsFallback} />
            <CapBadge label="WebRTC VAD" active={caps.webrtcvad} />
            <CapBadge label="pyttsx3 TTS" active={caps.pyttsx3} />
          </div>
        )}
      </div>

      {/* Current TTS settings summary */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-elixi-muted">TTS settings</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-elixi-border bg-elixi-surface px-4 py-3 text-center">
            <p className="text-lg font-semibold text-elixi-text">{settings.ttsSpeed}</p>
            <p className="text-xs text-elixi-muted">WPM</p>
          </div>
          <div className="rounded-xl border border-elixi-border bg-elixi-surface px-4 py-3 text-center">
            <p className="text-lg font-semibold text-elixi-text">{Math.round(settings.ttsVolume * 100)}%</p>
            <p className="text-xs text-elixi-muted">Volume</p>
          </div>
          <div className="rounded-xl border border-elixi-border bg-elixi-surface px-4 py-3 text-center">
            <p className="text-sm font-semibold text-elixi-text truncate">
              {settings.ttsVoiceId ? settings.ttsVoiceId.split('\\').pop() || 'Custom' : 'Default'}
            </p>
            <p className="text-xs text-elixi-muted">Voice</p>
          </div>
        </div>
        <p className="text-xs text-elixi-muted/60">
          Adjust speed, volume, and voice in <span className="text-elixi-primary">Settings → Voice</span>.
        </p>
      </div>

      {/* Wake word hint */}
      <div className="rounded-xl border border-elixi-border bg-elixi-surface/40 px-5 py-4 text-sm text-elixi-muted">
        <p className="font-medium text-elixi-text">Wake word phrases</p>
        <ul className="mt-2 space-y-1 text-xs">
          {['Hey ELIXI', 'OK ELIXI', 'ELIXI'].map((p) => (
            <li key={p} className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-elixi-primary/60" />
              <span className="font-mono">{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default VoicePage;
