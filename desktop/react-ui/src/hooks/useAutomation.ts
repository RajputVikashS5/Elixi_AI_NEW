import { useCallback } from 'react';
import { automationService, Workflow } from '../services/automationService';

export function useAutomation() {
  const runWorkflow = useCallback(async (workflowId: string) => {
    return automationService.runWorkflow(workflowId);
  }, []);

  const executeCommand = useCallback(async (command: string, args?: string[]) => {
    return automationService.executeCommand(command, args);
  }, []);

  const getWorkflows = useCallback(async (): Promise<Workflow[]> => {
    return automationService.getWorkflows();
  }, []);

  return { runWorkflow, executeCommand, getWorkflows };
}
