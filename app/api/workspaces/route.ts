import { NextRequest, NextResponse } from 'next/server';
import { secureApiHandler, logAudit, getClientIp } from '@/lib/api/handler';
import { getDatabase, saveDatabase } from '@/lib/database/db';
import { resolveWorkspacePath, ensureWorkspaceSampleFiles } from '@/lib/filesystem/workspace';

export async function GET(req: NextRequest) {
  return secureApiHandler(req, async () => {
    const db = getDatabase();
    return NextResponse.json({
      workspaces: db.projects || [],
      projects: db.projects || [],
    });
  });
}

export async function POST(req: NextRequest) {
  return secureApiHandler(
    req,
    async (r, user) => {
      const body = await req.json();
      const db = getDatabase();
      const { name, repoUrl, branch } = body;

      const id = (name || 'project').toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 32);
      const newWs = {
        id,
        name: name || id,
        type: 'sandbox' as const,
        path: `./workspaces/${id}`,
        repoUrl,
        branch: branch || 'main',
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        status: 'ready' as const,
      };

      db.projects.push(newWs);
      saveDatabase();
      resolveWorkspacePath(id, '');
      ensureWorkspaceSampleFiles(id);

      return NextResponse.json({ workspace: newWs });
    },
    'git_clone'
  );
}
