import simpleGit, { SimpleGit, StatusResult, LogResult } from 'simple-git';
import path from 'path';
import fs from 'fs';
import { resolveWorkspacePath } from '../filesystem/workspace';
import { getDatabase, saveDatabase, PullHistoryRecord } from '../database/db';

export interface GitFileStatus {
  path: string;
  index: string;
  working_dir: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed';
}

export interface GitPanelStatus {
  isGitRepo: boolean;
  currentBranch: string;
  remoteUrl?: string;
  ahead: number;
  behind: number;
  files: GitFileStatus[];
  stagedFiles: GitFileStatus[];
  currentCommit?: string;
  canUndoLastPull?: boolean;
  lastPull?: PullHistoryRecord | null;
}

export function getGit(workspaceId: string): SimpleGit {
  const repoPath = resolveWorkspacePath(workspaceId, '');
  return simpleGit(repoPath, { binary: 'git', maxConcurrentProcesses: 3 });
}

export async function isRepo(workspaceId: string): Promise<boolean> {
  const repoPath = resolveWorkspacePath(workspaceId, '');
  const gitDir = path.join(repoPath, '.git');
  return fs.existsSync(gitDir);
}

export async function initOrCheckGit(workspaceId: string): Promise<boolean> {
  const exists = await isRepo(workspaceId);
  if (!exists) {
    const git = getGit(workspaceId);
    try {
      await git.init();
      await git.addConfig('user.name', 'DevPanel User', false, 'local');
      await git.addConfig('user.email', 'developer@devpanel.local', false, 'local');
      return true;
    } catch {
      return false;
    }
  }
  return true;
}

export async function cloneRepository(workspaceId: string, repoUrl: string, branch?: string): Promise<void> {
  const targetDir = resolveWorkspacePath(workspaceId, '');
  if (!repoUrl || typeof repoUrl !== 'string') {
    throw new Error('Valid repository URL is required.');
  }

  if (repoUrl.startsWith('-') || /[\r\n\t]/.test(repoUrl)) {
    throw new Error('Invalid repository URL specified.');
  }

  const git = simpleGit(path.dirname(targetDir));
  const options = branch ? ['-b', branch] : [];
  await git.clone(repoUrl, targetDir, options);
}

export async function getGitStatus(workspaceId: string): Promise<GitPanelStatus> {
  const repoExists = await isRepo(workspaceId);
  if (!repoExists) {
    return {
      isGitRepo: false,
      currentBranch: '',
      ahead: 0,
      behind: 0,
      files: [],
      stagedFiles: [],
    };
  }

  const git = getGit(workspaceId);
  const status: StatusResult = await git.status();

  let remoteUrl = '';
  try {
    const remotes = await git.getRemotes(true);
    if (remotes.length > 0 && remotes[0].refs.fetch) {
      remoteUrl = remotes[0].refs.fetch;
    }
  } catch {}

  let currentCommit = '';
  try {
    currentCommit = await git.revparse(['--short', 'HEAD']);
  } catch {}

  const files: GitFileStatus[] = [];
  const stagedFiles: GitFileStatus[] = [];

  for (const f of status.files) {
    let stat: GitFileStatus['status'] = 'modified';
    if (f.working_dir === '?') stat = 'untracked';
    else if (f.working_dir === 'D' || f.index === 'D') stat = 'deleted';
    else if (f.index === 'A') stat = 'added';
    else if (f.index === 'R') stat = 'renamed';

    const item: GitFileStatus = {
      path: f.path,
      index: f.index,
      working_dir: f.working_dir,
      status: stat,
    };

    if (f.index !== ' ' && f.index !== '?') {
      stagedFiles.push(item);
    }
    if (f.working_dir !== ' ') {
      files.push(item);
    }
  }

  const db = getDatabase();
  const history = (db.pullHistory || []).filter(h => h.projectId === workspaceId);
  const lastPull = history.length > 0 ? history[0] : null;
  const canUndoLastPull = lastPull !== null && lastPull.status === 'active';

  return {
    isGitRepo: true,
    currentBranch: status.current || 'main',
    remoteUrl,
    ahead: status.ahead,
    behind: status.behind,
    files,
    stagedFiles,
    currentCommit,
    canUndoLastPull,
    lastPull,
  };
}

export async function getBranches(workspaceId: string) {
  const git = getGit(workspaceId);
  return await git.branchLocal();
}

export async function checkoutBranch(workspaceId: string, branchName: string, create: boolean = false) {
  const cleanBranch = branchName.trim();
  if (!cleanBranch || cleanBranch.startsWith('-') || /[\s~^:?*\[\\]/.test(cleanBranch)) {
    throw new Error('Invalid branch name.');
  }

  const git = getGit(workspaceId);
  if (create) {
    await git.checkoutLocalBranch(cleanBranch);
  } else {
    await git.checkout(cleanBranch);
  }
}

export async function stageAll(workspaceId: string) {
  const git = getGit(workspaceId);
  await git.add('.');
}

export async function stageFile(workspaceId: string, filePath: string) {
  const git = getGit(workspaceId);
  await git.add(filePath);
}

export async function unstageFile(workspaceId: string, filePath: string) {
  const git = getGit(workspaceId);
  await git.reset(['HEAD', filePath]);
}

export async function commitChanges(workspaceId: string, message: string) {
  if (!message || message.trim().length === 0) {
    throw new Error('Commit message cannot be empty.');
  }
  const git = getGit(workspaceId);
  const status = await git.status();
  const hasStaged = status.files.some(f => f.index !== ' ' && f.index !== '?');
  if (!hasStaged) {
    await git.add('.');
  }
  return await git.commit(message);
}

export async function gitPush(workspaceId: string) {
  const git = getGit(workspaceId);
  return await git.push();
}

/**
 * Safe Git Pull with .env Preservation & Undo Rollback Tracking
 */
export async function gitPull(workspaceId: string, options: { protectEnv?: boolean; user?: string } = {}) {
  const git = getGit(workspaceId);
  const projectDir = resolveWorkspacePath(workspaceId, '');

  let preCommit = '';
  try {
    preCommit = await git.revparse(['HEAD']);
  } catch {
    preCommit = 'HEAD';
  }

  // Backup .env files if protectEnv is true (default true)
  const envBackups = new Map<string, string>();
  const envFiles = ['.env', '.env.local', '.env.production', '.env.development'];

  if (options.protectEnv !== false) {
    for (const f of envFiles) {
      const full = path.join(projectDir, f);
      if (fs.existsSync(full)) {
        try {
          envBackups.set(f, fs.readFileSync(full, 'utf8'));
        } catch {}
      }
    }
  }

  // Execute pull
  const pullResult = await git.pull();

  let postCommit = '';
  try {
    postCommit = await git.revparse(['HEAD']);
  } catch {
    postCommit = preCommit;
  }

  // Restore .env backups to guarantee server environment is NOT altered
  if (options.protectEnv !== false && envBackups.size > 0) {
    for (const [f, content] of envBackups.entries()) {
      try {
        fs.writeFileSync(path.join(projectDir, f), content, 'utf8');
      } catch {}
    }
  }

  // Get current branch
  let currentBranch = 'main';
  try {
    const status = await git.status();
    currentBranch = status.current || 'main';
  } catch {}

  // Record in Pull History
  const db = getDatabase();
  if (!db.pullHistory) db.pullHistory = [];

  const historyRecord: PullHistoryRecord = {
    id: `pull_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    projectId: workspaceId,
    timestamp: new Date().toISOString(),
    user: options.user || 'admin@devpanel.local',
    fromCommit: preCommit,
    toCommit: postCommit,
    branch: currentBranch,
    status: 'active',
    envProtected: options.protectEnv !== false,
    affectedFiles: pullResult?.files || [],
  };

  db.pullHistory.unshift(historyRecord);
  if (db.pullHistory.length > 50) {
    db.pullHistory = db.pullHistory.slice(0, 50);
  }
  saveDatabase();

  return {
    ...pullResult,
    historyRecord,
    preCommit: preCommit.slice(0, 7),
    postCommit: postCommit.slice(0, 7),
    envProtected: options.protectEnv !== false,
  };
}

/**
 * Undo Last Pull (Rollback to pre-pull commit)
 */
export async function gitUndoPull(workspaceId: string, pullId?: string, targetCommit?: string) {
  const git = getGit(workspaceId);
  const projectDir = resolveWorkspacePath(workspaceId, '');
  const db = getDatabase();
  const history = db.pullHistory || [];

  let record: PullHistoryRecord | undefined;
  if (pullId) {
    record = history.find(h => h.id === pullId);
  } else {
    record = history.find(h => h.projectId === workspaceId && h.status === 'active');
  }

  const revertTo = targetCommit || record?.fromCommit;
  if (!revertTo) {
    throw new Error('No previous pull commit found to undo.');
  }

  // Preserve .env during reset
  const envBackups = new Map<string, string>();
  const envFiles = ['.env', '.env.local', '.env.production', '.env.development'];
  for (const f of envFiles) {
    const full = path.join(projectDir, f);
    if (fs.existsSync(full)) {
      try {
        envBackups.set(f, fs.readFileSync(full, 'utf8'));
      } catch {}
    }
  }

  // Hard reset to pre-pull commit
  await git.reset(['--hard', revertTo]);

  // Restore .env files
  for (const [f, content] of envBackups.entries()) {
    try {
      fs.writeFileSync(path.join(projectDir, f), content, 'utf8');
    } catch {}
  }

  if (record) {
    record.status = 'undone';
    record.revertedAt = new Date().toISOString();
  }
  saveDatabase();

  return {
    success: true,
    revertedTo: revertTo.slice(0, 7),
    revertedCommitFull: revertTo,
    message: `Successfully undone pull! Reverted files back to commit ${revertTo.slice(0, 7)}.`,
  };
}

export function getPullHistory(workspaceId: string): PullHistoryRecord[] {
  const db = getDatabase();
  return (db.pullHistory || []).filter(h => h.projectId === workspaceId);
}

export async function getCommitHistory(workspaceId: string, maxCount: number = 20) {
  const git = getGit(workspaceId);
  try {
    const log: LogResult = await git.log({ maxCount });
    return log.all;
  } catch {
    return [];
  }
}

export async function getFileDiff(workspaceId: string, filePath?: string): Promise<string> {
  const git = getGit(workspaceId);
  try {
    if (filePath) {
      return await git.diff([filePath]);
    }
    return await git.diff();
  } catch {
    return '';
  }
}
