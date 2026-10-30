'use client';

import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  GitCommit,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  FileDiff,
  FolderGit2,
  AlertCircle,
  RotateCcw,
  History,
  Shield,
  ShieldCheck,
  AlertTriangle,
  FileText,
  ChevronDown,
  ChevronRight,
  Database,
} from 'lucide-react';

export default function GitPage() {
  const [workspaceId, setWorkspaceId] = useState('diet-ghazipur');
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [gitStatus, setGitStatus] = useState<any>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [diffView, setDiffView] = useState<{ open: boolean; file?: string; content: string }>({
    open: false,
    content: '',
  });
  const [cloneUrl, setCloneUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Safe Pull & Rollback States
  const [pullConfirmOpen, setPullConfirmOpen] = useState(false);
  const [protectEnv, setProtectEnv] = useState(true);
  const [pullHistory, setPullHistory] = useState<any[]>([]);
  const [expandedPullFiles, setExpandedPullFiles] = useState<Record<string, boolean>>({});
  const [undoModal, setUndoModal] = useState<{
    open: boolean;
    pullId?: string;
    targetCommit?: string;
    description?: string;
  }>({ open: false });

  const loadPullHistory = async (ws: string) => {
    try {
      const res = await fetch('/api/git/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: ws, action: 'pull_history' }),
      });
      const data = await res.json();
      if (data.history) {
        setPullHistory(data.history);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadStatus = async (ws: string) => {
    try {
      const res = await fetch(`/api/git/status?workspaceId=${encodeURIComponent(ws)}`);
      const data = await res.json();
      setGitStatus(data);
      loadPullHistory(ws);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((d) => {
        if (d.projects) {
          setWorkspaces(d.workspaces || d.projects);
          const defaultId = (d.workspaces && d.workspaces[0]?.id) || (d.projects && d.projects[0]?.id) || 'diet-ghazipur';
          setWorkspaceId(defaultId);
          loadStatus(defaultId);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleAction = async (action: string, payload: any = {}) => {
    setActionMessage(`Executing git ${action}...`);
    try {
      const res = await fetch('/api/git/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          action,
          ...payload,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage(`Git ${action} succeeded.`);
        if (action === 'commit') setCommitMessage('');
        if (action === 'branch') setNewBranchName('');
        loadStatus(workspaceId);
      } else {
        setActionMessage(`Git error: ${data.error || 'Operation failed'}`);
      }
    } catch (err: any) {
      setActionMessage(`Git failed: ${err.message}`);
    }
    setTimeout(() => setActionMessage(null), 4500);
  };

  const handleConfirmPull = async () => {
    setPullConfirmOpen(false);
    await handleAction('pull', { protectEnv });
  };

  const handleConfirmUndo = async () => {
    const { pullId, targetCommit } = undoModal;
    setUndoModal({ open: false });
    await handleAction('undo_pull', { pullId, targetCommit });
  };

  const handleViewDiff = async (filePath?: string) => {
    try {
      const res = await fetch('/api/git/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, action: 'diff', filePath }),
      });
      const data = await res.json();
      setDiffView({
        open: true,
        file: filePath || 'All Changes',
        content: data.diff || '(No diff or untracked changes)',
      });
    } catch (err) {
      alert('Failed to load diff');
    }
  };

  const handleCloneRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloneUrl) return;
    setActionMessage('Cloning remote repository...');
    try {
      const res = await fetch('/api/git/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          action: 'clone',
          repoUrl: cloneUrl,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage('Repository cloned successfully!');
        setCloneUrl('');
        loadStatus(workspaceId);
      } else {
        setActionMessage(`Clone error: ${data.error}`);
      }
    } catch (err: any) {
      setActionMessage(`Clone failed: ${err.message}`);
    }
    setTimeout(() => setActionMessage(null), 5000);
  };

  const togglePullFiles = (id: string) => {
    setExpandedPullFiles((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const allFiles = gitStatus?.files || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1e293b] pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Git &amp; GitHub Source Control
            <GitBranch className="w-5 h-5 text-emerald-400" />
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Safe repository sync, pull protection, commit management, and one-click rollback.
          </p>
        </div>

        {/* Workspace select & Refresh */}
        <div className="flex items-center space-x-3">
          <select
            value={workspaceId}
            onChange={(e) => {
              setWorkspaceId(e.target.value);
              loadStatus(e.target.value);
            }}
            className="bg-[#0f172a] border border-[#1e293b] text-xs text-gray-200 rounded-lg px-3 py-2"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                Project: {w.name || w.id}
              </option>
            ))}
          </select>
          <button
            onClick={() => loadStatus(workspaceId)}
            className="p-2 bg-[#0f172a] hover:bg-[#1e293b] border border-[#1e293b] text-gray-400 hover:text-white rounded-lg transition-colors"
            title="Refresh Git Status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Safety Guarantee Banner */}
      <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3 px-4 flex items-center justify-between text-xs text-emerald-300">
        <div className="flex items-center gap-2.5">
          <Database className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong>Database Isolation Active:</strong> DevPanel never touches your website database (<code className="bg-black/30 px-1 py-0.5 rounded font-mono">diet_ghazipur</code>). Only tracked code files are synchronized.
          </span>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
          <ShieldCheck className="w-3.5 h-3.5" /> Protected
        </span>
      </div>

      {actionMessage && (
        <div className="px-4 py-3 rounded-lg bg-blue-900/30 border border-blue-500/40 text-blue-200 text-xs flex items-center justify-between">
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Row: Git Remote Connection / Clone Bar */}
      <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          <FolderGit2 className="w-4 h-4 text-blue-400" />
          Connect or Clone Git Repository
        </h2>
        <form onSubmit={handleCloneRepo} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="https://github.com/username/repository.git or git@github.com:..."
            value={cloneUrl}
            onChange={(e) => setCloneUrl(e.target.value)}
            className="flex-1 bg-[#090d16] border border-[#1e293b] rounded-lg px-3.5 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <FolderGit2 className="w-4 h-4" />
            Connect &amp; Clone
          </button>
        </form>
        {gitStatus?.remoteUrl && (
          <div className="mt-3 text-xs text-gray-400 flex items-center gap-2">
            <span>Connected Remote:</span>
            <span className="font-mono text-emerald-400">{gitStatus.remoteUrl}</span>
          </div>
        )}
      </div>

      {/* Main Git Grid: Left = Commit & Local Changes; Right = Branch, Pull History & Commits */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols): Commit & Changes */}
        <div className="lg:col-span-5 space-y-4">
          {/* Branch & Sync Bar */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <GitBranch className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-gray-300">Branch:</span>
                <span className="px-2 py-0.5 rounded text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {gitStatus?.currentBranch || 'main'}
                </span>
              </div>
              <div className="flex items-center space-x-2 text-xs font-mono text-gray-400">
                <span className="flex items-center gap-1" title="Commits ahead of remote">
                  <ArrowUp className="w-3.5 h-3.5 text-blue-400" /> {gitStatus?.ahead || 0}
                </span>
                <span className="flex items-center gap-1" title="Commits behind remote">
                  <ArrowDown className="w-3.5 h-3.5 text-amber-400" /> {gitStatus?.behind || 0}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPullConfirmOpen(true)}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#131e36] hover:bg-[#1e293b] border border-blue-500/30 text-xs text-blue-300 font-medium transition-colors shadow-sm"
              >
                <ArrowDown className="w-3.5 h-3.5 text-blue-400" /> Pull Changes...
              </button>
              <button
                onClick={() => handleAction('push')}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#131e36] hover:bg-[#1e293b] border border-emerald-500/30 text-xs text-emerald-300 font-medium transition-colors shadow-sm"
              >
                <ArrowUp className="w-3.5 h-3.5 text-emerald-400" /> Push Commits
              </button>
            </div>

            {/* Undo Last Pull Button */}
            <div className="mt-2.5 pt-2.5 border-t border-[#1e293b]">
              <button
                onClick={() =>
                  setUndoModal({
                    open: true,
                    pullId: gitStatus?.lastPull?.id,
                    targetCommit: gitStatus?.lastPull?.fromCommit,
                    description: `Undo recent pull and restore code back to commit ${
                      gitStatus?.lastPull?.fromCommit ? gitStatus.lastPull.fromCommit.slice(0, 7) : 'previous'
                    }`,
                  })
                }
                disabled={!gitStatus?.canUndoLastPull}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-amber-950/30 hover:bg-amber-900/40 border border-amber-600/40 disabled:opacity-40 disabled:cursor-not-allowed text-xs text-amber-300 font-medium transition-colors"
                title={gitStatus?.canUndoLastPull ? 'Revert to code state before the latest pull' : 'No active pull available to undo'}
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" /> Undo Last Pull
              </button>
              <p className="text-[10px] text-gray-500 mt-1 text-center">
                Instantly rolls back files to pre-pull state while safely preserving environment secrets.
              </p>
            </div>
          </div>

          {/* Commit Box */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Commit Changes</div>
            <textarea
              rows={3}
              placeholder="Commit message (e.g. Fix authentication API validation)..."
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              className="w-full bg-[#090d16] border border-[#1e293b] rounded-lg p-3 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none font-mono mb-3"
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleAction('commit', { message: commitMessage })}
                disabled={!commitMessage.trim()}
                className="flex-1 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium transition-colors"
              >
                Commit
              </button>
              <button
                onClick={async () => {
                  await handleAction('commit', { message: commitMessage });
                  await handleAction('push');
                }}
                disabled={!commitMessage.trim()}
                className="py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium transition-colors"
              >
                Commit &amp; Push
              </button>
            </div>
          </div>

          {/* Changes list */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold text-gray-300">
                Changed Files ({allFiles.length})
              </div>
              {allFiles.length > 0 && (
                <button
                  onClick={() => handleViewDiff()}
                  className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                >
                  <FileDiff className="w-3.5 h-3.5" /> View Full Diff
                </button>
              )}
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-[#1e293b]">
              {allFiles.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-500">
                  Working tree clean. No changes detected.
                </div>
              ) : (
                allFiles.map((f: any) => (
                  <div
                    key={f.path}
                    className="py-2 flex items-center justify-between text-xs hover:bg-[#131e36] px-2 rounded cursor-pointer transition-colors"
                    onClick={() => handleViewDiff(f.path)}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span
                        className={`font-mono font-bold text-[11px] ${
                          f.status === 'modified'
                            ? 'text-amber-400'
                            : f.status === 'added'
                            ? 'text-emerald-400'
                            : f.status === 'deleted'
                            ? 'text-rose-400'
                            : 'text-purple-400'
                        }`}
                      >
                        {f.status === 'modified' ? 'M' : f.status === 'added' ? 'A' : f.status === 'deleted' ? 'D' : '?'}
                      </span>
                      <span className="text-gray-300 truncate">{f.path}</span>
                    </div>
                    <span className="text-[10px] text-gray-500 uppercase">{f.status}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column (7 cols): Branches, Older Activity & Commit History */}
        <div className="lg:col-span-7 space-y-4">
          {/* Branch Switch / Create */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Branch Management</h2>
            <div className="flex flex-col sm:flex-row gap-3 items-center">
              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <span className="text-xs text-gray-400">Switch:</span>
                <select
                  value={gitStatus?.currentBranch || 'main'}
                  onChange={(e) => handleAction('branch', { branchName: e.target.value })}
                  className="bg-[#090d16] border border-[#1e293b] text-xs text-gray-200 rounded-lg px-3 py-1.5"
                >
                  {(gitStatus?.branches || ['main']).map((b: string) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-2 w-full sm:flex-1">
                <input
                  type="text"
                  placeholder="New branch name..."
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  className="flex-1 bg-[#090d16] border border-[#1e293b] rounded-lg px-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 font-mono"
                />
                <button
                  onClick={() => handleAction('branch', { branchName: newBranchName, createBranch: true })}
                  disabled={!newBranchName.trim()}
                  className="px-3 py-1.5 bg-[#131e36] hover:bg-[#1e293b] text-blue-400 text-xs font-medium rounded-lg border border-[#1e293b] transition-colors"
                >
                  Create
                </button>
              </div>
            </div>
          </div>

          {/* Older Activity / Pull History & Undo Rollback */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <History className="w-4 h-4 text-purple-400" />
                Older Activity &amp; Pull History (Undo Rollbacks)
              </h2>
              <span className="text-[11px] text-gray-500 font-mono">
                {pullHistory.length} record{pullHistory.length === 1 ? '' : 's'}
              </span>
            </div>

            <p className="text-xs text-gray-400 mb-4">
              Every remote pull is tracked here. You can inspect changed files and safely undo any pull back to its prior commit.
            </p>

            <div className="divide-y divide-[#1e293b] max-h-72 overflow-y-auto pr-1">
              {pullHistory.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-500">
                  No previous pull operations recorded yet. Safe pull tracking is ready.
                </div>
              ) : (
                pullHistory.map((pull: any) => {
                  const isUndone = pull.status === 'undone';
                  const isExpanded = !!expandedPullFiles[pull.id];
                  const hasFiles = pull.affectedFiles && pull.affectedFiles.length > 0;

                  return (
                    <div key={pull.id} className="py-3 text-xs space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase ${
                              isUndone
                                ? 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            {isUndone ? 'Undone / Reverted' : 'Active Pull'}
                          </span>
                          <span className="text-gray-300 font-mono">
                            {pull.fromCommit ? pull.fromCommit.slice(0, 7) : 'HEAD'} &rarr;{' '}
                            {pull.toCommit ? pull.toCommit.slice(0, 7) : 'HEAD'}
                          </span>
                          {pull.envProtected && (
                            <span
                              className="text-[10px] text-emerald-400 bg-emerald-950/30 px-1.5 py-0.5 rounded flex items-center gap-1"
                              title=".env files preserved during this pull"
                            >
                              <ShieldCheck className="w-3 h-3" /> .env Safe
                            </span>
                          )}
                        </div>

                        {!isUndone && (
                          <button
                            onClick={() =>
                              setUndoModal({
                                open: true,
                                pullId: pull.id,
                                targetCommit: pull.fromCommit,
                                description: `Rollback repository code back to commit ${pull.fromCommit.slice(0, 7)}`,
                              })
                            }
                            className="self-start sm:self-auto px-2.5 py-1 rounded bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/40 text-amber-300 text-xs font-medium flex items-center gap-1 transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" /> Undo This Pull
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-gray-500 font-mono">
                        <span>
                          By {pull.user || 'system'} &bull; {new Date(pull.timestamp).toLocaleString()}
                        </span>
                        {hasFiles && (
                          <button
                            onClick={() => togglePullFiles(pull.id)}
                            className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                          >
                            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                            {pull.affectedFiles.length} file{pull.affectedFiles.length === 1 ? '' : 's'} affected
                          </button>
                        )}
                      </div>

                      {/* Expandable list of pulled files */}
                      {isExpanded && hasFiles && (
                        <div className="bg-[#090d16] p-2.5 rounded-lg border border-[#1e293b] font-mono text-[11px] space-y-1 text-gray-300">
                          <div className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Files Changed In Pull:</div>
                          {pull.affectedFiles.map((file: string, idx: number) => (
                            <div key={idx} className="flex items-center gap-1.5 truncate">
                              <FileText className="w-3 h-3 text-gray-400 shrink-0" />
                              <span className="truncate">{file}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Commit History */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <GitCommit className="w-4 h-4 text-blue-400" />
              Commit History
            </h2>
            <div className="divide-y divide-[#1e293b]">
              {!gitStatus?.recentCommits || gitStatus.recentCommits.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-500">No commits found in this branch.</div>
              ) : (
                gitStatus.recentCommits.map((c: any) => (
                  <div key={c.hash} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-start space-x-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                      <div>
                        <div className="text-xs font-medium text-gray-200">{c.message}</div>
                        <div className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
                          <span>{c.author_name}</span>
                          <span>&bull;</span>
                          <span>{new Date(c.date).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-xs text-blue-400 bg-[#090d16] px-2 py-0.5 rounded border border-[#1e293b] self-start sm:self-auto">
                      {c.hash.slice(0, 7)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pull Confirmation Modal with .env Protection Checkbox */}
      {pullConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#0f172a] border border-[#1e293b] rounded-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-blue-950/50 border border-blue-500/30 text-blue-400">
                <ArrowDown className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-white">Confirm Git Pull</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Are you sure you want to pull remote changes into branch{' '}
                  <strong className="text-emerald-400 font-mono">{gitStatus?.currentBranch || 'main'}</strong>?
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
                    <Shield className="w-3.5 h-3.5 text-emerald-400" />
                    Protect .env configuration files (Never overwrite with remote changes)
                  </span>
                  <p className="text-gray-400 text-[11px] mt-0.5">
                    DevPanel automatically saves a backup of your local <code className="text-amber-300">.env</code> and{' '}
                    <code className="text-amber-300">.env.production</code> before pulling and restores them immediately after the pull.
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
                onClick={() => setPullConfirmOpen(false)}
                className="px-4 py-2 rounded-lg bg-[#1e293b] hover:bg-[#283548] text-gray-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPull}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5"
              >
                <ArrowDown className="w-3.5 h-3.5" /> Execute Safe Pull
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Undo Pull Confirmation Modal */}
      {undoModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#0f172a] border border-amber-600/40 rounded-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-amber-950/50 border border-amber-500/30 text-amber-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-white">Confirm Undo Pull</h3>
                <p className="text-xs text-gray-300 mt-1">
                  Are you sure you want to undo the pull and rollback code?
                </p>
              </div>
            </div>

            <div className="bg-[#090d16] border border-[#1e293b] rounded-lg p-3 space-y-2 text-xs text-gray-300">
              <p>
                <strong>Rollback Target:</strong>{' '}
                <span className="font-mono text-amber-400">{undoModal.targetCommit ? undoModal.targetCommit.slice(0, 7) : 'Pre-pull HEAD'}</span>
              </p>
              <p className="text-gray-400 text-[11px]">
                This will reset all code files back to before the pull occurred. Your database (<code className="text-emerald-400">diet_ghazipur</code>) and <code className="text-amber-400">.env</code> configurations will remain untouched.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUndoModal({ open: false })}
                className="px-4 py-2 rounded-lg bg-[#1e293b] hover:bg-[#283548] text-gray-300 text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmUndo}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Confirm Rollback (Undo Pull)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diff Viewer Modal */}
      {diffView.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-4xl bg-[#0f172a] border border-[#1e293b] rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e293b]">
              <div className="flex items-center gap-2">
                <FileDiff className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">Git Diff: {diffView.file}</h3>
              </div>
              <button
                onClick={() => setDiffView({ open: false, content: '' })}
                className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded bg-[#1e293b]"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-[#090d16] font-mono text-xs leading-relaxed">
              <pre className="text-gray-300 whitespace-pre-wrap">
                {diffView.content.split('\n').map((line, i) => {
                  let colorClass = 'text-gray-400';
                  if (line.startsWith('+') && !line.startsWith('+++')) colorClass = 'text-emerald-400 bg-emerald-950/20';
                  else if (line.startsWith('-') && !line.startsWith('---')) colorClass = 'text-rose-400 bg-rose-950/20';
                  else if (line.startsWith('@@')) colorClass = 'text-cyan-400';
                  return (
                    <div key={i} className={colorClass}>
                      {line}
                    </div>
                  );
                })}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
