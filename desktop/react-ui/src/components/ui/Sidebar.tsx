import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageSquare, LayoutDashboard, Zap, Brain, Mic, Settings, Bot, ShieldCheck, Clock3, Lightbulb, PlugZap } from 'lucide-react';
import { useEmotionStore } from '../../store/emotionStore';
import { useSettingsStore } from '../../store/settingsStore';
import { EmotionIndicator } from '../emotion/EmotionIndicator';
import { useChatStore } from '../../store/chatStore';
import { memoryService, HabitItem } from '../../services/memoryService';
import { clsx } from 'clsx';

const navItems = [
  { path: '/chat', icon: MessageSquare, label: 'Chat' },
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/automation', icon: Zap, label: 'Automation' },
  { path: '/memory', icon: Brain, label: 'Memory' },
  { path: '/learning', icon: Lightbulb, label: 'Learning' },
  { path: '/integrations', icon: PlugZap, label: 'Integrations' },
  { path: '/voice', icon: Mic, label: 'Voice' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { emotion } = useEmotionStore();
  const { personalityMode, setPersonalityMode, llmProvider } = useSettingsStore();
  const isCloudProvider = llmProvider === 'openrouter' || llmProvider === 'gemini' || llmProvider === 'online';
  const { messages } = useChatStore();
  const [memoryRecents, setMemoryRecents] = useState<Array<{ id: string; description: string }>>([]);
  const [activeTab, setActiveTab] = useState<'copilot' | 'recents'>('copilot');

  useEffect(() => {
    const loadHabits = async () => {
      try {
        const data = await memoryService.getHabits();
        const habits = Array.isArray(data?.habits) ? data.habits : [];
        const mapped = (habits as HabitItem[]).slice(0, 5).map((h, index: number) => ({
          id: h.id || `habit-${index}`,
          description: h.description || 'You usually start coding around this time. Click to prepare.',
        }));
        setMemoryRecents(mapped);
      } catch {
        setMemoryRecents([
          {
            id: 'fallback-coding',
            description: '9:00 PM: You usually start coding. Click to prepare.',
          },
        ]);
      }
    };

    loadHabits();
  }, []);

  const recentAssistantMessages = useMemo(
    () => messages.filter((m) => m.role === 'assistant').slice(-5).reverse(),
    [messages]
  );

  return (
    <aside className="w-[340px] shrink-0 p-4">
      {/* Logo */}
      <div className="glass-panel panel-notch relative mb-4 border border-cyan-200/15 px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-400/15">
            <Bot size={18} className="text-sky-300" />
          </div>
          <div>
            <span className="font-semibold tracking-wide text-slate-100">Library of Essences</span>
            <p className="text-[11px] text-slate-400">Runtime panel</p>
          </div>
        </div>
        <div className={clsx(
          'flex items-center gap-1 rounded-full px-2 py-1 text-[11px]',
          isCloudProvider
            ? 'border border-violet-400/30 bg-violet-400/10 text-violet-300'
            : 'border border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
        )}>
          <ShieldCheck size={11} />
          {isCloudProvider ? 'Cloud' : 'Local'}
        </div>
      </div>

      {/* Navigation */}
      <nav className="glass-panel mb-4 grid grid-cols-5 gap-1 border border-cyan-200/15 px-2 py-2">
        {navItems.map(({ path, icon: Icon, label }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={clsx(
              'flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] transition-all duration-200 no-drag',
              location.pathname === path
                ? 'bg-sky-400/15 text-sky-300'
                : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
            )}
            title={label}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </nav>

      <div className="glass-panel panel-notch relative mb-4 border border-cyan-200/15 p-3">
        <div className="mb-2 flex gap-2">
          <button
            onClick={() => setActiveTab('copilot')}
            className={clsx(
              'no-drag rounded-lg px-2.5 py-1 text-xs transition-colors',
              activeTab === 'copilot' ? 'bg-sky-400/15 text-sky-200' : 'text-slate-400 hover:bg-white/5'
            )}
          >
            Copilot
          </button>
          <button
            onClick={() => setActiveTab('recents')}
            className={clsx(
              'no-drag rounded-lg px-2.5 py-1 text-xs transition-colors',
              activeTab === 'recents' ? 'bg-sky-400/15 text-sky-200' : 'text-slate-400 hover:bg-white/5'
            )}
          >
            Memory Stream
          </button>
        </div>

        {activeTab === 'copilot' ? (
          <div className="space-y-2">
            {recentAssistantMessages.length === 0 ? (
              <div className="rounded-xl border border-slate-500/30 bg-slate-800/50 p-3 text-xs text-slate-400">
                Copilot thread will appear here as ELIXI responds.
              </div>
            ) : (
              recentAssistantMessages.map((msg) => (
                <div key={msg.id} className="rounded-xl border border-slate-500/30 bg-slate-800/50 p-3 text-xs text-slate-200">
                  {msg.content.slice(0, 180) || 'Streaming response...'}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {memoryRecents.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate('/automation')}
                className="no-drag flex w-full items-start gap-2 rounded-xl border border-slate-500/30 bg-slate-800/50 p-3 text-left text-xs text-slate-200 hover:border-sky-300/40"
              >
                <Clock3 size={13} className="mt-0.5 shrink-0 text-sky-300" />
                <span>{item.description}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Status panel */}
      <div className="glass-panel panel-notch relative space-y-2 border border-cyan-200/15 p-3">
        <div className="flex items-center justify-between rounded-lg border border-cyan-200/15 bg-slate-800/50 px-2 py-1.5">
          <span className="text-xs text-slate-400">Emotion</span>
          <EmotionIndicator state={emotion.state} compact />
        </div>

        <div className="rounded-lg border border-cyan-200/15 bg-slate-800/50 px-2 py-2">
          <p className="mb-2 text-xs text-slate-400">Personality</p>
          <div className="grid grid-cols-3 gap-1">
            {(['professional', 'friendly', 'calm', 'focus', 'silent'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setPersonalityMode(mode)}
                className={clsx(
                  'no-drag rounded-md px-2 py-1 text-[11px] capitalize',
                  personalityMode === mode
                    ? 'bg-sky-400/20 text-sky-200'
                    : 'bg-slate-700/30 text-slate-300 hover:bg-slate-700/50'
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};
