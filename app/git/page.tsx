'use client';

import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  GitCommit,
  GitPullRequest,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Plus,
  Check,
  FileCode,
  FileDiff,
  FolderGit2,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

export default function GitPage() {
  const [workspaceId, setWorkspaceId] = useState('main-website');
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

  const loadStatus = async (ws: string) => {
    try {
      const res = await fetch(`/api/git/status?workspaceId=${encodeURIComponent(ws)}`);
      const data = await res.json();
      setGitStatus(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetch('/api/workspaces')
      .then((r) => r.json())
      .then((d) => {
        if (d.workspaces) {
          setWorkspaces(d.workspaces);
          if (d.workspaces.length > 0) {
            setWorkspaceId(d.workspaces[0].id);
            loadStatus(d.workspaces[0].id);
          }
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
        setActionMessage(`Git error: ${data.error}`);
      }
    } catch (err: any) {
      setActionMessage(`Git failed: ${err.message}`);
    }
    setTimeout(() => setActionMessage(null), 4000);
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
            Manage repository commits, branches, pulls, and pushes directly from the browser.
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
                Workspace: {w.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => loadStatus(workspaceId)}
            className="p-2 bg-[#0f172a] hover:bg-[#1e293b] border border-[#1e293b] text-gray-400 hover:text-white rounded-lg"
            title="Refresh Git Status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
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

      {/* Main Git Grid: Left = Source Control / Commit; Right = Commit History & Branches */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols): Commit & Changes */}
        <div className="lg:col-span-5 space-y-4">
          {/* Branch & Sync Bar */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <GitBranch className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-gray-300">Current Branch:</span>
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
                onClick={() => handleAction('pull')}
                className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-[#131e36] hover:bg-[#1e293b] border border-[#1e293b] text-xs text-gray-200 transition-colors"
              >
                <ArrowDown className="w-3.5 h-3.5 text-blue-400" /> Pull
              </button>
              <button
                onClick={() => handleAction('push')}
                className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-[#131e36] hover:bg-[#1e293b] border border-[#1e293b] text-xs text-gray-200 transition-colors"
              >
                <ArrowUp className="w-3.5 h-3.5 text-emerald-400" /> Push
              </button>
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
                        className={`font-mono font-bold text-[11px] ${f.status === 'modified'
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

        {/* Right Column (7 cols): Branches & Commit History */}
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

