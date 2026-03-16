import React, { useCallback, useEffect, useState } from 'react';
import { useSettingsStore, PersonalityMode, OllamaModel } from '../store/settingsStore';
import { voiceService, VoiceEntry } from '../services/voiceService';

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

const SettingsPage: React.FC = () => {
  const settings = useSettingsStore();
  const [voices, setVoices] = useState<VoiceEntry[]>([]);

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
        <SettingRow label="Ollama Model" description="Local LLM model to use for inference">
          <Select
            value={settings.ollamaModel}
            onChange={(v) => settings.setOllamaModel(v as OllamaModel)}
            options={modelOptions}
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
        ELIXI v1.0.0 · All data stays on your device · No cloud required
      </div>
    </div>
  );
};

export default SettingsPage;
