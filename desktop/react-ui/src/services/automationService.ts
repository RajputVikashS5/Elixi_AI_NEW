import { api } from './api';

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
}

export interface WorkflowStep {
  action: string;
  target?: string;
  cmd?: string;
  url?: string;
  delay?: number;
}

export const automationService = {
  getWorkflows: async (): Promise<Workflow[]> => {
    const res = await api.get<{ workflows: Workflow[] }>('/api/automation/workflows');
    return res.data.workflows;
  },

  runWorkflow: async (workflowId: string) => {
    const res = await api.post('/api/automation/execute', { workflowId });
    return res.data;
  },

  executeCommand: async (command: string, args?: string[]) => {
    const res = await api.post('/api/automation/execute', { command, args });
    return res.data;
  },

  getPermissions: async () => {
    const res = await api.get('/api/automation/permissions');
    return res.data;
  },

  requestPermission: async (commandPattern: string, tier: number) => {
    const res = await api.post('/api/automation/permissions/request', { commandPattern, tier });
    return res.data;
  },
};
