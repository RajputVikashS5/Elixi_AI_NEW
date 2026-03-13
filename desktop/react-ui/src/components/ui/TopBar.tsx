import React, { useState, useEffect } from 'react';
import { Minus, Square, X, Maximize2 } from 'lucide-react';
import { ShieldCheck } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';

export const TopBar: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [privacyMode, setPrivacyMode] = useState<'local' | 'cloud'>('local');
  const { voiceEnabled } = useSettingsStore();
  const isElectron = !!window.electronAPI;

  useEffect(() => {
    if (!isElectron) return;

    window.electronAPI?.isMaximized().then(setIsMaximized);

    const handler = (val: unknown) => setIsMaximized(val as boolean);
    window.electronAPI?.on('window:maximize-change', handler);
    return () => window.electronAPI?.off('window:maximize-change', handler);
  }, [isElectron]);

  return (
    <header className="drag-region flex h-10 shrink-0 items-center justify-between border-b border-slate-500/30 bg-slate-900/50 backdrop-blur-xl">
      {/* App name / drag area */}
      <div className="flex items-center gap-3 px-4">
        <span className="select-none text-xs font-medium tracking-widest text-slate-300 uppercase">
          ELIXI · Intelligence with Empathy
        </span>
        <button
          onClick={() => setPrivacyMode((p) => (p === 'local' ? 'cloud' : 'local'))}
          className="no-drag flex items-center gap-1 rounded-full border border-slate-500/40 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-white/5"
          title="Privacy processing mode"
        >
          <ShieldCheck size={11} className={privacyMode === 'local' ? 'text-emerald-300' : 'text-violet-300'} />
          {privacyMode === 'local' ? 'Local Processing' : 'Cloud Sync'}
          {voiceEnabled && privacyMode === 'local' ? ' · Voice On' : ''}
        </button>
      </div>

      {/* Window controls */}
      {isElectron && (
        <div className="flex items-center no-drag">
          <button
            onClick={() => window.electronAPI?.minimize()}
            className="h-10 w-10 flex items-center justify-center text-elixi-muted hover:text-elixi-text hover:bg-white/5 transition-colors"
            aria-label="Minimize"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={() => window.electronAPI?.maximize()}
            className="h-10 w-10 flex items-center justify-center text-elixi-muted hover:text-elixi-text hover:bg-white/5 transition-colors"
            aria-label={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? <Square size={12} /> : <Maximize2 size={12} />}
          </button>
          <button
            onClick={() => window.electronAPI?.close()}
            className="h-10 w-10 flex items-center justify-center text-elixi-muted hover:text-white hover:bg-red-500 transition-colors"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </header>
  );
};
