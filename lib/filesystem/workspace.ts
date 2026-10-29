import fs from 'fs';
import path from 'path';

export interface FileItem {
  name: string;
  path: string; // Relative to workspace root
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
 * Resolves and strictly validates that a path stays inside the given workspace.
 * Throws an error on path traversal attempts (e.g. ../, symlinks to outside, root escapes).
 */
export function resolveWorkspacePath(workspaceId: string, subPath: string = ''): string {
  // Prevent workspaceId from containing path traversal characters or dots
  if (!workspaceId || typeof workspaceId !== 'string') {
    throw new Error('Invalid workspace identifier.');
  }

  // Workspace ID must be clean alphanumeric/hyphen/underscore (no dots or slashes)
  const cleanWorkspaceId = workspaceId.trim();
  if (!/^[a-zA-Z0-9_\-]+$/.test(cleanWorkspaceId) || cleanWorkspaceId === '.' || cleanWorkspaceId === '..') {
    throw new Error(`Invalid workspace identifier: "${workspaceId}".`);
  }

  const workspaceRoot = path.join(getWorkspaceBaseDir(), cleanWorkspaceId);
  if (!fs.existsSync(workspaceRoot)) {
    fs.mkdirSync(workspaceRoot, { recursive: true });
  }

  // Detect explicit path traversal sequences in subPath
  if (subPath.includes('..') || subPath.startsWith('/') || subPath.startsWith('\\')) {
    throw new Error(`Security Violation: Path traversal attempt detected outside workspace (${subPath}).`);
  }

  // Resolve absolute path
  const targetPath = path.resolve(workspaceRoot, subPath);

  // Strict boundary check: targetPath MUST start with workspaceRoot
  const relative = path.relative(workspaceRoot, targetPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Security Violation: Path traversal attempt detected outside workspace (${subPath}).`);
  }

  // Symlink check: verify realpath doesn't escape workspace
  if (fs.existsSync(targetPath)) {
    const realTarget = fs.realpathSync(targetPath);
    const realRoot = fs.realpathSync(workspaceRoot);
    const realRelative = path.relative(realRoot, realTarget);
    if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
      throw new Error(`Security Violation: Symlink breakout attempt detected (${subPath}).`);
    }
  }

  return targetPath;
}

/**
 * Recursively lists files and directories within a workspace.
 */
export function listWorkspaceFiles(workspaceId: string, currentDir: string = '', maxDepth: number = 5): FileItem[] {
  const targetDir = resolveWorkspacePath(workspaceId, currentDir);
  if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
    return [];
  }

  if (maxDepth <= 0) return [];

  const entries = fs.readdirSync(targetDir, { withFileTypes: true });
  const result: FileItem[] = [];

  for (const entry of entries) {
    // Hide .git directory internals to keep UI fast and clean
    if (entry.name === '.git' || entry.name === 'node_modules') {
      result.push({
        name: entry.name,
        path: currentDir ? `${currentDir}/${entry.name}` : entry.name,
        type: 'directory',
        children: []
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
        children: listWorkspaceFiles(workspaceId, relPath, maxDepth - 1),
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

  // Sort folders first, then files alphabetically
  return result.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'directory' ? -1 : 1;
  });
}

/**
 * Reads file contents safely from workspace.
 */
export function readWorkspaceFile(workspaceId: string, filePath: string): string {
  const targetPath = resolveWorkspacePath(workspaceId, filePath);
  if (!fs.existsSync(targetPath)) {
    throw new Error(`File does not exist: ${filePath}`);
  }
  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    throw new Error(`Target is a directory, not a file: ${filePath}`);
  }
  // Enforce reasonable max file size for web editor (10MB)
  if (stat.size > 10 * 1024 * 1024) {
    throw new Error(`File exceeds max editable size limit (10MB)`);
  }
  return fs.readFileSync(targetPath, 'utf-8');
}

/**
 * Writes or updates a file safely inside workspace.
 */
export function writeWorkspaceFile(workspaceId: string, filePath: string, content: string): void {
  const targetPath = resolveWorkspacePath(workspaceId, filePath);
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(targetPath, content, 'utf-8');
}

/**
 * Creates a file or directory.
 */
export function createWorkspaceItem(workspaceId: string, itemPath: string, isDirectory: boolean): void {
  const targetPath = resolveWorkspacePath(workspaceId, itemPath);
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

/**
 * Renames an item safely.
 */
export function renameWorkspaceItem(workspaceId: string, oldPath: string, newPath: string): void {
  const oldTarget = resolveWorkspacePath(workspaceId, oldPath);
  const newTarget = resolveWorkspacePath(workspaceId, newPath);

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

/**
 * Deletes a file or directory safely.
 */
export function deleteWorkspaceItem(workspaceId: string, itemPath: string): void {
  const targetPath = resolveWorkspacePath(workspaceId, itemPath);
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

/**
 * Initialize default starter files in a workspace if empty
 */
export function ensureWorkspaceSampleFiles(workspaceId: string): void {
  const dir = resolveWorkspacePath(workspaceId, '');
  const files = fs.readdirSync(dir);
  if (files.length === 0) {
    writeWorkspaceFile(workspaceId, 'README.md', `# ${workspaceId}\n\nSelf-hosted Developer Workspace.\nManage, edit, build and test within an isolated environment.`);
    writeWorkspaceFile(workspaceId, 'package.json', JSON.stringify({
      name: workspaceId,
      version: "1.0.0",
      description: "Sample project inside DevPanel workspace",
      scripts: {
        "start": "node index.js"
      }
    }, null, 2));
    writeWorkspaceFile(workspaceId, 'index.js', `// Welcome to DevPanel Web Code Editor\nconsole.log("Server running inside workspace: ${workspaceId}");\n`);
  }
}
