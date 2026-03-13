import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Cpu, Mic, MicOff, ShieldCheck } from 'lucide-react';
import { api } from '../../services/api';
import { useVoice } from '../../hooks/useVoice';
import { VoiceWaveform } from '../voice/VoiceWaveform';
import { useSettingsStore } from '../../store/settingsStore';
import { useAppAnchors } from '../../hooks/useAppAnchors';

interface SystemInfo {
  cpu: number;
  ram: { used: number; total: number };
}

export const FloatingWidget: React.FC = () => {
  const { status, volume, startListening, stopListening } = useVoice();
  const { voiceEnabled } = useSettingsStore();
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const anchors = useAppAnchors(['ELIXI'], 'widget');

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const res = await api.get<SystemInfo>('/api/system/info');
        setInfo(res.data);
      } catch {
        // Ignore polling failures while backend is down.
      }
    };

    fetchInfo();
    const id = window.setInterval(fetchInfo, 6000);
    return () => window.clearInterval(id);
  }, []);

  const ramPercent = useMemo(() => {
    if (!info || !info.ram.total) return 0;
    return Math.round((info.ram.used / info.ram.total) * 100);
  }, [info]);

  return (
    <div
      className="fixed z-20 hidden xl:flex items-center gap-3 rounded-full border border-slate-500/30 bg-slate-900/55 px-4 py-2 shadow-2xl backdrop-blur-2xl"
      style={{
        left: `${anchors.ELIXI?.x ?? Math.max(24, window.innerWidth - 430)}px`,
        top: `${anchors.ELIXI?.y ?? 56}px`,
      }}
    >
      <div className="flex items-center gap-2 text-xs text-slate-200">
        <Cpu size={14} className="text-sky-300" />
        <span>{info ? `${info.cpu.toFixed(0)}%` : '--'}</span>
      </div>
      <div className="h-4 w-px bg-slate-500/30" />
      <div className="flex items-center gap-2 text-xs text-slate-200">
        <Activity size={14} className="text-amber-300" />
        <span>RAM {info ? `${ramPercent}%` : '--'}</span>
      </div>
      <div className="h-4 w-px bg-slate-500/30" />
      <div className="flex items-center gap-2">
        <VoiceWaveform status={status} volume={volume} />
        <button
          onClick={status === 'listening' ? stopListening : startListening}
          className="no-drag rounded-full border border-slate-400/30 p-1.5 text-slate-200 hover:bg-white/10"
          title="Toggle listening"
        >
          {status === 'listening' ? <MicOff size={13} /> : <Mic size={13} />}
        </button>
      </div>
      <div className="h-4 w-px bg-slate-500/30" />
      <div className="flex items-center gap-1 text-[11px] text-emerald-300">
        <ShieldCheck size={12} />
        {voiceEnabled ? 'Local listening' : 'Local only'}
      </div>
    </div>
  );
};
