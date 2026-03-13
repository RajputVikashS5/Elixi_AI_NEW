import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { automationService } from '../services/automation.service';
import { permissionService } from '../services/permission.service';

const executeSchema = z.object({
  workflowId: z.string().optional(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
}).refine((d) => d.workflowId || d.command, {
  message: 'Either workflowId or command must be provided',
});

export async function executeAutomation(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = executeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.issues });
    }

    const { workflowId, command, args } = parsed.data;

    if (workflowId) {
      const result = await automationService.runWorkflow(workflowId);
      return res.json({ success: true, result });
    }

    if (command) {
      // Check permission before executing
      const tier = permissionService.getCommandTier(command);
      const isGranted = await permissionService.isPermissionGranted(command);

      if (tier >= 5) {
        return res.status(403).json({ error: 'Command is prohibited', tier });
      }

      if (tier >= 3 && !isGranted) {
        return res.status(403).json({
          error: 'Permission required',
          tier,
          commandPattern: command,
          requiresApproval: true,
        });
      }

      const result = await automationService.executeCommand(command, args);
      return res.json({ success: true, result });
    }
  } catch (err) {
    next(err);
  }
}

export async function getWorkflows(_req: Request, res: Response, next: NextFunction) {
  try {
    const workflows = await automationService.getWorkflows();
    return res.json({ workflows });
  } catch (err) {
    next(err);
  }
}

export async function saveWorkflow(req: Request, res: Response, next: NextFunction) {
  try {
    const workflow = req.body;
    const saved = await automationService.saveWorkflow(workflow);
    return res.json({ success: true, workflow: saved });
  } catch (err) {
    next(err);
  }
}

export async function deleteWorkflow(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await automationService.deleteWorkflow(id);
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function getPermissions(_req: Request, res: Response, next: NextFunction) {
  try {
    const permissions = await permissionService.getAllPermissions();
    return res.json({ permissions });
  } catch (err) {
    next(err);
  }
}

export async function requestPermission(req: Request, res: Response, next: NextFunction) {
  try {
    const { commandPattern, tier } = req.body;
    if (!commandPattern || tier === undefined) {
      return res.status(400).json({ error: 'commandPattern and tier are required' });
    }
    // In Phase 1, permission granting is tracked; UI dialogs handle actual approval
    await permissionService.grantPermission(commandPattern, tier);
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
