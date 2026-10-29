import { NextRequest, NextResponse } from 'next/server';
import { secureApiHandler, logAudit, getClientIp } from '@/lib/api/handler';
import { getDatabase, saveDatabase, WorkspaceRecord } from '@/lib/database/db';
import { ensureWorkspaceSampleFiles, resolveWorkspacePath } from '@/lib/filesystem/workspace';
import { cloneRepository } from '@/lib/git/gitClient';

export async function GET(req: NextRequest) {
  return secureApiHandler(req, async () => {
    const db = getDatabase();
    // Ensure all workspaces have local folders initialized
    for (const ws of db.workspaces) {
      try {
        resolveWorkspacePath(ws.id, '');
        ensureWorkspaceSampleFiles(ws.id);
      } catch { }
    }
    return NextResponse.json({ workspaces: db.workspaces });
  });
}

export async function POST(req: NextRequest) {
  return secureApiHandler(
    req,
    async (r, user) => {
      const body = await req.json();
      const { name, repoUrl, branch } = body;

      if (!name || typeof name !== 'string') {
        return NextResponse.json({ error: 'Workspace name is required' }, { status: 400 });
      }

      const id = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 32);
      const db = getDatabase();

      if (db.workspaces.some(w => w.id === id)) {
        return NextResponse.json({ error: 'Workspace with this name already exists' }, { status: 400 });
      }

      const newWorkspace: WorkspaceRecord = {
        id,
        name,
        repoUrl: repoUrl || undefined,
        branch: branch || 'main',
        path: id,
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        status: repoUrl ? 'cloning' : 'ready',
      };

      db.workspaces.push(newWorkspace);
      saveDatabase();

      const ip = getClientIp(req);
      logAudit(user.email, 'Workspace Created', `Created workspace: ${name} (${id})`, id, ip, 'Success');

      // Initialize directory
      resolveWorkspacePath(id, '');

      if (repoUrl) {
        try {
          await cloneRepository(id, repoUrl, branch);
          newWorkspace.status = 'ready';
          saveDatabase();
          logAudit(user.email, 'Git Clone', `Cloned ${repoUrl} into workspace ${id}`, id, ip, 'Success');
        } catch (err: any) {
          newWorkspace.status = 'error';
          saveDatabase();
          return NextResponse.json({
            workspace: newWorkspace,
            warning: `Workspace created, but clone failed: ${err.message}`,
          });
        }
      } else {
        ensureWorkspaceSampleFiles(id);
      }

      return NextResponse.json({ workspace: newWorkspace });
    },
    'git_clone'
  );
}

