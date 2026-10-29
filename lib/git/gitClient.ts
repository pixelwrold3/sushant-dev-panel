import simpleGit, { SimpleGit, StatusResult, LogResult, DiffResult } from 'simple-git';
import path from 'path';
import fs from 'fs';
import { resolveWorkspacePath } from '../filesystem/workspace';

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
      // Configure initial default identity if not set locally
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
  // Sanitize repoUrl
  if (!repoUrl || typeof repoUrl !== 'string') {
    throw new Error('Valid repository URL is required.');
  }

  // Basic sanity check to prevent command injection in git url
  if (repoUrl.startsWith('-') || /[\r\n\t]/.test(repoUrl)) {
    throw new Error('Invalid repository URL specified.');
  }

  const git = simpleGit(path.dirname(targetDir));
  const options = branch ? ['-b', branch] : [];

  // If target folder exists and has files, clean or clone into it
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
  } catch { }

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

  return {
    isGitRepo: true,
    currentBranch: status.current || 'main',
    remoteUrl,
    ahead: status.ahead,
    behind: status.behind,
    files,
    stagedFiles,
  };
}

export async function getBranches(workspaceId: string) {
  const git = getGit(workspaceId);
  return await git.branchLocal();
}

export async function checkoutBranch(workspaceId: string, branchName: string, create: boolean = false) {
  // Sanitize branch name
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
  // Auto stage all changes if nothing staged
  const status = await git.status();
  const hasStaged = status.files.some(f => f.index !== ' ' && f.index !== '?');
  if (!hasStaged) {
    await git.add('.');
  }
  return await git.commit(message);
}

export async function gitPull(workspaceId: string) {
  const git = getGit(workspaceId);
  return await git.pull();
}

export async function gitPush(workspaceId: string) {
  const git = getGit(workspaceId);
  return await git.push();
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

