import { Router } from 'express';
import {
  executeAutomation,
  getWorkflows,
  saveWorkflow,
  deleteWorkflow,
  updateWorkflow,
  getAuditLogs,
  getPermissions,
  requestPermission,
} from '../controllers/automation.controller';

export const automationRoutes = Router();

automationRoutes.post('/execute', executeAutomation);
automationRoutes.get('/workflows', getWorkflows);
automationRoutes.post('/workflows', saveWorkflow);
automationRoutes.put('/workflows/:id', updateWorkflow);
automationRoutes.delete('/workflows/:id', deleteWorkflow);
automationRoutes.get('/permissions', getPermissions);
automationRoutes.post('/permissions/request', requestPermission);
automationRoutes.get('/audit-logs', getAuditLogs);
