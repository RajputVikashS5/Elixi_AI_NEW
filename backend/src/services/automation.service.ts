import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { commandValidator } from '../utils/commandValidator';
import { permissionService } from './permission.service';
import { logger } from '../utils/logger';

const PROJECT_ROOT = path.resolve(__dirname, '../../../');
const WORKFLOWS_PATH = path.join(PROJECT_ROOT, 'config', 'workflows.json');
const BUILT_IN_WORKFLOWS_DIR = path.join(PROJECT_ROOT, 'automation', 'workflows');
const WORKSPACE_ROOT = PROJECT_ROOT;
const SAFE_PATH_BASES = [WORKSPACE_ROOT, os.homedir()];

export interface WorkflowStep {
  action: string;
  target?: string;
  cmd?: string;
  url?: string;
  args?: string[];
  delay?: number;
  params?: {
    app?: string;
    target?: string;
    cmd?: string;
    command?: string;
    url?: string;
    args?: string[];
  };
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
}

export type WorkflowProgressStatus = 'started' | 'running' | 'success' | 'failed' | 'completed';

export interface WorkflowProgressEvent {
  runId: string;
  workflowId: string;
  workflowName: string;
  status: WorkflowProgressStatus;
  stepIndex: number;
  totalSteps: number;
  step?: WorkflowStep;
  error?: string;
  timestamp: string;
}

export interface RunWorkflowOptions {
  runId?: string;
  onProgress?: (event: WorkflowProgressEvent) => void;
}

export interface WorkflowPermissionRequirement {
  workflowId: string;
  workflowName: string;
  stepIndex: number;
  action: string;
  commandPattern: string;
  tier: number;
  prohibited: boolean;
  requiresApproval: boolean;
}

export class WorkflowPermissionError extends Error {
  public readonly detail: WorkflowPermissionRequirement;

  constructor(detail: WorkflowPermissionRequirement) {
    super(
      detail.prohibited
        ? `Workflow step is prohibited: ${detail.commandPattern}`
        : `Permission required for workflow step: ${detail.commandPattern}`
    );
    this.name = 'WorkflowPermissionError';
    this.detail = detail;
  }
}

const STEP_ACTIONS = [
  'open_app',
  'switch_app',
  'close_app',
  'open_browser',
  'open_url',
  'run_command',
] as const;

const workflowStepSchema = z.object({
  action: z.enum(STEP_ACTIONS),
  target: z.string().min(1).optional(),
  cmd: z.string().min(1).optional(),
  url: z.string().url().optional(),
  args: z.array(z.string()).optional(),
  delay: z.number().int().min(0).max(120000).optional(),
  params: z
    .object({
      app: z.string().min(1).optional(),
      target: z.string().min(1).optional(),
      cmd: z.string().min(1).optional(),
      command: z.string().min(1).optional(),
      url: z.string().url().optional(),
      args: z.array(z.string()).optional(),
    })
    .optional(),
});

const workflowBaseSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(280).optional(),
  steps: z.array(workflowStepSchema).min(1).max(50),
});

const workflowInputSchema = workflowBaseSchema
  .superRefine((workflow, ctx) => {
    for (let i = 0; i < workflow.steps.length; i += 1) {
      const step = workflow.steps[i];
      const target = step.target || step.params?.target || step.params?.app;
      const command = step.cmd || step.params?.cmd || step.params?.command;
      const url = step.url || step.params?.url;

      if (['open_app', 'switch_app', 'close_app'].includes(step.action) && !target) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Step ${i + 1} (${step.action}) requires target or params.app` });
      }

      if (['open_browser', 'open_url'].includes(step.action) && !url) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Step ${i + 1} (${step.action}) requires url` });
      }

      if (step.action === 'run_command' && !command) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Step ${i + 1} (run_command) requires cmd or params.command` });
      }
    }
  });

const persistedWorkflowSchema = workflowBaseSchema.extend({
  id: z.string().min(1),
}).superRefine((workflow, ctx) => {
  const parsed = workflowInputSchema.safeParse(workflow);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      ctx.addIssue(issue);
    }
  }
});

function parseAutomationCommand(command: string, args?: string[]): { base: string; target?: string } {
  const normalized = command.toLowerCase().trim();
  const [base, ...rest] = normalized.split(':');
  const targetFromCommand = rest.join(':').trim();
  const targetFromArgs = args?.[0]?.trim();

  return {
    base,
    target: targetFromCommand || targetFromArgs,
  };
}

function ensureSafePath(inputPath: string): string {
  const resolved = path.isAbsolute(inputPath)
    ? path.resolve(inputPath)
    : path.resolve(WORKSPACE_ROOT, inputPath);

  const isAllowed = SAFE_PATH_BASES.some((base) => {
    const normalizedBase = path.resolve(base);
    return resolved === normalizedBase || resolved.startsWith(normalizedBase + path.sep);
  });

  if (!isAllowed) {
    throw new Error('Path is outside allowed directories');
  }

  return resolved;
}

function searchFiles(rootPath: string, query: string, maxResults = 20): string[] {
  const results: string[] = [];
  const skipDirs = new Set(['node_modules', '.git', 'dist', 'build', '.venv', 'venv', '__pycache__']);

  const walk = (currentPath: string): void => {
    if (results.length >= maxResults) return;

    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxResults) return;
      if (entry.isDirectory() && skipDirs.has(entry.name)) continue;

      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (entry.name.toLowerCase().includes(query.toLowerCase())) {
        results.push(path.relative(WORKSPACE_ROOT, fullPath));
      }
    }
  };

  walk(rootPath);
  return results;
}

function loadWorkflows(): Workflow[] {
  const workflows: Workflow[] = [];

  // Load built-in workflows
  if (fs.existsSync(BUILT_IN_WORKFLOWS_DIR)) {
    const files = fs.readdirSync(BUILT_IN_WORKFLOWS_DIR).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(BUILT_IN_WORKFLOWS_DIR, file), 'utf-8');
        const parsed = persistedWorkflowSchema.safeParse(JSON.parse(content));
        if (!parsed.success) {
          logger.warn(`Skipping malformed built-in workflow: ${file}`);
          continue;
        }
        workflows.push(parsed.data);
      } catch {
        // Skip malformed workflow files
      }
    }
  }

  // Load user-saved workflows
  if (fs.existsSync(WORKFLOWS_PATH)) {
    try {
      const content = fs.readFileSync(WORKFLOWS_PATH, 'utf-8');
      const userPayload = JSON.parse(content) as unknown;
      const rawUserWorkflows = Array.isArray(userPayload)
        ? userPayload
        : (userPayload && typeof userPayload === 'object' && Array.isArray((userPayload as { workflows?: unknown[] }).workflows))
          ? (userPayload as { workflows: unknown[] }).workflows
          : null;

      if (!rawUserWorkflows) {
        logger.warn('Ignoring malformed user workflows config');
        return workflows;
      }

      const parsed = z.array(persistedWorkflowSchema).safeParse(rawUserWorkflows);
      if (parsed.success) {
        workflows.push(...parsed.data);
      } else {
        logger.warn('Ignoring malformed user workflows config');
      }
    } catch {
      // Ignore parse errors
    }
  }

  return workflows;
}

function saveUserWorkflows(workflows: Workflow[]): void {
  const configDir = path.dirname(WORKFLOWS_PATH);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  fs.writeFileSync(WORKFLOWS_PATH, JSON.stringify({ workflows }, null, 2), 'utf-8');
}

function loadUserWorkflowsOnly(): Workflow[] {
  if (!fs.existsSync(WORKFLOWS_PATH)) return [];

  try {
    const content = fs.readFileSync(WORKFLOWS_PATH, 'utf-8');
    const parsedContent = JSON.parse(content) as unknown;
    const raw = Array.isArray(parsedContent)
      ? parsedContent
      : (parsedContent && typeof parsedContent === 'object' && Array.isArray((parsedContent as { workflows?: unknown[] }).workflows))
        ? (parsedContent as { workflows: unknown[] }).workflows
        : [];

    const parsed = z.array(persistedWorkflowSchema).safeParse(raw);
    if (!parsed.success) {
      logger.warn('Ignoring malformed user workflows config');
      return [];
    }

    return parsed.data;
  } catch {
    return [];
  }
}

function normalizeWorkflowId(id: string): string {
  return id.trim().toLowerCase().replace(/[_\s]+/g, '-');
}

function getStepTarget(step: WorkflowStep): string | undefined {
  return step.target || step.params?.target || step.params?.app;
}

function getStepUrl(step: WorkflowStep): string | undefined {
  return step.url || step.params?.url;
}

function getStepCommand(step: WorkflowStep): string | undefined {
  return step.cmd || step.params?.cmd || step.params?.command;
}

function getStepArgs(step: WorkflowStep): string[] | undefined {
  return step.args || step.params?.args;
}

function commandPatternFromStep(step: WorkflowStep): string | null {
  const target = getStepTarget(step);
  const url = getStepUrl(step);
  const command = getStepCommand(step);

  switch (step.action) {
    case 'open_app':
      return target ? `open_app:${target}` : null;
    case 'switch_app':
      return target ? `switch_app:${target}` : null;
    case 'close_app':
      return target ? `close_app:${target}` : null;
    case 'open_browser':
    case 'open_url':
      return url ? `open_url:${url}` : null;
    case 'run_command':
      return command || null;
    default:
      return null;
  }
}

export const automationService = {
  async getWorkflows(): Promise<Workflow[]> {
    return loadWorkflows();
  },

  async runWorkflow(
    workflowId: string,
    options?: RunWorkflowOptions,
  ): Promise<{ runId: string; steps: { action: string; status: string }[] }> {
    const workflows = loadWorkflows();
    const normalizedWorkflowId = normalizeWorkflowId(workflowId);
    const workflow = workflows.find((w) => normalizeWorkflowId(w.id) === normalizedWorkflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const validated = persistedWorkflowSchema.safeParse(workflow);
    if (!validated.success) {
      throw new Error(`Workflow schema invalid: ${validated.error.issues[0]?.message || 'unknown error'}`);
    }

    const requirement = await automationService.getWorkflowPermissionRequirement(workflow);
    if (requirement) {
      throw new WorkflowPermissionError(requirement);
    }

    const runId = options?.runId || uuidv4();
    const results: { action: string; status: string }[] = [];

    const emitProgress = (
      status: WorkflowProgressStatus,
      stepIndex: number,
      step?: WorkflowStep,
      error?: string,
    ) => {
      options?.onProgress?.({
        runId,
        workflowId: workflow.id,
        workflowName: workflow.name,
        status,
        stepIndex,
        totalSteps: workflow.steps.length,
        step,
        error,
        timestamp: new Date().toISOString(),
      });
    };

    emitProgress('started', 0);

    for (const [index, step] of workflow.steps.entries()) {
      emitProgress('running', index, step);
      try {
        await automationService.executeStep(step);
        results.push({ action: step.action, status: 'success' });
        emitProgress('success', index, step);
        if (step.delay) {
          await new Promise((resolve) => setTimeout(resolve, step.delay));
        }
      } catch (err) {
        logger.error(`Workflow step failed: ${step.action}`, err);
        results.push({ action: step.action, status: 'failed' });
        emitProgress('failed', index, step, err instanceof Error ? err.message : String(err));
      }
    }

    emitProgress('completed', workflow.steps.length);
    return { runId, steps: results };
  },

  async getWorkflowPermissionRequirement(workflow: Workflow): Promise<WorkflowPermissionRequirement | null> {
    for (let stepIndex = 0; stepIndex < workflow.steps.length; stepIndex += 1) {
      const step = workflow.steps[stepIndex];
      const commandPattern = commandPatternFromStep(step);
      if (!commandPattern) continue;

      const tier = permissionService.getCommandTier(commandPattern);
      if (tier >= 5) {
        return {
          workflowId: workflow.id,
          workflowName: workflow.name,
          stepIndex,
          action: step.action,
          commandPattern,
          tier,
          prohibited: true,
          requiresApproval: false,
        };
      }

      if (tier >= 3) {
        const granted = await permissionService.isPermissionGranted(commandPattern);
        if (!granted) {
          return {
            workflowId: workflow.id,
            workflowName: workflow.name,
            stepIndex,
            action: step.action,
            commandPattern,
            tier,
            prohibited: false,
            requiresApproval: true,
          };
        }
      }
    }

    return null;
  },

  async executeStep(step: WorkflowStep): Promise<void> {
    const action = step.action;
    const target = getStepTarget(step);
    const url = getStepUrl(step);
    const command = getStepCommand(step);
    const args = getStepArgs(step);

    switch (action) {
      case 'open_app':
        if (!target) {
          throw new Error('Workflow step open_app requires a target or params.app');
        }
        await automationService.openApp(target);
        break;
      case 'switch_app':
        if (!target) {
          throw new Error('Workflow step switch_app requires a target or params.app');
        }
        await automationService.switchApp(target);
        break;
      case 'close_app':
        if (!target) {
          throw new Error('Workflow step close_app requires a target or params.app');
        }
        await automationService.closeApp(target);
        break;
      case 'open_browser':
      case 'open_url':
        if (!url) {
          throw new Error(`Workflow step ${action} requires a url`);
        }
        await automationService.openUrl(url);
        break;
      case 'run_command':
        if (!command) {
          throw new Error('Workflow step run_command requires cmd/command');
        }
        await automationService.executeCommand(command, args);
        break;
      default:
        throw new Error(`Unknown workflow step action: ${action}`);
    }
  },

  async executeCommand(command: string, args?: string[]): Promise<{ output: string }> {
    // Validate command against whitelist
    if (!commandValidator.isAllowed(command)) {
      throw new Error(`Command not allowed: ${command}`);
    }

    const parsed = parseAutomationCommand(command, args);

    switch (parsed.base) {
      case 'open_app': {
        if (!parsed.target) throw new Error('open_app requires an app name');
        await automationService.openApp(parsed.target);
        return { output: `Opened app: ${parsed.target}` };
      }
      case 'switch_app': {
        if (!parsed.target) throw new Error('switch_app requires an app name');
        await automationService.switchApp(parsed.target);
        return { output: `Switched app focus to: ${parsed.target}` };
      }
      case 'close_app': {
        if (!parsed.target) throw new Error('close_app requires an app name');
        await automationService.closeApp(parsed.target);
        return { output: `Closed app: ${parsed.target}` };
      }
      case 'open_url': {
        if (!parsed.target) throw new Error('open_url requires a URL');
        await automationService.openUrl(parsed.target);
        return { output: `Opened URL: ${parsed.target}` };
      }
      case 'create_folder': {
        if (!parsed.target) throw new Error('create_folder requires a path');
        const folderPath = ensureSafePath(parsed.target);
        fs.mkdirSync(folderPath, { recursive: true });
        return { output: `Created folder: ${folderPath}` };
      }
      case 'search_file': {
        if (!parsed.target) throw new Error('search_file requires a filename query');
        const matches = searchFiles(WORKSPACE_ROOT, parsed.target, 20);
        return {
          output: matches.length > 0
            ? `Found ${matches.length} file(s): ${matches.join(', ')}`
            : `No files found matching: ${parsed.target}`,
        };
      }
      case 'copy_file': {
        if (!parsed.target || !args?.[0]) {
          throw new Error('copy_file requires source in command target and destination as first arg');
        }
        const source = ensureSafePath(parsed.target);
        const destination = ensureSafePath(args[0]);
        fs.copyFileSync(source, destination);
        return { output: `Copied file: ${source} -> ${destination}` };
      }
      case 'move_file': {
        if (!parsed.target || !args?.[0]) {
          throw new Error('move_file requires source in command target and destination as first arg');
        }
        const source = ensureSafePath(parsed.target);
        const destination = ensureSafePath(args[0]);
        fs.renameSync(source, destination);
        return { output: `Moved file: ${source} -> ${destination}` };
      }
      case 'delete_file': {
        if (!parsed.target) throw new Error('delete_file requires a path');
        const targetPath = ensureSafePath(parsed.target);
        fs.rmSync(targetPath, { force: true, recursive: false });
        return { output: `Deleted file: ${targetPath}` };
      }
      case 'list_files': {
        if (!parsed.target) throw new Error('list_files requires a directory path');
        const dirPath = ensureSafePath(parsed.target);
        const entries = fs.readdirSync(dirPath, { withFileTypes: true })
          .slice(0, 100)
          .map((e) => `${e.isDirectory() ? '[D]' : '[F]'} ${e.name}`);
        return {
          output: entries.length > 0
            ? `Directory entries in ${dirPath}: ${entries.join(', ')}`
            : `Directory is empty: ${dirPath}`,
        };
      }
      case 'read_file': {
        if (!parsed.target) throw new Error('read_file requires a file path');
        const filePath = ensureSafePath(parsed.target);
        const content = fs.readFileSync(filePath, 'utf-8');
        const preview = content.length > 2000 ? `${content.slice(0, 2000)}...` : content;
        return { output: `File content (${filePath}): ${preview}` };
      }
      case 'write_file': {
        if (!parsed.target) throw new Error('write_file requires a file path');
        const filePath = ensureSafePath(parsed.target);
        const payload = args?.join(' ') ?? '';
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, payload, 'utf-8');
        return { output: `Wrote ${payload.length} chars to file: ${filePath}` };
      }
      case 'system_info': {
        const si = await import('systeminformation');
        const [osInfo, cpu, mem] = await Promise.all([si.osInfo(), si.cpu(), si.mem()]);
        return {
          output: `OS: ${osInfo.distro} ${osInfo.release}; CPU: ${cpu.manufacturer} ${cpu.brand}; RAM: ${Math.round(mem.total / 1024 / 1024 / 1024)} GB`,
        };
      }
      case 'get_cpu': {
        const si = await import('systeminformation');
        const cpu = await si.cpu();
        return { output: `CPU: ${cpu.manufacturer} ${cpu.brand} (${cpu.cores} cores)` };
      }
      case 'get_ram': {
        const si = await import('systeminformation');
        const mem = await si.mem();
        const totalGb = Math.round(mem.total / 1024 / 1024 / 1024);
        const freeGb = Math.round(mem.available / 1024 / 1024 / 1024);
        return { output: `RAM: ${freeGb} GB free / ${totalGb} GB total` };
      }
      case 'get_disk': {
        const si = await import('systeminformation');
        const fsInfo = await si.fsSize();
        const summary = fsInfo.slice(0, 3).map((d) => {
          const sizeGb = Math.round(d.size / 1024 / 1024 / 1024);
          const usedGb = Math.round(d.used / 1024 / 1024 / 1024);
          return `${d.mount}: ${usedGb}/${sizeGb} GB`;
        });
        return { output: `Disk usage: ${summary.join('; ')}` };
      }
      default:
        throw new Error(`Supported command not implemented: ${parsed.base}`);
    }
  },

  async openApp(appName: string): Promise<void> {
    const { spawn } = await import('child_process');
    const appMap: Record<string, string[]> = {
      vscode: ['code'],
      notepad: ['notepad'],
      explorer: ['explorer'],
      terminal: ['cmd'],
      chrome: ['chrome'],
      firefox: ['firefox'],
    };

    const normalized = appName.toLowerCase();
    const cmd = appMap[normalized];
    if (!cmd) {
      logger.warn(`Unknown app: ${appName}`);
      return;
    }

    return new Promise((resolve, reject) => {
      const child = spawn(cmd[0], cmd.slice(1), {
        detached: true,
        stdio: 'ignore',
        shell: process.platform === 'win32',
      });

      child.once('error', reject);
      child.once('spawn', () => {
        child.unref();
        resolve();
      });
    });
  },

  async openUrl(url: string): Promise<void> {
    // Validate URL is http/https only
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Only http/https URLs are allowed');
    }

    const { execFile } = await import('child_process');
    const cmd = process.platform === 'win32'
      ? { file: 'rundll32', args: ['url.dll,FileProtocolHandler', url] }
      : process.platform === 'darwin'
        ? { file: 'open', args: [url] }
        : { file: 'xdg-open', args: [url] };

    return new Promise((resolve, reject) => {
      execFile(cmd.file, cmd.args, { timeout: 5_000 }, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  async switchApp(appName: string): Promise<void> {
    // Cross-platform focus APIs are inconsistent; opening the app is a pragmatic way to foreground it.
    await automationService.openApp(appName);
  },

  async closeApp(appName: string): Promise<void> {
    const normalized = appName.toLowerCase();
    const { execFile } = await import('child_process');

    const appMap: Record<string, string> = process.platform === 'win32'
      ? {
        vscode: 'Code.exe',
        notepad: 'notepad.exe',
        explorer: 'explorer.exe',
        terminal: 'cmd.exe',
        chrome: 'chrome.exe',
        firefox: 'firefox.exe',
      }
      : {
        vscode: 'code',
        notepad: 'gedit',
        explorer: 'nautilus',
        terminal: 'terminal',
        chrome: 'chrome',
        firefox: 'firefox',
      };

    const processName = appMap[normalized];
    if (!processName) {
      throw new Error(`Unknown app: ${appName}`);
    }

    const cmd = process.platform === 'win32'
      ? { file: 'taskkill', args: ['/IM', processName, '/F'] }
      : { file: 'pkill', args: ['-f', processName] };

    return new Promise((resolve, reject) => {
      execFile(cmd.file, cmd.args, { timeout: 10_000 }, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  async saveWorkflow(workflow: Omit<Workflow, 'id'>): Promise<Workflow> {
    const parsed = workflowInputSchema.safeParse(workflow);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message || 'Invalid workflow schema');
    }

    const workflows = loadUserWorkflowsOnly();

    const newWorkflow: Workflow = { id: uuidv4(), ...parsed.data };
    workflows.push(newWorkflow);
    saveUserWorkflows(workflows);
    return newWorkflow;
  },

  async deleteWorkflow(id: string): Promise<void> {
    if (!fs.existsSync(WORKFLOWS_PATH)) return;
    const workflows = loadUserWorkflowsOnly();
    const filtered = workflows.filter((w) => w.id !== id);
    saveUserWorkflows(filtered);
  },

  async updateWorkflow(id: string, updates: Omit<Workflow, 'id'>): Promise<Workflow> {
    const parsed = workflowInputSchema.safeParse(updates);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message || 'Invalid workflow schema');
    }

    if (!fs.existsSync(WORKFLOWS_PATH)) {
      throw new Error(`Workflow ${id} not found`);
    }
    const workflows = loadUserWorkflowsOnly();
    const index = workflows.findIndex((w) => w.id === id);
    if (index === -1) throw new Error(`Workflow ${id} not found`);

    const updated: Workflow = { id, ...parsed.data };
    workflows[index] = updated;
    saveUserWorkflows(workflows);
    return updated;
  },
};
