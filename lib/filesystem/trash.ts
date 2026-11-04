import fs from 'fs';
import path from 'path';
import { getProjectRoot, resolveWorkspacePath } from './workspace';

export interface TrashItem {
  id: string;
  originalPath: string; // Relative to project root
  name: string;
  type: 'file' | 'directory';
  size: number;
  trashedAt: string; // ISO string in IST
  trashedBy?: string;
  storedName: string;
}

interface TrashIndex {
  items: TrashItem[];
}

function getTrashDir(projectId: string): string {
  const root = getProjectRoot(projectId);
  const trashDir = path.join(root, '.devpanel_trash');
  if (!fs.existsSync(trashDir)) {
    fs.mkdirSync(trashDir, { recursive: true });
  }
  return trashDir;
}

function getTrashIndex(projectId: string): TrashIndex {
  const trashDir = getTrashDir(projectId);
  const indexPath = path.join(trashDir, 'trash-index.json');
  if (fs.existsSync(indexPath)) {
    try {
      return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    } catch {
      return { items: [] };
    }
  }
  return { items: [] };
}

function saveTrashIndex(projectId: string, index: TrashIndex): void {
  const trashDir = getTrashDir(projectId);
  const indexPath = path.join(trashDir, 'trash-index.json');
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
}

/**
 * Moves an item to the project's Recycle Bin
 */
export function moveToTrash(projectId: string, itemPath: string, user: string = 'admin'): TrashItem {
  const absSource = resolveWorkspacePath(projectId, itemPath);
  if (!fs.existsSync(absSource)) {
    throw new Error(`Item does not exist: ${itemPath}`);
  }

  const stat = fs.statSync(absSource);
  const isDir = stat.isDirectory();
  const id = `trash_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const storedName = `${id}_${path.basename(itemPath)}`;
  const trashDir = getTrashDir(projectId);
  const absDest = path.join(trashDir, storedName);

  // Move the file/folder into .devpanel_trash
  fs.renameSync(absSource, absDest);

  const trashItem: TrashItem = {
    id,
    originalPath: itemPath,
    name: path.basename(itemPath),
    type: isDir ? 'directory' : 'file',
    size: stat.size || 0,
    trashedAt: new Date().toISOString(),
    trashedBy: user,
    storedName,
  };

  const index = getTrashIndex(projectId);
  index.items.unshift(trashItem);
  saveTrashIndex(projectId, index);

  return trashItem;
}

/**
 * List all items in the Recycle Bin for a project
 */
export function listTrash(projectId: string): TrashItem[] {
  const index = getTrashIndex(projectId);
  const trashDir = getTrashDir(projectId);

  // Verify stored items still exist on disk
  const validItems = index.items.filter((item) => {
    return fs.existsSync(path.join(trashDir, item.storedName));
  });

  if (validItems.length !== index.items.length) {
    index.items = validItems;
    saveTrashIndex(projectId, index);
  }

  return validItems;
}

/**
 * Restores an item from the Recycle Bin back to its original location
 */
export function restoreFromTrash(projectId: string, trashId: string): TrashItem {
  const index = getTrashIndex(projectId);
  const itemIndex = index.items.findIndex((item) => item.id === trashId);
  if (itemIndex === -1) {
    throw new Error(`Trash item not found: ${trashId}`);
  }

  const item = index.items[itemIndex];
  const trashDir = getTrashDir(projectId);
  const absSource = path.join(trashDir, item.storedName);

  if (!fs.existsSync(absSource)) {
    index.items.splice(itemIndex, 1);
    saveTrashIndex(projectId, index);
    throw new Error(`Trashed file missing on disk: ${item.name}`);
  }

  const absDest = resolveWorkspacePath(projectId, item.originalPath);

  // If destination already exists, generate a restored copy name
  let finalDest = absDest;
  if (fs.existsSync(absDest)) {
    const ext = path.extname(item.originalPath);
    const base = path.basename(item.originalPath, ext);
    const dir = path.dirname(item.originalPath);
    const newName = `${base}_restored_${Date.now()}${ext}`;
    finalDest = resolveWorkspacePath(projectId, dir === '.' ? newName : path.join(dir, newName));
  }

  const parentDir = path.dirname(finalDest);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  fs.renameSync(absSource, finalDest);

  // Remove from index
  index.items.splice(itemIndex, 1);
  saveTrashIndex(projectId, index);

  return item;
}

/**
 * Permanently deletes a single item from the Recycle Bin
 */
export function deletePermanent(projectId: string, trashId: string): void {
  const index = getTrashIndex(projectId);
  const itemIndex = index.items.findIndex((item) => item.id === trashId);
  if (itemIndex === -1) {
    return;
  }

  const item = index.items[itemIndex];
  const trashDir = getTrashDir(projectId);
  const absSource = path.join(trashDir, item.storedName);

  if (fs.existsSync(absSource)) {
    const stat = fs.statSync(absSource);
    if (stat.isDirectory()) {
      fs.rmSync(absSource, { recursive: true, force: true });
    } else {
      fs.unlinkSync(absSource);
    }
  }

  index.items.splice(itemIndex, 1);
  saveTrashIndex(projectId, index);
}

/**
 * Empties all items from the Recycle Bin
 */
export function emptyTrash(projectId: string): void {
  const trashDir = getTrashDir(projectId);
  if (fs.existsSync(trashDir)) {
    const entries = fs.readdirSync(trashDir);
    for (const entry of entries) {
      const full = path.join(trashDir, entry);
      try {
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          fs.rmSync(full, { recursive: true, force: true });
        } else {
          fs.unlinkSync(full);
        }
      } catch {}
    }
  }
  saveTrashIndex(projectId, { items: [] });
}
