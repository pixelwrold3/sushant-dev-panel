import fs from 'fs';
import path from 'path';
import { getDatabase, ProjectRecord } from '../database/db';

export interface FileItem {
  name: string;
  path: string; // Relative to project root
  type: 'file' | 'directory';
  size?: number;
  lastModified?: string;
  children?: FileItem[];
}

export function getWorkspaceBaseDir(): string {
  const root = process.env.WORKSPACE_ROOT || './workspaces';
  const resolved = path.resolve(process.cwd(), root);
  if (!fs.existsSync(resolved)) {
    fs.mkdirSync(resolved, { recursive: true });
  }
  return resolved;
}

/**
 * Returns the verified absolute filesystem root for a given project.
 * Checks against the registered connected projects and sandbox workspaces.
 */
export function getProjectRoot(projectId: string): string {
  if (!projectId || typeof projectId !== 'string') {
    throw new Error('Invalid project identifier.');
  }

  const cleanId = projectId.trim();
  const db = getDatabase();
  const project = db.projects?.find((p) => p.id === cleanId);

  if (project) {
    if (project.type === 'connected') {
      const targetDir = path.resolve(project.path);
      // On Windows or during local dev, if /var/www/diet-website doesn't exist, create a mock connected directory
      if (!fs.existsSync(targetDir)) {
        try {
          fs.mkdirSync(targetDir, { recursive: true });
        } catch {
          // If permission fails (e.g. non-root on /var/www), fall back to local dev mirror
          const fallback = path.resolve(process.cwd(), 'workspaces', cleanId);
          if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
          return fallback;
        }
      }
      return targetDir;
    } else {
      // Sandbox project
      const workspaceRoot = path.join(getWorkspaceBaseDir(), cleanId);
      if (!fs.existsSync(workspaceRoot)) {
        fs.mkdirSync(workspaceRoot, { recursive: true });
      }
      return workspaceRoot;
    }
  }

  // Fallback sandbox lookup for backward compatibility
  const cleanWorkspaceId = cleanId.replace(/[^a-zA-Z0-9_\-]/g, '');
  if (!cleanWorkspaceId) {
    throw new Error(`Invalid project identifier: "${projectId}".`);
  }
  const fallbackRoot = path.join(getWorkspaceBaseDir(), cleanWorkspaceId);
  if (!fs.existsSync(fallbackRoot)) {
    fs.mkdirSync(fallbackRoot, { recursive: true });
  }
  return fallbackRoot;
}

/**
 * Resolves and strictly validates that a path stays inside the target project directory.
 * Prevents traversal escapes (e.g. ../, /etc/passwd, root breakouts).
 */
export function resolveWorkspacePath(projectId: string, subPath: string = ''): string {
  const projectRoot = getProjectRoot(projectId);

  // Detect explicit traversal attempts
  if (subPath.includes('..') || subPath.startsWith('/') || subPath.startsWith('\\')) {
    throw new Error(`Security Violation: Path traversal attempt detected outside project (${subPath}).`);
  }

  const targetPath = path.resolve(projectRoot, subPath);

  // Strict boundary check: targetPath MUST start with projectRoot
  const relative = path.relative(projectRoot, targetPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Security Violation: Path traversal attempt detected outside project (${subPath}).`);
  }

  // Symlink check
  if (fs.existsSync(targetPath)) {
    try {
      const realTarget = fs.realpathSync(targetPath);
      const realRoot = fs.realpathSync(projectRoot);
      const realRelative = path.relative(realRoot, realTarget);
      if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
        throw new Error(`Security Violation: Symlink breakout attempt detected (${subPath}).`);
      }
    } catch (e: any) {
      if (e.message?.includes('Security Violation')) throw e;
    }
  }

  return targetPath;
}

/**
 * Recursively lists files and directories within a project.
 */
export function listWorkspaceFiles(projectId: string, currentDir: string = '', maxDepth: number = 5): FileItem[] {
  const targetDir = resolveWorkspacePath(projectId, currentDir);
  if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
    return [];
  }

  if (maxDepth <= 0) return [];

  const entries = fs.readdirSync(targetDir, { withFileTypes: true });
  const result: FileItem[] = [];

  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.next') {
      result.push({
        name: entry.name,
        path: currentDir ? `${currentDir}/${entry.name}` : entry.name,
        type: 'directory',
        children: [],
      });
      continue;
    }

    const relPath = currentDir ? `${currentDir}/${entry.name}` : entry.name;
    const fullPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      result.push({
        name: entry.name,
        path: relPath,
        type: 'directory',
        children: listWorkspaceFiles(projectId, relPath, maxDepth - 1),
      });
    } else {
      let size = 0;
      let lastModified = new Date().toISOString();
      try {
        const stat = fs.statSync(fullPath);
        size = stat.size;
        lastModified = stat.mtime.toISOString();
      } catch {}

      result.push({
        name: entry.name,
        path: relPath,
        type: 'file',
        size,
        lastModified,
      });
    }
  }

  return result.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'directory' ? -1 : 1;
  });
}

export function readWorkspaceFile(projectId: string, filePath: string): string {
  const targetPath = resolveWorkspacePath(projectId, filePath);
  if (!fs.existsSync(targetPath)) {
    throw new Error(`File does not exist: ${filePath}`);
  }
  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    throw new Error(`Target is a directory, not a file: ${filePath}`);
  }
  if (stat.size > 10 * 1024 * 1024) {
    throw new Error(`File exceeds max editable size limit (10MB)`);
  }
  return fs.readFileSync(targetPath, 'utf-8');
}

export function writeWorkspaceFile(projectId: string, filePath: string, content: string): void {
  const targetPath = resolveWorkspacePath(projectId, filePath);
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(targetPath, content, 'utf-8');
}

export function createWorkspaceItem(projectId: string, itemPath: string, isDirectory: boolean): void {
  const targetPath = resolveWorkspacePath(projectId, itemPath);
  if (fs.existsSync(targetPath)) {
    throw new Error('Item already exists at this path.');
  }

  if (isDirectory) {
    fs.mkdirSync(targetPath, { recursive: true });
  } else {
    const parent = path.dirname(targetPath);
    if (!fs.existsSync(parent)) {
      fs.mkdirSync(parent, { recursive: true });
    }
    fs.writeFileSync(targetPath, '', 'utf-8');
  }
}

export function renameWorkspaceItem(projectId: string, oldPath: string, newPath: string): void {
  const oldTarget = resolveWorkspacePath(projectId, oldPath);
  const newTarget = resolveWorkspacePath(projectId, newPath);

  if (!fs.existsSync(oldTarget)) {
    throw new Error('Source item does not exist.');
  }
  if (fs.existsSync(newTarget)) {
    throw new Error('Destination path already exists.');
  }

  const newParent = path.dirname(newTarget);
  if (!fs.existsSync(newParent)) {
    fs.mkdirSync(newParent, { recursive: true });
  }

  fs.renameSync(oldTarget, newTarget);
}

export function deleteWorkspaceItem(projectId: string, itemPath: string): void {
  const targetPath = resolveWorkspacePath(projectId, itemPath);
  if (!fs.existsSync(targetPath)) {
    return;
  }
  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  } else {
    fs.unlinkSync(targetPath);
  }
}

export function ensureWorkspaceSampleFiles(projectId: string): void {
  const dir = resolveWorkspacePath(projectId, '');
  const files = fs.readdirSync(dir);
  if (files.length === 0) {
    writeWorkspaceFile(projectId, 'README.md', `# Project: ${projectId}\n\nManaged via DevPanel.`);
    writeWorkspaceFile(projectId, 'package.json', JSON.stringify({
      name: projectId,
      version: '1.0.0',
      scripts: {
        build: 'echo "Building project..."',
        start: 'node index.js',
      },
    }, null, 2));
    writeWorkspaceFile(projectId, 'index.js', `// Application entry point for ${projectId}\nconsole.log("App running");\n`);
  }
}
