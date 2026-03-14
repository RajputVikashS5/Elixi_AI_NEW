import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Plus, ListChecks, FileStack, History, Trash2, X, Download } from 'lucide-react';
import { WorkflowCard } from '../components/automation/WorkflowCard';
import { PermissionDialog } from '../components/automation/PermissionDialog';
import {
  automationService,
  AuditLogEntry,
  AutomationPermissionResponse,
  Workflow,
  WorkflowStep,
} from '../services/automationService';
import { Button } from '../components/ui/Button';

type AutomationTab = 'workflows' | 'builder' | 'audit';
type AuditStatusFilter = 'all' | 'approved' | 'denied' | 'blocked';

const EMPTY_STEP: WorkflowStep = {
  action: 'open_app',
  target: '',
  delay: 0,
};

const AutomationPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AutomationTab>('workflows');
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingWorkflow, setSavingWorkflow] = useState(false);

  // Builder form state
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [newWorkflowDescription, setNewWorkflowDescription] = useState('');
  const [newWorkflowSteps, setNewWorkflowSteps] = useState<WorkflowStep[]>([{ ...EMPTY_STEP }]);
  // per-step arg input values (for the "add arg" text input)
  const [stepArgInputs, setStepArgInputs] = useState<string[]>(['']);

  // Audit filter state
  const [auditStatusFilter, setAuditStatusFilter] = useState<AuditStatusFilter>('all');
  const [auditSearch, setAuditSearch] = useState('');

  // Permission dialog state
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [pendingPermission, setPendingPermission] = useState<AutomationPermissionResponse | null>(null);
  const [pendingWorkflowId, setPendingWorkflowId] = useState<string | null>(null);

  const loadWorkflows = useCallback(async () => {
    const data = await automationService.getWorkflows();
    setWorkflows(data);
  }, []);

  const loadAuditLogs = useCallback(async () => {
    const logs = await automationService.getAuditLogs(200);
    setAuditLogs(logs);
  }, []);

  const permissionPreview = useMemo(() => {
    if (!pendingPermission) return '';
    const stepInfo = pendingPermission.stepIndex !== undefined ? `step ${pendingPermission.stepIndex + 1}` : 'action';
    return `${pendingPermission.commandPattern} (${stepInfo}, tier ${pendingPermission.tier})`;
  }, [pendingPermission]);

  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((e) => {
      if (auditStatusFilter !== 'all' && e.status !== auditStatusFilter) return false;
      if (auditSearch && !e.command.toLowerCase().includes(auditSearch.toLowerCase())) return false;
      return true;
    });
  }, [auditLogs, auditStatusFilter, auditSearch]);

  useEffect(() => {
    loadWorkflows()
      .catch(() => setError('Could not load workflows. Is the backend running?'));
  }, [loadWorkflows]);

  useEffect(() => {
    if (activeTab !== 'audit') return;
    loadAuditLogs().catch(() => setError('Could not load audit logs.'));
  }, [activeTab, loadAuditLogs]);

  const extractPermissionRequirement = (err: unknown): AutomationPermissionResponse | null => {
    if (!axios.isAxiosError(err)) return null;
    const payload = err.response?.data as AutomationPermissionResponse | undefined;
    if (!payload) return null;
    if (payload.requiresApproval || payload.prohibited) return payload;
    return null;
  };

  const handleRun = async (id: string) => {
    setError(null);
    setRunningId(id);
    try {
      await automationService.runWorkflow(id);
      if (activeTab === 'audit') {
        await loadAuditLogs();
      }
    } catch (err) {
      const permission = extractPermissionRequirement(err);
      if (permission) {
        setPendingPermission(permission);
        setPendingWorkflowId(id);
        setPermissionDialogOpen(true);
      } else {
        setError(`Failed to run workflow: ${id}`);
      }
    } finally {
      setRunningId(null);
    }
  };

  const handleDeleteWorkflow = async (id: string) => {
    setError(null);
    try {
      await automationService.deleteWorkflow(id);
      await loadWorkflows();
    } catch {
      setError('Failed to delete workflow.');
    }
  };

  const handleEditWorkflow = (workflow: Workflow) => {
    setEditingWorkflowId(workflow.id);
    setNewWorkflowName(workflow.name);
    setNewWorkflowDescription(workflow.description ?? '');
    setNewWorkflowSteps(workflow.steps.map((s) => ({ ...s })));
    setStepArgInputs(workflow.steps.map(() => ''));
    setError(null);
    setActiveTab('builder');
  };

  const resetBuilder = () => {
    setEditingWorkflowId(null);
    setNewWorkflowName('');
    setNewWorkflowDescription('');
    setNewWorkflowSteps([{ ...EMPTY_STEP }]);
    setStepArgInputs(['']);
  };

  const addStep = () => {
    setNewWorkflowSteps((prev) => [...prev, { ...EMPTY_STEP }]);
    setStepArgInputs((prev) => [...prev, '']);
  };

  const updateStep = (index: number, patch: Partial<WorkflowStep>) => {
    setNewWorkflowSteps((prev) => prev.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  };

  const removeStep = (index: number) => {
    if (newWorkflowSteps.length <= 1) return;
    setNewWorkflowSteps((prev) => prev.filter((_, i) => i !== index));
    setStepArgInputs((prev) => prev.filter((_, i) => i !== index));
  };

  const addArg = (stepIndex: number) => {
    const value = stepArgInputs[stepIndex]?.trim();
    if (!value) return;
    updateStep(stepIndex, { args: [...(newWorkflowSteps[stepIndex].args ?? []), value] });
    setStepArgInputs((prev) => prev.map((v, i) => (i === stepIndex ? '' : v)));
  };

  const removeArg = (stepIndex: number, argIndex: number) => {
    const current = newWorkflowSteps[stepIndex].args ?? [];
    updateStep(stepIndex, { args: current.filter((_, i) => i !== argIndex) });
  };

  const handleSaveWorkflow = async () => {
    if (!newWorkflowName.trim()) {
      setError('Workflow name is required.');
      return;
    }

    const payload = {
      name: newWorkflowName.trim(),
      description: newWorkflowDescription.trim() || undefined,
      steps: newWorkflowSteps.map((s) => ({
        action: s.action,
        target: s.target?.trim() || undefined,
        url: s.url?.trim() || undefined,
        cmd: s.cmd?.trim() || undefined,
        args: s.args && s.args.length > 0 ? s.args : undefined,
        delay: s.delay && s.delay > 0 ? s.delay : undefined,
      })),
    };

    setSavingWorkflow(true);
    setError(null);
    try {
      if (editingWorkflowId) {
        await automationService.updateWorkflow(editingWorkflowId, payload);
      } else {
        await automationService.saveWorkflow(payload);
      }
      await loadWorkflows();
      resetBuilder();
      setActiveTab('workflows');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const apiError = (err.response?.data as { error?: string } | undefined)?.error;
        setError(apiError || 'Failed to save workflow.');
      } else {
        setError('Failed to save workflow.');
      }
    } finally {
      setSavingWorkflow(false);
    }
  };

  const handleApprovePermission = async () => {
    if (!pendingPermission) return;
    try {
      await automationService.requestPermission(pendingPermission.commandPattern, pendingPermission.tier);
      setPermissionDialogOpen(false);
      const workflowId = pendingWorkflowId;
      setPendingPermission(null);
      setPendingWorkflowId(null);
      if (workflowId) {
        await handleRun(workflowId);
      }
    } catch {
      setError('Permission approval failed.');
    }
  };

  const handleDenyPermission = () => {
    setPermissionDialogOpen(false);
    setPendingPermission(null);
    setPendingWorkflowId(null);
    setError('Workflow run canceled due to missing permission approval.');
  };

  const exportAuditCsv = () => {
    const header = 'timestamp,command,action,tier,status\n';
    const rows = filteredAuditLogs.map((e) =>
      [e.timestamp, `"${e.command}"`, e.action, e.permission_tier, e.status].join(',')
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `elixi-audit-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-elixi-text">Automation</h1>
          <p className="text-sm text-elixi-muted mt-0.5">Run workflows, build new automations, and review audit trails</p>
        </div>
        <Button size="sm" onClick={() => { resetBuilder(); setActiveTab('builder'); }}>
          <Plus size={14} />
          New Workflow
        </Button>
      </div>

      <div className="flex gap-2">
        <Button variant={activeTab === 'workflows' ? 'primary' : 'secondary'} size="sm" onClick={() => setActiveTab('workflows')}>
          <ListChecks size={14} />
          Workflows
        </Button>
        <Button variant={activeTab === 'builder' ? 'primary' : 'secondary'} size="sm" onClick={() => { resetBuilder(); setActiveTab('builder'); }}>
          <FileStack size={14} />
          Builder
        </Button>
        <Button variant={activeTab === 'audit' ? 'primary' : 'secondary'} size="sm" onClick={() => setActiveTab('audit')}>
          <History size={14} />
          Audit
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* ── Workflows tab ── */}
      {activeTab === 'workflows' && (
        workflows.length === 0 && !error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-elixi-muted text-sm">No workflows yet.</p>
            <p className="text-elixi-muted/60 text-xs mt-1">Switch to Builder to create your first workflow.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {workflows.map((wf) => (
              <WorkflowCard
                key={wf.id}
                workflow={wf}
                onRun={handleRun}
                onEdit={handleEditWorkflow}
                onDelete={handleDeleteWorkflow}
                isRunning={runningId === wf.id}
              />
            ))}
          </div>
        )
      )}

      {/* ── Builder tab ── */}
      {activeTab === 'builder' && (
        <div className="bg-elixi-surface border border-elixi-border rounded-card p-4 space-y-4">
          {editingWorkflowId && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-elixi-primary font-medium">Editing existing workflow</p>
              <button type="button" onClick={resetBuilder} className="text-xs text-elixi-muted hover:text-elixi-text">
                Cancel edit
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-elixi-muted">Workflow Name</label>
              <input
                type="text"
                value={newWorkflowName}
                onChange={(e) => setNewWorkflowName(e.target.value)}
                placeholder="Morning setup"
                className="mt-1 w-full bg-elixi-bg border border-elixi-border rounded-lg px-3 py-2 text-sm text-elixi-text outline-none focus:border-elixi-primary/50"
              />
            </div>
            <div>
              <label className="text-xs text-elixi-muted">Description</label>
              <input
                type="text"
                value={newWorkflowDescription}
                onChange={(e) => setNewWorkflowDescription(e.target.value)}
                placeholder="Start coding tools and dashboard"
                className="mt-1 w-full bg-elixi-bg border border-elixi-border rounded-lg px-3 py-2 text-sm text-elixi-text outline-none focus:border-elixi-primary/50"
              />
            </div>
          </div>

          <div className="space-y-3">
            {newWorkflowSteps.map((step, index) => (
              <div key={`builder-step-${index}`} className="p-3 rounded-lg bg-elixi-bg border border-elixi-border space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-wide text-elixi-muted">Step {index + 1}</p>
                  <button
                    type="button"
                    onClick={() => removeStep(index)}
                    className="text-elixi-muted hover:text-red-400"
                    title="Remove step"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <select
                    value={step.action}
                    onChange={(e) => updateStep(index, { action: e.target.value })}
                    className="bg-elixi-surface border border-elixi-border rounded-lg px-2 py-1.5 text-xs text-elixi-text outline-none"
                  >
                    <option value="open_app">open_app</option>
                    <option value="switch_app">switch_app</option>
                    <option value="close_app">close_app</option>
                    <option value="open_url">open_url</option>
                    <option value="run_command">run_command</option>
                  </select>

                  {(step.action === 'open_app' || step.action === 'switch_app' || step.action === 'close_app') && (
                    <input
                      type="text"
                      value={step.target || ''}
                      onChange={(e) => updateStep(index, { target: e.target.value })}
                      placeholder="vscode"
                      className="col-span-2 bg-elixi-surface border border-elixi-border rounded-lg px-2 py-1.5 text-xs text-elixi-text outline-none"
                    />
                  )}

                  {step.action === 'open_url' && (
                    <input
                      type="text"
                      value={step.url || ''}
                      onChange={(e) => updateStep(index, { url: e.target.value })}
                      placeholder="https://calendar.google.com"
                      className="col-span-2 bg-elixi-surface border border-elixi-border rounded-lg px-2 py-1.5 text-xs text-elixi-text outline-none"
                    />
                  )}

                  {step.action === 'run_command' && (
                    <input
                      type="text"
                      value={step.cmd || ''}
                      onChange={(e) => updateStep(index, { cmd: e.target.value })}
                      placeholder="search_file:README"
                      className="col-span-2 bg-elixi-surface border border-elixi-border rounded-lg px-2 py-1.5 text-xs text-elixi-text outline-none"
                    />
                  )}

                  <input
                    type="number"
                    min={0}
                    value={step.delay || 0}
                    onChange={(e) => updateStep(index, { delay: Number(e.target.value) || 0 })}
                    placeholder="delay ms"
                    className="bg-elixi-surface border border-elixi-border rounded-lg px-2 py-1.5 text-xs text-elixi-text outline-none"
                  />
                </div>

                {/* Args editor for run_command */}
                {step.action === 'run_command' && (
                  <div className="space-y-1.5">
                    {(step.args ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {(step.args ?? []).map((arg, argIdx) => (
                          <span
                            key={argIdx}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-elixi-primary/10 border border-elixi-primary/20 text-xs text-elixi-primary"
                          >
                            {arg}
                            <button
                              type="button"
                              onClick={() => removeArg(index, argIdx)}
                              className="text-elixi-primary/60 hover:text-red-400"
                            >
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={stepArgInputs[index] ?? ''}
                        onChange={(e) => setStepArgInputs((prev) => prev.map((v, i) => (i === index ? e.target.value : v)))}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addArg(index); } }}
                        placeholder="Add argument, press Enter"
                        className="flex-1 bg-elixi-surface border border-elixi-border rounded-lg px-2 py-1 text-xs text-elixi-text outline-none focus:border-elixi-primary/50"
                      />
                      <button
                        type="button"
                        onClick={() => addArg(index)}
                        className="px-2 py-1 text-xs rounded-lg bg-elixi-primary/10 border border-elixi-primary/20 text-elixi-primary hover:bg-elixi-primary/20"
                      >
                        <Plus size={11} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={addStep}>
              <Plus size={12} />
              Add Step
            </Button>
            <Button size="sm" onClick={handleSaveWorkflow} loading={savingWorkflow}>
              {editingWorkflowId ? 'Update Workflow' : 'Save Workflow'}
            </Button>
          </div>
        </div>
      )}

      {/* ── Audit tab ── */}
      {activeTab === 'audit' && (
        <div className="space-y-3">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              {(['all', 'approved', 'denied', 'blocked'] as AuditStatusFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setAuditStatusFilter(f)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                    auditStatusFilter === f
                      ? 'bg-elixi-primary/20 border-elixi-primary/40 text-elixi-primary'
                      : 'bg-elixi-surface border-elixi-border text-elixi-muted hover:text-elixi-text'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              placeholder="Search command..."
              className="flex-1 min-w-32 bg-elixi-surface border border-elixi-border rounded-lg px-3 py-1 text-xs text-elixi-text outline-none focus:border-elixi-primary/50"
            />
            <button
              type="button"
              onClick={exportAuditCsv}
              disabled={filteredAuditLogs.length === 0}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg border border-elixi-border bg-elixi-surface text-elixi-muted hover:text-elixi-text disabled:opacity-40"
              title="Export as CSV"
            >
              <Download size={12} />
              CSV
            </button>
          </div>

          {filteredAuditLogs.length === 0 ? (
            <div className="p-4 rounded-card bg-elixi-surface border border-elixi-border text-sm text-elixi-muted">
              {auditLogs.length === 0 ? 'No audit logs yet.' : 'No results match the current filter.'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAuditLogs.map((entry) => (
                <div key={entry.id} className="p-3 rounded-lg bg-elixi-surface border border-elixi-border flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-elixi-text">{entry.command}</p>
                    <p className="text-xs text-elixi-muted">{new Date(entry.timestamp).toLocaleString()} · tier {entry.permission_tier}</p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-md border ${
                      entry.status === 'approved'
                        ? 'text-green-400 border-green-500/30 bg-green-500/10'
                        : entry.status === 'denied'
                          ? 'text-yellow-300 border-yellow-500/30 bg-yellow-500/10'
                          : 'text-red-400 border-red-500/30 bg-red-500/10'
                    }`}
                  >
                    {entry.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <PermissionDialog
        isOpen={permissionDialogOpen}
        onClose={() => {
          setPermissionDialogOpen(false);
          setPendingPermission(null);
          setPendingWorkflowId(null);
        }}
        onApprove={handleApprovePermission}
        onDeny={handleDenyPermission}
        command={pendingPermission?.commandPattern || 'unknown'}
        tier={pendingPermission?.tier || 3}
        preview={permissionPreview}
      />
    </div>
  );
};

export default AutomationPage;
