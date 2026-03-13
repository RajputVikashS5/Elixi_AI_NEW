import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { commandValidator } from '../utils/commandValidator';
import { logger } from '../utils/logger';

const WORKFLOWS_PATH = path.join(process.cwd(), '..', 'config', 'workflows.json');
const BUILT_IN_WORKFLOWS_DIR = path.join(process.cwd(), '..', 'automation', 'workflows');
const WORKSPACE_ROOT = path.resolve(process.cwd(), '..');
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
        workflows.push(JSON.parse(content) as Workflow);
      } catch {
        // Skip malformed workflow files
      }
    }
  }

  // Load user-saved workflows
  if (fs.existsSync(WORKFLOWS_PATH)) {
    try {
      const content = fs.readFileSync(WORKFLOWS_PATH, 'utf-8');
      const userWorkflows = JSON.parse(content) as Workflow[];
      workflows.push(...userWorkflows);
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
  fs.writeFileSync(WORKFLOWS_PATH, JSON.stringify(workflows, null, 2), 'utf-8');
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
    const workflows = fs.existsSync(WORKFLOWS_PATH)
      ? JSON.parse(fs.readFileSync(WORKFLOWS_PATH, 'utf-8')) as Workflow[]
      : [];

    const newWorkflow: Workflow = { id: uuidv4(), ...workflow };
    workflows.push(newWorkflow);
    saveUserWorkflows(workflows);
    return newWorkflow;
  },

  async deleteWorkflow(id: string): Promise<void> {
    if (!fs.existsSync(WORKFLOWS_PATH)) return;
    const workflows = JSON.parse(fs.readFileSync(WORKFLOWS_PATH, 'utf-8')) as Workflow[];
    const filtered = workflows.filter((w) => w.id !== id);
    saveUserWorkflows(filtered);
  },
};
