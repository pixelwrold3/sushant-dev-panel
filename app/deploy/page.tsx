'use client';

import React, { useState, useEffect } from 'react';
import {
  Rocket,
  CheckCircle2,
  Clock,
  AlertTriangle,
  GitBranch,
  RefreshCw,
  FolderGit2,
  Server,
  ArrowRight,
  Terminal,
} from 'lucide-react';

export default function DeployPage() {
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState('diet-ghazipur');
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<any>(null);
  const [pipelineSteps, setPipelineSteps] = useState<any[]>([
    { name: 'Git pull', status: 'pending' },
    { name: 'Dependencies', status: 'pending' },
    { name: 'Build', status: 'pending' },
    { name: 'Health check', status: 'pending' },
    { name: 'Deployment', status: 'pending' },
  ]);

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((d) => {
        if (d.projects) {
          setWorkspaces(d.workspaces);
          if (d.workspaces.length > 0) {
            setSelectedWorkspace(d.workspaces[0].id);
            setSelectedBranch(d.workspaces[0].branch || 'main');
          }
        }
      });
  }, []);

  const handleStartDeploy = async () => {
    setDeploying(true);
    setDeployResult(null);

    // Initial step running
    setPipelineSteps([
      { name: 'Git pull', status: 'running' },
      { name: 'Dependencies', status: 'pending' },
      { name: 'Build', status: 'pending' },
      { name: 'Health check', status: 'pending' },
      { name: 'Deployment', status: 'pending' },
    ]);

    try {
      const res = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: selectedWorkspace,
          branch: selectedBranch,
        }),
      });

      const data = await res.json();
      if (data.steps) {
        setPipelineSteps(data.steps);
      }
      setDeployResult(data);
    } catch (err: any) {
      setDeployResult({ success: false, error: err.message });
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e293b] pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Deployment &amp; Release Pipeline
            <Rocket className="w-5 h-5 text-purple-400" />
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Automated production build, dependency verification, zero-downtime health check, and live rollout.
          </p>
        </div>
      </div>

      {/* Deployment Trigger Card */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Target Environment &amp; Repository</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Target Project</label>
            <select
              value={selectedWorkspace}
              onChange={(e) => setSelectedWorkspace(e.target.value)}
              className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-gray-200"
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.id})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Branch</label>
            <input
              type="text"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-gray-200 font-mono"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleStartDeploy}
              disabled={deploying}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-lg shadow-purple-600/20 transition-colors"
            >
              <Rocket className="w-4 h-4" />
              {deploying ? 'Deploying Pipeline...' : 'Deploy to Production'}
            </button>
          </div>
        </div>
      </div>

      {/* Step Pipeline Visualization */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Pipeline Execution Stages</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {pipelineSteps.map((step, idx) => (
            <div
              key={step.name}
              className={`p-4 rounded-xl border flex flex-col justify-between transition-colors ${step.status === 'success'
                  ? 'bg-emerald-950/20 border-emerald-500/30'
                  : step.status === 'running'
                    ? 'bg-blue-950/20 border-blue-500/40 animate-pulse'
                    : step.status === 'failed'
                      ? 'bg-rose-950/20 border-rose-500/30'
                      : 'bg-[#090d16] border-[#1e293b]'
                }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-gray-500">Stage {idx + 1}</span>
                {step.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                {step.status === 'running' && <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />}
                {step.status === 'failed' && <AlertTriangle className="w-4 h-4 text-rose-400" />}
                {step.status === 'pending' && <Clock className="w-4 h-4 text-gray-600" />}
              </div>
              <div className="text-sm font-semibold text-white">{step.name}</div>
              <div className="text-[11px] text-gray-400 mt-2 truncate">
                {step.message || (step.status === 'running' ? 'Executing...' : 'Waiting')}
              </div>
            </div>
          ))}
        </div>

        {/* Deploy Result Summary */}
        {deployResult && (
          <div
            className={`mt-5 p-4 rounded-xl border text-xs ${deployResult.success
                ? 'bg-emerald-900/20 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-900/20 border-rose-500/40 text-rose-200'
              }`}
          >
            <div className="font-semibold text-sm flex items-center gap-2 mb-1">
              {deployResult.success ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Deployment Successful &bull; Live in Production
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  Deployment Failed
                </>
              )}
            </div>
            {deployResult.success ? (
              <div className="text-gray-300 space-y-1 mt-2 font-mono">
                <div>Deployed Version: {deployResult.version}</div>
                <div>Completed At: {new Date(deployResult.deployedAt).toLocaleString()}</div>
                <div>Application Endpoints: Healthy (0 errors, 200 OK)</div>
              </div>
            ) : (
              <div className="text-rose-300 mt-2 font-mono">Reason: {deployResult.error}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

