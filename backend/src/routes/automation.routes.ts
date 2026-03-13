import { Router } from 'express';
import {
  executeAutomation,
  getWorkflows,
  saveWorkflow,
  deleteWorkflow,
  getPermissions,
  requestPermission,
} from '../controllers/automation.controller';

export const automationRoutes = Router();

automationRoutes.post('/execute', executeAutomation);
automationRoutes.get('/workflows', getWorkflows);
automationRoutes.post('/workflows', saveWorkflow);
automationRoutes.delete('/workflows/:id', deleteWorkflow);
automationRoutes.get('/permissions', getPermissions);
automationRoutes.post('/permissions/request', requestPermission);
