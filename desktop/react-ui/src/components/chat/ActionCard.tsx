import React, { useState } from 'react';
import { CheckCircle2, Play, TerminalSquare, XCircle } from 'lucide-react';
import { ActionResult } from '../../store/chatStore';
import { automationService } from '../../services/automationService';

interface ActionCardProps {
  action: ActionResult;
}

export const ActionCard: React.FC<ActionCardProps> = ({ action }) => {
  const [status, setStatus] = useState<ActionResult['status']>(action.status || 'pending');

  const run = async () => {
    setStatus('pending');
    try {
      if (action.type.includes('workflow') && action.target) {
        await automationService.runWorkflow(action.target);
      } else {
        await automationService.executeCommand(action.type, action.target ? [action.target] : undefined);
      }
      setStatus('executed');
    } catch {
      setStatus('failed');
    }
  };

  return (
    <div className="mt-2 rounded-xl border border-slate-500/30 bg-slate-900/50 p-2.5">
      <div className="mb-2 flex items-center gap-2 text-xs text-slate-200">
        <TerminalSquare size={13} className="text-sky-300" />
        <span className="capitalize">{action.type.replace(/_/g, ' ')}</span>
        {action.target ? <span className="text-slate-400">· {action.target}</span> : null}
      </div>
      <div className="flex items-center justify-between">
        <button
          onClick={run}
          className="no-drag inline-flex items-center gap-1 rounded-md border border-sky-400/40 bg-sky-400/10 px-2 py-1 text-xs text-sky-200 hover:bg-sky-400/20"
        >
          <Play size={11} />
          Confirm Automation
        </button>
        <div className="text-xs">
          {status === 'executed' ? (
            <span className="inline-flex items-center gap-1 text-emerald-300">
              <CheckCircle2 size={12} /> Executed
            </span>
          ) : status === 'failed' ? (
            <span className="inline-flex items-center gap-1 text-rose-300">
              <XCircle size={12} /> Failed
            </span>
          ) : (
            <span className="text-amber-200">Pending</span>
          )}
        </div>
      </div>
    </div>
  );
};
