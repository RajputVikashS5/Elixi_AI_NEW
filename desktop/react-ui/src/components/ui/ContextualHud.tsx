import React, { useEffect, useMemo, useState } from 'react';
import { Lightbulb, X } from 'lucide-react';
import { memoryService, HabitItem } from '../../services/memoryService';
import { automationService } from '../../services/automationService';
import { useAppAnchors } from '../../hooks/useAppAnchors';

type Suggestion = {
  id: string;
  title: string;
  app: string;
  workflowId?: string;
};

const fallbackSuggestions: Suggestion[] = [
  {
    id: 'coding-workspace',
    title: 'You usually start coding now. Prepare workspace?',
    app: 'VS Code',
    workflowId: 'coding-workspace',
  },
  {
    id: 'music-focus',
    title: 'Want a focus soundtrack while coding?',
    app: 'Spotify',
  },
];

export const ContextualHud: React.FC = () => {
  const [items, setItems] = useState<Suggestion[]>([]);
  const appNames = useMemo(() => items.map((item) => item.app), [items]);
  const anchors = useAppAnchors(appNames, 'hud');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await memoryService.getHabits();
        const habits = Array.isArray(res?.habits) ? res.habits : [];
        const mapped = (habits as HabitItem[]).slice(0, 2).map((h, index: number) => ({
          id: h.id || `habit-${index}`,
          title: h.description || 'Suggested automation available',
          app: index === 0 ? 'VS Code' : 'Desktop',
          workflowId: h?.action?.workflowId,
        }));
        setItems(mapped.length ? mapped : fallbackSuggestions);
      } catch {
        setItems(fallbackSuggestions);
      }
    };

    load();
  }, []);

  const dismiss = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const run = async (item: Suggestion) => {
    if (item.workflowId) {
      try {
        await automationService.runWorkflow(item.workflowId);
      } catch {
        // Non-blocking suggestion action.
      }
    }
    dismiss(item.id);
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-20 hidden xl:block">
      {items.map((item, index) => {
        const anchor = anchors[item.app];
        const left = anchor ? anchor.x : Math.max(24, window.innerWidth - 430);
        const top = anchor ? anchor.y + index * 120 : 120 + index * 120;

        return (
        <div
          key={item.id}
          className="pointer-events-auto fixed w-80 rounded-2xl border border-slate-500/30 bg-slate-900/70 p-3 shadow-xl backdrop-blur-xl"
          style={{ left: `${left}px`, top: `${top}px` }}
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Lightbulb size={13} className="text-sky-300" />
              Near {item.app} {anchor?.source === 'app-window' ? 'window' : 'workspace'}
            </div>
            <button
              onClick={() => dismiss(item.id)}
              className="no-drag text-slate-400 hover:text-slate-100"
              aria-label="Dismiss suggestion"
            >
              <X size={13} />
            </button>
          </div>
          <p className="text-sm text-slate-100">{item.title}</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => run(item)}
              className="no-drag rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-400/20"
            >
              Run
            </button>
            <button
              onClick={() => dismiss(item.id)}
              className="no-drag rounded-lg border border-slate-500/30 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
            >
              Later
            </button>
          </div>
        </div>
        );
      })}
    </div>
  );
};
