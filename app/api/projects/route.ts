import { NextRequest, NextResponse } from 'next/server';
import { secureApiHandler, logAudit, getClientIp } from '@/lib/api/handler';
import { getDatabase, saveDatabase, ProjectRecord } from '@/lib/database/db';
import { resolveWorkspacePath, ensureWorkspaceSampleFiles } from '@/lib/filesystem/workspace';
import { cloneRepository } from '@/lib/git/gitClient';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  return secureApiHandler(req, async () => {
    const db = getDatabase();
    return NextResponse.json({
      projects: db.projects || [],
      workspaces: db.projects || [], // backward compatibility
    });
  });
}

export async function POST(req: NextRequest) {
  return secureApiHandler(
    req,
    async (r, user) => {
      const body = await req.json();
      const {
        name,
        type = 'connected',
        path: customPath,
        repoUrl,
        branch = 'main',
        runtime = 'Node.js',
        buildCommand = 'npm run build',
        restartCommand,
        systemdService,
        autoStart = false,
      } = body;

      if (!name || typeof name !== 'string') {
        return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
      }

      const id = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 32);
      const db = getDatabase();

      if (db.projects.some(p => p.id === id)) {
        return NextResponse.json({ error: `Project with ID "${id}" already exists` }, { status: 400 });
      }

      let projectPath = customPath;

      if (type === 'connected') {
        if (!customPath) {
          return NextResponse.json({ error: 'Directory Path is required for connected project' }, { status: 400 });
        }

        // Validate and sanitize path
        const resolved = path.resolve(customPath);

        // Security check: Never allow connecting the root or sensitive host directories
        const forbiddenPaths = ['/', '/root', '/etc', '/var/run', '/usr', '/bin', '/sbin'];
        if (forbiddenPaths.includes(resolved)) {
          return NextResponse.json({ error: `Security violation: Cannot connect forbidden path: ${resolved}` }, { status: 400 });
        }

        // Verify directory exists or create if safe
        if (!fs.existsSync(resolved)) {
          try {
            fs.mkdirSync(resolved, { recursive: true });
          } catch (err: any) {
            return NextResponse.json({ error: `Cannot access or create directory: ${err.message}` }, { status: 400 });
          }
        }

        projectPath = resolved;
      } else {
        // Sandbox project
        projectPath = `./workspaces/${id}`;
        resolveWorkspacePath(id, '');
        ensureWorkspaceSampleFiles(id);
      }

      const newProject: ProjectRecord = {
        id,
        name,
        type: type === 'connected' ? 'connected' : 'sandbox',
        path: projectPath,
        repoUrl: repoUrl || undefined,
        branch: branch || 'main',
        runtime,
        buildCommand,
        restartCommand,
        systemdService,
        autoStart: !!autoStart,
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        status: 'ready',
      };

      db.projects.push(newProject);
      saveDatabase();

      const ip = getClientIp(req);
      logAudit(
        user.email,
        'Project Connected',
        `Connected project ${name} (${projectPath})`,
        id,
        ip,
        'Success'
      );

      // Clone if repoUrl provided and .git does not exist
      if (repoUrl && !fs.existsSync(path.join(projectPath, '.git'))) {
        try {
          await cloneRepository(id, repoUrl, branch);
          newProject.status = 'ready';
          saveDatabase();
        } catch (err: any) {
          newProject.status = 'error';
          saveDatabase();
          return NextResponse.json({
            project: newProject,
            warning: `Project connected, but Git clone failed: ${err.message}`,
          });
        }
      }

      return NextResponse.json({ project: newProject });
    },
    'git_clone'
  );
}

export async function DELETE(req: NextRequest) {
  return secureApiHandler(
    req,
    async (r, user) => {
      const { searchParams } = new URL(req.url);
      const id = searchParams.get('id');

      if (!id) {
        return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
      }

      const db = getDatabase();
      const index = db.projects.findIndex(p => p.id === id);
      if (index === -1) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      const project = db.projects[index];
      db.projects.splice(index, 1);
      saveDatabase();

      const ip = getClientIp(req);
      logAudit(
        user.email,
        'Project Disconnected',
        `Disconnected project ${project.name} (${project.path})`,
        id,
        ip,
        'Success'
      );

      return NextResponse.json({ success: true, message: 'Project disconnected' });
    },
    'manage_settings'
  );
}

