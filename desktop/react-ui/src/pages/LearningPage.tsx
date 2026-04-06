import React, { useEffect, useState } from 'react';
import { Brain, Lightbulb, AlignLeft, BookOpenText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { learningService, LearningInsights, LearningSnapshotRecord, PredictiveSuggestion } from '../services/learningService';
import { automationService } from '../services/automationService';

const LearningPage: React.FC = () => {
  const navigate = useNavigate();
  const [insights, setInsights] = useState<LearningInsights | null>(null);
  const [snapshots, setSnapshots] = useState<LearningSnapshotRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [actionMessage, setActionMessage] = useState<string>('');

  useEffect(() => {
    const loadInsights = async () => {
      setLoading(true);
      setError('');
      try {
        const [data, snapshotRows] = await Promise.all([
          learningService.getInsights({ limit: 8, minOccurrences: 2 }),
          learningService.getSnapshots(14),
        ]);
        setInsights(data);
        setSnapshots(snapshotRows);
      } catch (err) {
        setError('Unable to load adaptive learning insights.');
      } finally {
        setLoading(false);
      }
    };

    loadInsights();
  }, []);

  const parseWorkflowAction = (raw: string): { type?: string; target?: string; url?: string } | null => {
    try {
      const parsed = JSON.parse(raw) as { type?: string; target?: string; url?: string };
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  };

  const runSuggestion = async (suggestion: PredictiveSuggestion) => {
    setActionMessage('');
    try {
      if (suggestion.action.type === 'open_route') {
        navigate(suggestion.action.value || '/automation');
        setActionMessage('Opened linked route.');
        return;
      }

      const parsed = parseWorkflowAction(suggestion.action.value);
      if (parsed?.type === 'open_app' && parsed.target) {
        await automationService.executeCommand(`open_app:${parsed.target}`);
        setActionMessage(`Executed: open_app:${parsed.target}`);
        return;
      }

      if ((parsed?.type === 'open_url' || parsed?.type === 'open_browser') && parsed.url) {
        await automationService.executeCommand(`open_url:${parsed.url}`);
        setActionMessage(`Executed: open_url:${parsed.url}`);
        return;
      }

      navigate('/automation');
      setActionMessage('Suggestion sent to Automation page.');
    } catch {
      setActionMessage('Failed to run suggestion. Check permissions in Automation.');
    }
  };

  const pinSuggestion = async (suggestion: PredictiveSuggestion) => {
    setActionMessage('');
    try {
      const parsed = parseWorkflowAction(suggestion.action.value);

      let step: { action: string; target?: string; url?: string; cmd?: string } | null = null;
      if (parsed?.type === 'open_app' && parsed.target) {
        step = { action: 'open_app', target: parsed.target };
      } else if ((parsed?.type === 'open_url' || parsed?.type === 'open_browser') && parsed.url) {
        step = { action: 'open_url', url: parsed.url };
      }

      if (!step) {
        setActionMessage('This suggestion cannot be pinned directly yet.');
        return;
      }

      await automationService.saveWorkflow({
        name: `Learned: ${suggestion.title}`,
        description: `Pinned from adaptive learning suggestion (${Math.round(suggestion.confidence * 100)}% confidence).`,
        steps: [step],
      });

      setActionMessage('Pinned as workflow successfully.');
    } catch {
      setActionMessage('Failed to pin suggestion as workflow.');
    }
  };

  if (loading) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="rounded-card border border-elixi-border bg-elixi-surface p-4 text-sm text-elixi-muted">
          Loading Phase 6 learning insights...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full overflow-y-auto p-6">
        <div className="rounded-card border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-elixi-text">Adaptive Learning</h1>
        <p className="text-sm text-elixi-muted mt-0.5">
          Phase 6 insights: pattern detection, predictive suggestions, and communication adaptation.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3">
        <Metric label="Patterns" value={String(insights?.summary.detectedPatterns ?? 0)} icon={Brain} />
        <Metric label="User Messages" value={String(insights?.summary.totalUserMessages ?? 0)} icon={BookOpenText} />
        <Metric
          label="Avg User Length"
          value={`${insights?.summary.avgUserMessageChars ?? 0} chars`}
          icon={AlignLeft}
        />
        <Metric
          label="Verbosity"
          value={insights?.summary.verbosityRecommendation ?? 'balanced'}
          icon={Lightbulb}
        />
      </section>

      <section className="rounded-card border border-elixi-border bg-elixi-surface p-4">
        <h2 className="text-sm font-semibold text-elixi-muted uppercase tracking-wider mb-3">Predictive Suggestions</h2>
        {actionMessage ? (
          <div className="mb-3 rounded-md border border-elixi-border bg-elixi-bg/60 px-3 py-2 text-xs text-elixi-text">
            {actionMessage}
          </div>
        ) : null}
        <div className="space-y-2">
          {(insights?.predictiveSuggestions ?? []).length === 0 ? (
            <p className="text-xs text-elixi-muted">No suggestions yet. Continue using ELIXI to build learning signals.</p>
          ) : (
            insights?.predictiveSuggestions.map((item) => (
              <div key={item.id} className="rounded-lg border border-elixi-border/80 bg-elixi-bg/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-elixi-text">{item.title}</p>
                  <span className="text-xs text-elixi-muted">{Math.round(item.confidence * 100)}%</span>
                </div>
                <p className="mt-1 text-xs text-elixi-muted">{item.description}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void runSuggestion(item)}
                    className="no-drag rounded-md border border-elixi-border px-2.5 py-1 text-xs text-elixi-text hover:border-elixi-primary/50"
                  >
                    Run
                  </button>
                  <button
                    type="button"
                    onClick={() => void pinSuggestion(item)}
                    className="no-drag rounded-md border border-elixi-border px-2.5 py-1 text-xs text-elixi-text hover:border-elixi-primary/50"
                  >
                    Pin Workflow
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-card border border-elixi-border bg-elixi-surface p-4">
        <h2 className="text-sm font-semibold text-elixi-muted uppercase tracking-wider mb-3">Learning Trend (Snapshots)</h2>
        <div className="space-y-2">
          {snapshots.length === 0 ? (
            <p className="text-xs text-elixi-muted">No snapshots yet. Scheduler will populate daily and on startup.</p>
          ) : (
            snapshots.slice(0, 7).map((snapshot) => (
              <div key={snapshot.id} className="rounded-lg border border-elixi-border/80 bg-elixi-bg/60 p-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-elixi-text">
                    {new Date(snapshot.createdAt).toLocaleString()}
                  </p>
                  <span className="text-xs text-elixi-muted">
                    patterns: {snapshot.payload.summary.detectedPatterns}
                  </span>
                </div>
                <p className="text-xs text-elixi-muted mt-1">
                  verbosity: {snapshot.payload.summary.verbosityRecommendation} • diversity: {snapshot.payload.summary.vocabularyDiversity}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-card border border-elixi-border bg-elixi-surface p-4">
          <h2 className="text-sm font-semibold text-elixi-muted uppercase tracking-wider mb-3">Top Patterns</h2>
          <div className="space-y-2">
            {(insights?.patterns ?? []).length === 0 ? (
              <p className="text-xs text-elixi-muted">No recurring intent patterns detected yet.</p>
            ) : (
              insights?.patterns.map((pattern) => (
                <div key={pattern.intent} className="rounded-lg border border-elixi-border/80 bg-elixi-bg/60 p-2.5">
                  <p className="text-sm text-elixi-text">{pattern.intent}</p>
                  <p className="text-xs text-elixi-muted">{pattern.occurrences} occurrences</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-card border border-elixi-border bg-elixi-surface p-4">
          <h2 className="text-sm font-semibold text-elixi-muted uppercase tracking-wider mb-3">Vocabulary Adaptation</h2>
          <div className="flex flex-wrap gap-2">
            {(insights?.vocabularyAdaptation.topTerms ?? []).length === 0 ? (
              <p className="text-xs text-elixi-muted">No vocabulary profile yet.</p>
            ) : (
              insights?.vocabularyAdaptation.topTerms.map((term) => (
                <span
                  key={term.term}
                  className="rounded-full border border-elixi-border px-2.5 py-1 text-xs text-elixi-text bg-elixi-bg/60"
                >
                  {term.term} ({term.count})
                </span>
              ))
            )}
          </div>

          <div className="mt-4 rounded-lg border border-elixi-border/80 bg-elixi-bg/60 p-2.5">
            <p className="text-xs text-elixi-muted">Response verbosity target</p>
            <p className="text-sm text-elixi-text capitalize">{insights?.verbosityAdaptation.level}</p>
            <p className="text-xs text-elixi-muted mt-1">
              Target ~{insights?.verbosityAdaptation.targetResponseWords ?? 0} words. {insights?.verbosityAdaptation.reason}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string; icon: React.ElementType }> = ({ label, value, icon: Icon }) => (
  <div className="rounded-card border border-elixi-border bg-elixi-surface p-4 flex items-center gap-3">
    <div className="w-9 h-9 rounded-lg bg-elixi-primary/10 flex items-center justify-center">
      <Icon size={16} className="text-elixi-primary" />
    </div>
    <div>
      <p className="text-xs text-elixi-muted">{label}</p>
      <p className="text-sm font-semibold text-elixi-text mt-0.5">{value}</p>
    </div>
  </div>
);

export default LearningPage;
