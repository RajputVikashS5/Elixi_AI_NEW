import React from 'react';
import { Play, Clock, Zap, Pencil, Trash2 } from 'lucide-react';
import { Workflow } from '../../services/automationService';
import { Button } from '../ui/Button';

interface WorkflowCardProps {
  workflow: Workflow;
  onRun: (id: string) => void;
  onEdit?: (workflow: Workflow) => void;
  onDelete?: (id: string) => void;
  isRunning?: boolean;
}

export const WorkflowCard: React.FC<WorkflowCardProps> = ({ workflow, onRun, onEdit, onDelete, isRunning }) => {
  return (
    <div className="bg-elixi-surface border border-elixi-border rounded-card p-4 hover:border-elixi-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 shrink-0 rounded-lg bg-elixi-primary/10 flex items-center justify-center">
            <Zap size={15} className="text-elixi-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-elixi-text truncate">{workflow.name}</h3>
            {workflow.description && (
              <p className="text-xs text-elixi-muted mt-0.5 truncate">{workflow.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(workflow)}
              className="p-1.5 rounded-md text-elixi-muted hover:text-elixi-primary hover:bg-elixi-primary/10 transition-colors"
              title="Edit workflow"
            >
              <Pencil size={13} />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(workflow.id)}
              className="p-1.5 rounded-md text-elixi-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Delete workflow"
            >
              <Trash2 size={13} />
            </button>
          )}
          <Button
            size="sm"
            onClick={() => onRun(workflow.id)}
            loading={isRunning}
            className="shrink-0"
          >
            <Play size={12} />
            Run
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1 text-xs text-elixi-muted">
        <Clock size={10} />
        <span>{workflow.steps.length} step{workflow.steps.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
};
