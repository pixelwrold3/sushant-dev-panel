'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  FolderGit2,
  FolderOpen,
  Plus,
  ArrowRight,
  GitBranch,
  Server,
  ArrowDown,
  ShieldCheck,
  Terminal,
  ExternalLink,
  Search,
  RefreshCw,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Database,
  Layers,
  Sparkles,
} from 'lucide-react';

export default function WorkspacesPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [connectModal, setConnectModal] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Safe Pull Modal state
  const [pullTarget, setPullTarget] = useState<string | null>(null);
  const [protectEnv, setProtectEnv] = useState(true);

  // New project state
  const [newProject, setNewProject] = useState({
    name: '',
    path: '/var/www/',
    type: 'connected',
    repoUrl: '',
    branch: 'main',
    runtime: 'Node.js',
  });

  const loadProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.projects) {
        setProjects(data.projects);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleLaunchEditor = (projectId: string) => {
    router.push(`/editor?projectId=${encodeURIComponent(projectId)}`);
  };

  const handleConnectProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name) return;
    setActionMessage('Connecting workspace project...');

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProject),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage('Workspace connected successfully!');
        setConnectModal(false);
        setNewProject({
          name: '',
          path: '/var/www/',
          type: 'connected',
          repoUrl: '',
          branch: 'main',
          runtime: 'Node.js',
        });
        loadProjects();
      } else {
        setActionMessage(`Error: ${data.error || 'Failed to connect'}`);
      }
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`);
    }
    setTimeout(() => setActionMessage(null), 4000);
  };

  const handleExecutePull = async () => {
    if (!pullTarget) return;
    const wsId = pullTarget;
    setPullTarget(null);
    setActionMessage(`Executing safe pull on ${wsId}...`);

    try {
      const res = await fetch('/api/git/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: wsId,
          action: 'pull',
          protectEnv,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage(`Git pull succeeded! (.env protected: ${data.pullResult?.envProtected ? 'Yes' : 'No'})`);
        loadProjects();
      } else {
        setActionMessage(`Pull failed: ${data.error}`);
      }
    } catch (err: any) {
      setActionMessage(`Pull error: ${err.message}`);
    }
    setTimeout(() => setActionMessage(null), 5000);
  };

  const filteredProjects = projects.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.id?.toLowerCase().includes(q) ||
      p.path?.toLowerCase().includes(q) ||
      p.repoUrl?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e293b] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400">
              <Layers className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Workspaces &amp; Connected Projects
            </h1>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Choose a workspace to open the full-featured VS Code editor, manage source code, terminal, and git controls.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => loadProjects()}
            className="p-2 bg-[#0f172a] hover:bg-[#1e293b] border border-[#1e293b] text-gray-400 hover:text-white rounded-lg transition-colors"
            title="Refresh workspaces"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setConnectModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors shadow-lg shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" />
            Connect / New Workspace
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="px-4 py-3 rounded-lg bg-blue-900/30 border border-blue-500/40 text-blue-200 text-xs flex items-center justify-between animate-in fade-in">
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Zero Database Touch Safety Alert */}
      <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3 px-4 flex items-center justify-between text-xs text-emerald-300">
        <div className="flex items-center gap-2.5">
          <Database className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong>Isolated Project Execution:</strong> DevPanel manages strictly code files. Your target website database (<code className="bg-black/30 px-1 py-0.5 rounded font-mono">diet_ghazipur</code>) is completely untouched.
          </span>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
          <ShieldCheck className="w-3.5 h-3.5" /> Isolated
        </span>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search workspaces by name, path or repo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0f172a] border border-[#1e293b] rounded-lg pl-9 pr-4 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <span className="text-xs text-gray-400 font-mono">
          Showing {filteredProjects.length} workspace{filteredProjects.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Workspaces Grid */}
      {loading ? (
        <div className="py-20 text-center text-xs text-gray-500">Loading workspaces...</div>
      ) : filteredProjects.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-[#1e293b] rounded-xl bg-[#0f172a]/40">
          <FolderGit2 className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-300">No workspaces match your query</p>
          <p className="text-xs text-gray-500 mt-1">Connect an existing folder or create a new workspace.</p>
          <button
            onClick={() => setConnectModal(true)}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Connect Workspace
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((project) => {
            const isDiet = project.id === 'diet-ghazipur';
            const isConnected = project.type === 'connected';

            return (
              <div
                key={project.id}
                className="bg-[#0f172a] border border-[#1e293b] hover:border-blue-500/50 rounded-xl p-5 flex flex-col justify-between transition-all duration-200 hover:shadow-xl hover:shadow-blue-500/5 group"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                        <FolderOpen className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <h3 className="text-sm font-semibold text-white truncate group-hover:text-blue-400 transition-colors">
                          {project.name || project.id}
                        </h3>
                        <span className="text-[10px] text-gray-500 font-mono">ID: {project.id}</span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border shrink-0 ${
                        isConnected
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                      }`}
                    >
                      {isConnected ? 'Server Connected' : 'Sandbox'}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="bg-[#090d16] border border-[#1e293b] rounded-lg p-3 space-y-2 text-xs font-mono my-3">
                    <div className="flex items-center justify-between text-gray-400">
                      <span className="text-gray-500">Path:</span>
                      <span className="text-gray-300 truncate max-w-[200px]" title={project.path}>
                        {project.path}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-gray-400">
                      <span className="text-gray-500">Branch:</span>
                      <span className="flex items-center gap-1 text-emerald-400">
                        <GitBranch className="w-3 h-3" />
                        {project.branch || 'main'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-gray-400">
                      <span className="text-gray-500">Remote:</span>
                      {project.repoUrl ? (
                        <span
                          className="text-blue-400 truncate max-w-[180px] hover:underline flex items-center gap-1"
                          title={project.repoUrl}
                        >
                          {project.repoUrl.replace('https://github.com/', 'gh:')}
                        </span>
                      ) : (
                        <span className="text-gray-600 italic">Not set</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="space-y-2 pt-2 border-t border-[#1e293b]">
                  <button
                    onClick={() => handleLaunchEditor(project.id)}
                    className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors flex items-center justify-center gap-2 shadow-md shadow-blue-600/20"
                  >
                    <FileCode className="w-4 h-4" />
                    Open in Code Editor
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setPullTarget(project.id)}
                      className="py-1.5 px-2 rounded-lg bg-[#131e36] hover:bg-[#1e293b] border border-[#1e293b] text-xs text-gray-300 hover:text-white transition-colors flex items-center justify-center gap-1.5 font-medium"
                      title="Safe Git Pull with .env protection"
                    >
                      <ArrowDown className="w-3.5 h-3.5 text-blue-400" /> Safe Pull
                    </button>
                    <button
                      onClick={() => router.push(`/editor?projectId=${encodeURIComponent(project.id)}&focus=terminal`)}
                      className="py-1.5 px-2 rounded-lg bg-[#131e36] hover:bg-[#1e293b] border border-[#1e293b] text-xs text-gray-300 hover:text-white transition-colors flex items-center justify-center gap-1.5 font-medium"
                    >
                      <Terminal className="w-3.5 h-3.5 text-emerald-400" /> Terminal
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Safe Pull Confirmation Modal */}
      {pullTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#0f172a] border border-[#1e293b] rounded-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-blue-950/50 border border-blue-500/30 text-blue-400">
                <ArrowDown className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-white">Safe Git Pull</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Are you sure you want to pull remote changes into <strong className="text-emerald-400 font-mono">{pullTarget}</strong>?
                </p>
              </div>
            </div>

            <div className="bg-[#090d16] border border-[#1e293b] rounded-lg p-3 space-y-2.5 text-xs">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={protectEnv}
                  onChange={(e) => setProtectEnv(e.target.checked)}
                  className="mt-0.5 rounded bg-[#1e293b] border-gray-600 text-blue-600 focus:ring-0 focus:ring-offset-0"
                />
                <div className="flex-1">
                  <span className="font-medium text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Protect .env configuration files (Never overwrite with remote changes)
                  </span>
                  <p className="text-gray-400 text-[11px] mt-0.5">
                    DevPanel automatically backs up local <code className="text-amber-300">.env</code> and{' '}
                    <code className="text-amber-300">.env.production</code> before pulling and restores them immediately.
                  </p>
                </div>
              </label>

              <div className="pt-2 border-t border-[#1e293b] flex items-center gap-2 text-emerald-300 text-[11px]">
                <Database className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Zero Database Touch: Website database (diet_ghazipur) is completely safe.</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPullTarget(null)}
                className="px-4 py-2 rounded-lg bg-[#1e293b] hover:bg-[#283548] text-gray-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecutePull}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5"
              >
                <ArrowDown className="w-3.5 h-3.5" /> Execute Safe Pull
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connect Project Modal */}
      {connectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#0f172a] border border-[#1e293b] rounded-xl shadow-2xl p-6">
            <h3 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
              <FolderGit2 className="w-5 h-5 text-blue-400" />
              Connect or Create Workspace Project
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Link an existing server directory or set up a new sandboxed repository workspace.
            </p>

            <form onSubmit={handleConnectProject} className="space-y-4">
              <div>
                <label className="text-xs text-gray-300 font-medium block mb-1">Project Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Diet Ghazipur Portal"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs text-gray-300 font-medium block mb-1">Workspace Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewProject({ ...newProject, type: 'connected', path: '/var/www/' })}
                    className={`p-2.5 rounded-lg border text-xs text-left transition-colors ${
                      newProject.type === 'connected'
                        ? 'border-blue-500 bg-blue-950/20 text-white'
                        : 'border-[#1e293b] bg-[#090d16] text-gray-400'
                    }`}
                  >
                    <div className="font-medium text-white mb-0.5">Connected Path</div>
                    <div className="text-[10px] text-gray-500">Live directory on the VPS (e.g. /var/www/...)</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewProject({ ...newProject, type: 'sandbox', path: './workspaces/' })}
                    className={`p-2.5 rounded-lg border text-xs text-left transition-colors ${
                      newProject.type === 'sandbox'
                        ? 'border-blue-500 bg-blue-950/20 text-white'
                        : 'border-[#1e293b] bg-[#090d16] text-gray-400'
                    }`}
                  >
                    <div className="font-medium text-white mb-0.5">Isolated Sandbox</div>
                    <div className="text-[10px] text-gray-500">Self-contained workspace folder</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-300 font-medium block mb-1">Target Directory Path</label>
                <input
                  type="text"
                  required
                  value={newProject.path}
                  onChange={(e) => setNewProject({ ...newProject, path: e.target.value })}
                  className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs text-gray-300 font-medium block mb-1">Git Repository URL (Optional)</label>
                <input
                  type="text"
                  placeholder="https://github.com/username/repo.git"
                  value={newProject.repoUrl}
                  onChange={(e) => setNewProject({ ...newProject, repoUrl: e.target.value })}
                  className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1e293b]">
                <button
                  type="button"
                  onClick={() => setConnectModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#1e293b] hover:bg-[#283548] text-gray-300 text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Connect Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

