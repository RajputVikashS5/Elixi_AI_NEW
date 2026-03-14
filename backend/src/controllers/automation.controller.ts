import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { automationService, WorkflowPermissionError } from '../services/automation.service';
import { memoryService } from '../services/memory.service';
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
      let result;
      try {
        result = await automationService.runWorkflow(workflowId);
      } catch (err) {
        if (err instanceof WorkflowPermissionError) {
          await memoryService.logAudit({
            command: err.detail.commandPattern,
            intent: 'workflow_execution',
            action: 'run_workflow',
            permissionTier: err.detail.tier,
            status: err.detail.prohibited ? 'blocked' : 'denied',
          });

          return res.status(403).json({
            error: err.detail.prohibited ? 'Workflow contains prohibited action' : 'Permission required',
            workflowId: err.detail.workflowId,
            stepIndex: err.detail.stepIndex,
            action: err.detail.action,
            commandPattern: err.detail.commandPattern,
            tier: err.detail.tier,
            requiresApproval: err.detail.requiresApproval,
            prohibited: err.detail.prohibited,
          });
        }
        throw err;
      }

      await memoryService.logAudit({
        command: `workflow:${workflowId}`,
        intent: 'workflow_execution',
        action: 'run_workflow',
        permissionTier: 2,
        status: 'approved',
      });
      return res.json({ success: true, result });
    }

    if (command) {
      // Check permission before executing
      const tier = permissionService.getCommandTier(command);
      const isGranted = await permissionService.isPermissionGranted(command);

      if (tier >= 5) {
        await memoryService.logAudit({
          command,
          intent: 'automation_command',
          action: 'execute_command',
          permissionTier: tier,
          status: 'blocked',
        });
        return res.status(403).json({ error: 'Command is prohibited', tier });
      }

      if (tier >= 3 && !isGranted) {
        await memoryService.logAudit({
          command,
          intent: 'automation_command',
          action: 'execute_command',
          permissionTier: tier,
          status: 'denied',
        });
        return res.status(403).json({
          error: 'Permission required',
          tier,
          commandPattern: command,
          requiresApproval: true,
        });
      }

      const result = await automationService.executeCommand(command, args);
      await memoryService.logAudit({
        command,
        intent: 'automation_command',
        action: 'execute_command',
        permissionTier: tier,
        status: 'approved',
      });
      return res.json({ success: true, result });
    }
  } catch (err) {
    const body = req.body as { command?: string; workflowId?: string };
    const command = body.command || (body.workflowId ? `workflow:${body.workflowId}` : 'unknown');
    const tier = body.command ? permissionService.getCommandTier(body.command) : 2;
    await memoryService.logAudit({
      command,
      intent: 'automation_command',
      action: 'execute_command',
      permissionTier: tier,
      status: 'blocked',
    });
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

export async function updateWorkflow(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const updated = await automationService.updateWorkflow(id, req.body);
    return res.json({ success: true, workflow: updated });
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

export async function getAuditLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const parsedLimit = Number(req.query.limit ?? 100);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 500) : 100;
    const logs = await memoryService.getAuditLogs(limit);
    return res.json({ logs });
  } catch (err) {
    next(err);
  }
}
