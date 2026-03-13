import React from 'react';
import { Play, Clock, Zap } from 'lucide-react';
import { Workflow } from '../../services/automationService';
import { Button } from '../ui/Button';

interface WorkflowCardProps {
  workflow: Workflow;
  onRun: (id: string) => void;
  isRunning?: boolean;
}

export const WorkflowCard: React.FC<WorkflowCardProps> = ({ workflow, onRun, isRunning }) => {
  return (
    <div className="bg-elixi-surface border border-elixi-border rounded-card p-4 hover:border-elixi-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-elixi-primary/10 flex items-center justify-center">
            <Zap size={15} className="text-elixi-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-elixi-text">{workflow.name}</h3>
            {workflow.description && (
              <p className="text-xs text-elixi-muted mt-0.5">{workflow.description}</p>
            )}
          </div>
        </div>
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

      <div className="flex items-center gap-1 text-xs text-elixi-muted">
        <Clock size={10} />
        <span>{workflow.steps.length} step{workflow.steps.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
};
