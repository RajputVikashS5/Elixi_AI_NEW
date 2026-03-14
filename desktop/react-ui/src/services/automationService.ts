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
  args?: string[];
  delay?: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  command: string;
  intent?: string;
  action: string;
  permission_tier: number;
  status: 'approved' | 'denied' | 'blocked';
  session_id?: string;
}

export interface AutomationPermissionResponse {
  error: string;
  tier: number;
  commandPattern: string;
  requiresApproval?: boolean;
  prohibited?: boolean;
  stepIndex?: number;
  action?: string;
  workflowId?: string;
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

  saveWorkflow: async (workflow: Omit<Workflow, 'id'>): Promise<Workflow> => {
    const res = await api.post<{ success: boolean; workflow: Workflow }>('/api/automation/workflows', workflow);
    return res.data.workflow;
  },

  updateWorkflow: async (id: string, workflow: Omit<Workflow, 'id'>): Promise<Workflow> => {
    const res = await api.put<{ success: boolean; workflow: Workflow }>(`/api/automation/workflows/${id}`, workflow);
    return res.data.workflow;
  },

  deleteWorkflow: async (id: string): Promise<void> => {
    await api.delete(`/api/automation/workflows/${id}`);
  },

  getAuditLogs: async (limit = 100): Promise<AuditLogEntry[]> => {
    const res = await api.get<{ logs: AuditLogEntry[] }>(`/api/automation/audit-logs?limit=${limit}`);
    return res.data.logs;
  },
};
