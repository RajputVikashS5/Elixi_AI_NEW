import { Router } from 'express';
import { getSystemInfo, getProcesses, getHealth } from '../controllers/system.controller';

export const systemRoutes = Router();

systemRoutes.get('/info', getSystemInfo);
systemRoutes.get('/processes', getProcesses);
systemRoutes.get('/health', getHealth);
