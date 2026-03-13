import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { WorkflowCard } from '../components/automation/WorkflowCard';
import { automationService, Workflow } from '../services/automationService';
import { Button } from '../components/ui/Button';

const AutomationPage: React.FC = () => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    automationService.getWorkflows()
      .then(setWorkflows)
      .catch(() => setError('Could not load workflows. Is the backend running?'));
  }, []);

  const handleRun = async (id: string) => {
    setRunningId(id);
    try {
      await automationService.runWorkflow(id);
    } catch {
      setError(`Failed to run workflow: ${id}`);
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-elixi-text">Automation</h1>
          <p className="text-sm text-elixi-muted mt-0.5">Manage and run your workflows</p>
        </div>
        <Button size="sm">
          <Plus size={14} />
          New Workflow
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {workflows.length === 0 && !error ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-elixi-muted text-sm">No workflows yet.</p>
          <p className="text-elixi-muted/60 text-xs mt-1">Ask ELIXI to help you create one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {workflows.map((wf) => (
            <WorkflowCard
              key={wf.id}
              workflow={wf}
              onRun={handleRun}
              isRunning={runningId === wf.id}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AutomationPage;
