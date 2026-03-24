import React from 'react';
import { EmotionData, EmotionState } from '../../store/emotionStore';

const STATE_STYLE: Record<EmotionState, string> = {
  focused: 'text-green-300 bg-green-500/10 border-green-500/20',
  stressed: 'text-red-300 bg-red-500/10 border-red-500/20',
  fatigued: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/20',
  frustrated: 'text-orange-300 bg-orange-500/10 border-orange-500/20',
  motivated: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  neutral: 'text-elixi-muted bg-elixi-surface border-elixi-border',
};

interface EmotionTimelinePanelProps {
  current: EmotionData;
  history: EmotionData[];
}

function toTimeLabel(date: Date): string {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export const EmotionTimelinePanel: React.FC<EmotionTimelinePanelProps> = ({ current, history }) => {
  const timeline = [...history, current].slice(-8).reverse();

  return (
    <div className="rounded-xl border border-elixi-border bg-elixi-surface/70 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-elixi-muted">Emotion Timeline</h3>
        <span className="text-[11px] text-elixi-muted">Live</span>
      </div>

      {timeline.length === 0 ? (
        <div className="text-xs text-elixi-muted">No emotion events yet.</div>
      ) : (
        <div className="space-y-2">
          {timeline.map((entry, idx) => {
            const sources = entry.signals.sources ?? [];
            const summaries = entry.signals.summaries ?? [];
            return (
              <div key={`${entry.updatedAt.toISOString()}-${idx}`} className="rounded-lg border border-elixi-border/70 bg-elixi-bg/40 p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs px-2 py-0.5 border rounded-full capitalize ${STATE_STYLE[entry.state]}`}>
                    {entry.state}
                  </span>
                  <span className="text-[11px] text-elixi-muted">{toTimeLabel(entry.updatedAt)}</span>
                </div>
                <div className="mt-1 text-[11px] text-elixi-text">
                  Confidence: <span className="font-medium">{Math.round(entry.confidence * 100)}%</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {sources.length > 0 ? (
                    sources.map((source) => (
                      <span
                        key={source}
                        className="text-[10px] px-1.5 py-0.5 rounded border border-elixi-border text-elixi-muted bg-elixi-surface"
                      >
                        {source}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-elixi-muted">No signal sources</span>
                  )}
                </div>

                {summaries.length > 0 ? (
                  <ul className="mt-1 space-y-0.5">
                    {summaries.map((summary, summaryIndex) => (
                      <li key={`${summaryIndex}-${summary}`} className="text-[11px] text-elixi-muted leading-relaxed">
                        • {summary}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
