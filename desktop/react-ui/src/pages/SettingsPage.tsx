import React, { useCallback, useEffect, useState } from 'react';
import { useSettingsStore, PersonalityMode, LlmProvider, OllamaModel } from '../store/settingsStore';
import { voiceService, VoiceEntry } from '../services/voiceService';
import { api } from '../services/api';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-3">
    <h2 className="text-sm font-semibold text-elixi-muted uppercase tracking-wider">{title}</h2>
    <div className="bg-elixi-surface border border-elixi-border rounded-card p-4 space-y-4">
      {children}
    </div>
  </div>
);

const SettingRow: React.FC<{ label: string; description?: string; children: React.ReactNode }> = ({
  label,
  description,
  children,
}) => (
  <div className="flex items-center justify-between gap-4">
    <div>
      <p className="text-sm font-medium text-elixi-text">{label}</p>
      {description && <p className="text-xs text-elixi-muted mt-0.5">{description}</p>}
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

const Select: React.FC<{ value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }> = ({
  value, onChange, options,
}) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="bg-elixi-bg border border-elixi-border rounded-lg px-3 py-1.5 text-sm text-elixi-text outline-none focus:border-elixi-primary/50 no-drag"
  >
    {options.map((opt) => (
      <option key={opt.value} value={opt.value}>{opt.label}</option>
    ))}
  </select>
);

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`relative w-11 h-6 rounded-full transition-colors duration-200 no-drag ${checked ? 'bg-elixi-primary' : 'bg-elixi-border'}`}
    role="switch"
    aria-checked={checked}
  >
    <span
      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`}
    />
  </button>
);

const Slider: React.FC<{
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
  formatLabel?: (v: number) => string;
}> = ({ value, min, max, step, onChange, onCommit, formatLabel }) => (
  <div className="flex items-center gap-3">
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      onMouseUp={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
      onTouchEnd={(e) => onCommit?.(Number((e.target as HTMLInputElement).value))}
      className="w-32 accent-[var(--color-elixi-primary,#22d3ee)] no-drag"
    />
    <span className="w-12 text-right text-xs text-elixi-muted tabular-nums">
      {formatLabel ? formatLabel(value) : value}
    </span>
  </div>
);

type ProviderStatusResponse = {
  timestamp: string;
  openrouter: { configured: boolean; connected: boolean; model: string; detail: string };
  gemini: { configured: boolean; connected: boolean; model: string; detail: string };
};

type ActiveProviderResponse = {
  provider: string;
  model: string;
  requestedProvider: string;
  timestamp: string;
  source: string;
};

type EmotionCameraStatusResponse = {
  status: { enabled?: boolean; active?: boolean; ready?: boolean; permission?: string; message?: string } | string;
  emotion_signal?: { state?: string; confidence?: number; source?: string; summary?: string };
};

type EmotionCalibrationResponse = {
  source_weights: {
    typing: number;
    voice: number;
    time: number;
    webcam: number;
  };
  min_confidence: number;
};

const StatusDot: React.FC<{ ok: boolean }> = ({ ok }) => (
  <span
    className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.65)]' : 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.55)]'}`}
  />
);

const SettingsPage: React.FC = () => {
  const settings = useSettingsStore();
  const [voices, setVoices] = useState<VoiceEntry[]>([]);
  const [providerStatus, setProviderStatus] = useState<ProviderStatusResponse | null>(null);
  const [activeProvider, setActiveProvider] = useState<ActiveProviderResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [emotionCameraStatus, setEmotionCameraStatus] = useState<EmotionCameraStatusResponse | null>(null);
  const [emotionCameraLoading, setEmotionCameraLoading] = useState(false);
  const [emotionCalibration, setEmotionCalibration] = useState<EmotionCalibrationResponse | null>(null);
  const [emotionCalibrationLoading, setEmotionCalibrationLoading] = useState(false);

  // Load available SAPI voices from voice engine
  useEffect(() => {
    voiceService
      .listVoices()
      .then((res) => {
        if (res?.success && res.data?.voices) {
          setVoices(res.data.voices);
        }
      })
      .catch(() => {
        // Voice engine offline — keep empty list
      });
  }, []);

  // Push TTS settings to voice engine whenever they change
  const commitTtsSettings = useCallback(
    (patch: Partial<{ rate: number; volume: number; voice_id: string | null }>) => {
      voiceService.updateSettings(patch).catch(() => {
        // Tolerate engine being offline
      });
    },
    [],
  );

  const refreshProviderStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const [statusRes, activeRes] = await Promise.all([
        api.get<ProviderStatusResponse>('/ai/providers/status'),
        api.get<ActiveProviderResponse>('/ai/providers/active'),
      ]);
      setProviderStatus(statusRes.data);
      setActiveProvider(activeRes.data);
    } catch {
      setProviderStatus(null);
      setActiveProvider(null);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const refreshEmotionCameraStatus = useCallback(async () => {
    setEmotionCameraLoading(true);
    try {
      const response = await api.get<EmotionCameraStatusResponse>('/ai/camera/status');
      setEmotionCameraStatus(response.data);
    } catch {
      setEmotionCameraStatus(null);
    } finally {
      setEmotionCameraLoading(false);
    }
  }, []);

  const setEmotionCameraEnabled = useCallback(async (enabled: boolean) => {
    setEmotionCameraLoading(true);
    try {
      if (enabled) {
        await api.post('/ai/camera/enable');
      } else {
        await api.post('/ai/camera/disable');
      }
      await refreshEmotionCameraStatus();
    } catch {
      setEmotionCameraStatus(null);
    } finally {
      setEmotionCameraLoading(false);
    }
  }, [refreshEmotionCameraStatus]);

  const refreshEmotionCalibration = useCallback(async () => {
    setEmotionCalibrationLoading(true);
    try {
      const response = await api.get<EmotionCalibrationResponse>('/ai/emotion/config');
      setEmotionCalibration(response.data);
    } catch {
      setEmotionCalibration(null);
    } finally {
      setEmotionCalibrationLoading(false);
    }
  }, []);

  const commitEmotionCalibration = useCallback(async (patch: {
    source_weights?: Partial<EmotionCalibrationResponse['source_weights']>;
    min_confidence?: number;
  }) => {
    setEmotionCalibrationLoading(true);
    try {
      const source_weights = {
        typing: patch.source_weights?.typing ?? emotionCalibration?.source_weights.typing ?? 1,
        voice: patch.source_weights?.voice ?? emotionCalibration?.source_weights.voice ?? 1,
        time: patch.source_weights?.time ?? emotionCalibration?.source_weights.time ?? 0.7,
        webcam: patch.source_weights?.webcam ?? emotionCalibration?.source_weights.webcam ?? 0.8,
      };
      const min_confidence = patch.min_confidence ?? emotionCalibration?.min_confidence ?? 0;
      await api.post('/ai/emotion/config', { source_weights, min_confidence });
      await refreshEmotionCalibration();
    } catch {
      // Keep last known values on failure.
    } finally {
      setEmotionCalibrationLoading(false);
    }
  }, [emotionCalibration, refreshEmotionCalibration]);

  useEffect(() => {
    void refreshProviderStatus();
  }, [refreshProviderStatus]);

  useEffect(() => {
    void refreshEmotionCameraStatus();
  }, [refreshEmotionCameraStatus]);

  useEffect(() => {
    void refreshEmotionCalibration();
  }, [refreshEmotionCalibration]);

  const personalityOptions: { value: PersonalityMode; label: string }[] = [
    { value: 'professional', label: 'Professional' },
    { value: 'friendly', label: 'Friendly' },
    { value: 'calm', label: 'Calm' },
    { value: 'focus', label: 'Focus' },
    { value: 'silent', label: 'Silent' },
  ];

  const modelOptions: { value: OllamaModel; label: string }[] = [
    { value: 'llama3', label: 'Llama 3 (default)' },
    { value: 'llama3:8b', label: 'Llama 3 8B' },
    { value: 'mistral', label: 'Mistral 7B' },
    { value: 'mistral:7b', label: 'Mistral 7B (explicit)' },
  ];

  const providerOptions: { value: LlmProvider; label: string }[] = [
    { value: 'ollama', label: 'Local Ollama (offline)' },
    { value: 'openrouter', label: 'OpenRouter (cloud)' },
    { value: 'gemini', label: 'Google Gemini (cloud)' },
    { value: 'online', label: 'Online API (legacy alias)' },
  ];

  const voiceOptions = [
    { value: '', label: 'System default' },
    ...voices.map((v) => ({ value: v.id, label: v.name })),
  ];

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-elixi-text">Settings</h1>
        <p className="text-sm text-elixi-muted mt-0.5">Configure ELIXI to your preferences</p>
      </div>

      <Section title="Personality">
        <SettingRow label="Mode" description="Affects ELIXI's tone and response style">
          <Select
            value={settings.personalityMode}
            onChange={(v) => settings.setPersonalityMode(v as PersonalityMode)}
            options={personalityOptions}
          />
        </SettingRow>
      </Section>

      <Section title="AI Model">
        <SettingRow label="LLM Provider" description="Choose local offline or online cloud model provider">
          <Select
            value={settings.llmProvider}
            onChange={(v) => settings.setLlmProvider(v as LlmProvider)}
            options={providerOptions}
          />
        </SettingRow>

        <SettingRow label="Ollama Model" description="Local LLM model to use for inference">
          <Select
            value={settings.ollamaModel}
            onChange={(v) => settings.setOllamaModel(v as OllamaModel)}
            options={modelOptions}
          />
        </SettingRow>

        <SettingRow label="Online Model" description="Model name used when provider is set to Online API">
          <input
            type="text"
            value={settings.onlineModel}
            onChange={(e) => settings.setOnlineModel(e.target.value)}
            className="bg-elixi-bg border border-elixi-border rounded-lg px-3 py-1.5 text-sm text-elixi-text outline-none focus:border-elixi-primary/50 selectable w-52"
            placeholder="gpt-4o-mini"
          />
        </SettingRow>

        <SettingRow label="Ollama URL" description="URL of your local Ollama server">
          <input
            type="text"
            value={settings.ollamaUrl}
            onChange={(e) => settings.setOllamaUrl(e.target.value)}
            className="bg-elixi-bg border border-elixi-border rounded-lg px-3 py-1.5 text-sm text-elixi-text outline-none focus:border-elixi-primary/50 selectable w-52"
          />
        </SettingRow>
        <SettingRow label="Backend URL" description="URL of the ELIXI Node.js backend">
          <input
            type="text"
            value={settings.backendUrl}
            onChange={(e) => settings.setBackendUrl(e.target.value)}
            className="bg-elixi-bg border border-elixi-border rounded-lg px-3 py-1.5 text-sm text-elixi-text outline-none focus:border-elixi-primary/50 selectable w-52"
          />
        </SettingRow>

        <div className="border-t border-elixi-border pt-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-elixi-text">Provider Status</p>
            <button
              type="button"
              onClick={() => void refreshProviderStatus()}
              disabled={statusLoading}
              className="text-xs px-2 py-1 rounded border border-elixi-border text-elixi-muted hover:text-elixi-text hover:border-elixi-primary/50 disabled:opacity-60"
            >
              {statusLoading ? 'Checking...' : 'Refresh'}
            </button>
          </div>

          {providerStatus ? (
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between rounded-md border border-elixi-border bg-elixi-bg/60 px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <StatusDot ok={providerStatus.openrouter.connected} />
                  <span className="text-elixi-text">OpenRouter</span>
                </div>
                <span className="text-elixi-muted">{providerStatus.openrouter.model}</span>
              </div>
              <p className="text-[11px] text-elixi-muted -mt-1">{providerStatus.openrouter.detail}</p>

              <div className="flex items-center justify-between rounded-md border border-elixi-border bg-elixi-bg/60 px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <StatusDot ok={providerStatus.gemini.connected} />
                  <span className="text-elixi-text">Gemini</span>
                </div>
                <span className="text-elixi-muted">{providerStatus.gemini.model}</span>
              </div>
              <p className="text-[11px] text-elixi-muted -mt-1">{providerStatus.gemini.detail}</p>

              {activeProvider ? (
                <div className="rounded-md border border-elixi-border bg-elixi-bg/60 px-2 py-2 space-y-1">
                  <p className="text-elixi-text">Active: {activeProvider.provider}</p>
                  <p className="text-elixi-muted">Model: {activeProvider.model}</p>
                  <p className="text-elixi-muted">Requested: {activeProvider.requestedProvider}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-rose-300">Provider status unavailable. Verify backend URL and restart backend.</p>
          )}
        </div>
      </Section>

      <Section title="Emotion">
        <SettingRow
          label="Camera Emotion"
          description="Optional webcam-based emotion detection. Disabled by default for privacy."
        >
          <Toggle
            checked={Boolean(
              typeof emotionCameraStatus?.status === 'object'
                ? (emotionCameraStatus.status.enabled ?? emotionCameraStatus.status.active)
                : false
            )}
            onChange={(checked) => void setEmotionCameraEnabled(checked)}
          />
        </SettingRow>

        <div className="rounded-lg border border-elixi-border bg-elixi-bg/60 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-elixi-text">Live Emotion Status</p>
            <button
              type="button"
              onClick={() => void refreshEmotionCameraStatus()}
              disabled={emotionCameraLoading}
              className="text-xs px-2 py-1 rounded border border-elixi-border text-elixi-muted hover:text-elixi-text hover:border-elixi-primary/50 disabled:opacity-60"
            >
              {emotionCameraLoading ? 'Updating...' : 'Refresh'}
            </button>
          </div>

          {emotionCameraStatus ? (
            <div className="space-y-1 text-xs text-elixi-muted">
              <p>
                Mode: {' '}
                <span className="text-elixi-text">
                  {typeof emotionCameraStatus.status === 'string'
                    ? emotionCameraStatus.status
                    : emotionCameraStatus.status.enabled || emotionCameraStatus.status.active
                      ? 'enabled'
                      : 'disabled'}
                </span>
              </p>
              {emotionCameraStatus.emotion_signal ? (
                <p>
                  Signal: {' '}
                  <span className="text-elixi-text">
                    {emotionCameraStatus.emotion_signal.state || 'unknown'}
                    {typeof emotionCameraStatus.emotion_signal.confidence === 'number'
                      ? ` (${Math.round(emotionCameraStatus.emotion_signal.confidence * 100)}%)`
                      : ''}
                  </span>
                </p>
              ) : null}
              {typeof emotionCameraStatus.status === 'object' && emotionCameraStatus.status.message ? (
                <p>{emotionCameraStatus.status.message}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-elixi-muted">Camera emotion status unavailable. Keep it disabled if you do not need webcam analysis.</p>
          )}
        </div>

        <div className="rounded-lg border border-elixi-border bg-elixi-bg/60 p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-elixi-text">Emotion Calibration</p>
            <button
              type="button"
              onClick={() => void refreshEmotionCalibration()}
              disabled={emotionCalibrationLoading}
              className="text-xs px-2 py-1 rounded border border-elixi-border text-elixi-muted hover:text-elixi-text hover:border-elixi-primary/50 disabled:opacity-60"
            >
              {emotionCalibrationLoading ? 'Updating...' : 'Refresh'}
            </button>
          </div>

          {emotionCalibration ? (
            <>
              <SettingRow label="Typing Weight" description="Influence of typing dynamics on emotion state">
                <Slider
                  value={emotionCalibration.source_weights.typing}
                  min={0}
                  max={3}
                  step={0.1}
                  onChange={(v) => setEmotionCalibration((prev) => prev ? ({ ...prev, source_weights: { ...prev.source_weights, typing: v } }) : prev)}
                  onCommit={(v) => void commitEmotionCalibration({ source_weights: { typing: v } })}
                  formatLabel={(v) => v.toFixed(1)}
                />
              </SettingRow>

              <SettingRow label="Voice Weight" description="Influence of voice tone signals">
                <Slider
                  value={emotionCalibration.source_weights.voice}
                  min={0}
                  max={3}
                  step={0.1}
                  onChange={(v) => setEmotionCalibration((prev) => prev ? ({ ...prev, source_weights: { ...prev.source_weights, voice: v } }) : prev)}
                  onCommit={(v) => void commitEmotionCalibration({ source_weights: { voice: v } })}
                  formatLabel={(v) => v.toFixed(1)}
                />
              </SettingRow>

              <SettingRow label="Time Weight" description="Influence of time-of-day behavior heuristics">
                <Slider
                  value={emotionCalibration.source_weights.time}
                  min={0}
                  max={3}
                  step={0.1}
                  onChange={(v) => setEmotionCalibration((prev) => prev ? ({ ...prev, source_weights: { ...prev.source_weights, time: v } }) : prev)}
                  onCommit={(v) => void commitEmotionCalibration({ source_weights: { time: v } })}
                  formatLabel={(v) => v.toFixed(1)}
                />
              </SettingRow>

              <SettingRow label="Webcam Weight" description="Influence of optional camera emotion signal">
                <Slider
                  value={emotionCalibration.source_weights.webcam}
                  min={0}
                  max={3}
                  step={0.1}
                  onChange={(v) => setEmotionCalibration((prev) => prev ? ({ ...prev, source_weights: { ...prev.source_weights, webcam: v } }) : prev)}
                  onCommit={(v) => void commitEmotionCalibration({ source_weights: { webcam: v } })}
                  formatLabel={(v) => v.toFixed(1)}
                />
              </SettingRow>

              <SettingRow label="Minimum Confidence" description="Ignore weak emotion signals below this threshold">
                <Slider
                  value={emotionCalibration.min_confidence}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(v) => setEmotionCalibration((prev) => prev ? ({ ...prev, min_confidence: v }) : prev)}
                  onCommit={(v) => void commitEmotionCalibration({ min_confidence: v })}
                  formatLabel={(v) => `${Math.round(v * 100)}%`}
                />
              </SettingRow>
            </>
          ) : (
            <p className="text-xs text-elixi-muted">Emotion calibration unavailable. Ensure AI engine is running and reachable.</p>
          )}
        </div>
      </Section>

      <Section title="Voice">
        <SettingRow label="Voice Mode" description="Enable text-to-speech responses">
          <Toggle checked={settings.voiceEnabled} onChange={settings.setVoiceEnabled} />
        </SettingRow>
        <SettingRow label="Wake Word" description="Listen for 'Hey ELIXI' continuously">
          <Toggle checked={settings.wakeWordEnabled} onChange={settings.setWakeWordEnabled} />
        </SettingRow>
        <SettingRow label="TTS Speed" description="Speaking rate in words per minute">
          <Slider
            value={settings.ttsSpeed}
            min={50}
            max={400}
            step={25}
            onChange={settings.setTtsSpeed}
            onCommit={(v) => commitTtsSettings({ rate: v })}
            formatLabel={(v) => `${v} wpm`}
          />
        </SettingRow>
        <SettingRow label="TTS Volume" description="Output volume for spoken responses">
          <Slider
            value={settings.ttsVolume}
            min={0}
            max={1}
            step={0.05}
            onChange={settings.setTtsVolume}
            onCommit={(v) => commitTtsSettings({ volume: v })}
            formatLabel={(v) => `${Math.round(v * 100)}%`}
          />
        </SettingRow>
        {voiceOptions.length > 1 && (
          <SettingRow label="TTS Voice" description="SAPI5 voice for text-to-speech output">
            <Select
              value={settings.ttsVoiceId}
              onChange={(v) => {
                settings.setTtsVoiceId(v);
                commitTtsSettings({ voice_id: v || null });
              }}
              options={voiceOptions}
            />
          </SettingRow>
        )}
      </Section>

      <Section title="Accessibility">
        <SettingRow label="Font Size">
          <Select
            value={settings.fontSize}
            onChange={(v) => settings.setFontSize(v as 'small' | 'medium' | 'large')}
            options={[
              { value: 'small', label: 'Small' },
              { value: 'medium', label: 'Medium' },
              { value: 'large', label: 'Large' },
            ]}
          />
        </SettingRow>
        <SettingRow label="Reduced Motion" description="Minimize animations">
          <Toggle checked={settings.reducedMotion} onChange={settings.setReducedMotion} />
        </SettingRow>
      </Section>

      <div className="text-center text-xs text-elixi-muted/50 pb-4">
        ELIXI v1.0.0 · Local-first assistant with optional cloud model support
      </div>
    </div>
  );
};

export default SettingsPage;
