import React, { useMemo, useState } from 'react';
import { CheckCircle2, Circle, Loader2, Play, TerminalSquare } from 'lucide-react';
import { useSocket, AutomationProgressEvent } from '../../hooks/useSocket';
import { Button } from '../ui/Button';

type StepState = 'queued' | 'running' | 'done' | 'failed';

interface VisualStep {
  id: string;
  label: string;
  state: StepState;
}

const defaultSteps: VisualStep[] = [
  { id: 'vscode', label: 'Open VS Code', state: 'queued' },
  { id: 'terminal', label: 'Launch Terminal', state: 'queued' },
  { id: 'spotify', label: 'Open Spotify', state: 'queued' },
];

const toStepLabel = (event: AutomationProgressEvent): string => {
  const action = event.step?.action?.replace(/_/g, ' ') || 'workflow step';
  const target = event.step?.target || event.step?.url || '';
  const base = action.charAt(0).toUpperCase() + action.slice(1);
  return target ? `${base} ${target}` : base;
};

export const WorkflowVisualizer: React.FC = () => {
  const { runWorkflowWithProgress } = useSocket();
  const [steps, setSteps] = useState<VisualStep[]>(defaultSteps);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const progress = useMemo(() => {
    const done = steps.filter((s) => s.state === 'done').length;
    return Math.round((done / Math.max(steps.length, 1)) * 100);
  }, [steps]);

  const applyProgress = (event: AutomationProgressEvent) => {
    setSteps((prev) => {
      const total = event.totalSteps || prev.length || 1;
      const next = prev.length === total
        ? [...prev]
        : Array.from({ length: total }, (_, index) => ({
          id: `step-${index}`,
          label: prev[index]?.label || `Step ${index + 1}`,
          state: prev[index]?.state || 'queued',
        }));

      if (event.status === 'running' || event.status === 'success' || event.status === 'failed') {
        const idx = event.stepIndex;
        if (next[idx]) {
          next[idx] = {
            ...next[idx],
            label: toStepLabel(event),
            state: event.status === 'running'
              ? 'running'
              : event.status === 'success'
                ? 'done'
                : 'failed',
          };
        }
      }

      if (event.status === 'completed') {
        return next.map((step) => (step.state === 'running' ? { ...step, state: 'done' } : step));
      }

      return next;
    });
  };

  const runWorkflow = async () => {
    setRunning(true);
    setError(null);
    setSteps(defaultSteps.map((step) => ({ ...step, state: 'queued' })));

    try {
      await runWorkflowWithProgress('coding-workspace', applyProgress);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Workflow failed');
      setSteps((prev) => prev.map((step) => (step.state === 'running' ? { ...step, state: 'failed' } : step)));
    }
    setRunning(false);
  };

  const iconFor = (state: StepState) => {
    if (state === 'done') return <CheckCircle2 size={14} className="text-emerald-300" />;
    if (state === 'running') return <Loader2 size={14} className="animate-spin text-amber-300" />;
    if (state === 'failed') return <Circle size={14} className="text-rose-400" />;
    return <Circle size={14} className="text-slate-500" />;
  };

  return (
    <section className="rounded-2xl border border-slate-600/30 bg-slate-900/45 p-4 backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-200">
          <TerminalSquare size={15} className="text-sky-300" />
          Workflow Visualization
        </div>
        <Button size="sm" onClick={runWorkflow} loading={running}>
          <Play size={12} />
          Run
        </Button>
      </div>

      <div className="mb-3 h-1.5 w-full rounded-full bg-slate-700/60">
        <div className="h-1.5 rounded-full bg-sky-400 transition-all" style={{ width: `${progress}%` }} />
      </div>

      {error && <p className="mb-2 text-xs text-rose-300">{error}</p>}

      <div className="grid grid-cols-3 items-center gap-2 text-xs text-slate-300">
        {steps.map((step, index) => (
          <div key={step.id} className="relative rounded-xl border border-slate-600/30 bg-slate-800/60 p-3">
            <div className="mb-2">{iconFor(step.state)}</div>
            <div>{step.label}</div>
            {index < steps.length - 1 && (
              <div className="absolute -right-2 top-1/2 h-px w-4 bg-slate-500/70" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
