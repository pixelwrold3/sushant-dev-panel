import { NextRequest, NextResponse } from 'next/server';
import { secureApiHandler, logAudit, getClientIp } from '@/lib/api/handler';
import {
  listWorkspaceFiles,
  readWorkspaceFile,
  writeWorkspaceFile,
  createWorkspaceItem,
  renameWorkspaceItem,
  deleteWorkspaceItem,
  copyWorkspaceItem,
} from '@/lib/filesystem/workspace';

export async function GET(req: NextRequest) {
  return secureApiHandler(
    req,
    async (r) => {
      const { searchParams } = new URL(req.url);
      const projectId = searchParams.get('projectId') || searchParams.get('workspaceId') || 'diet-ghazipur';
      const filePath = searchParams.get('path');

      try {
        if (filePath !== null && filePath !== undefined && filePath !== '') {
          const content = readWorkspaceFile(projectId, filePath);
          return NextResponse.json({ content, path: filePath });
        } else {
          const tree = listWorkspaceFiles(projectId);
          return NextResponse.json({ files: tree });
        }
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    },
    'view_code'
  );
}

export async function PUT(req: NextRequest) {
  return secureApiHandler(
    req,
    async (r, user) => {
      const body = await req.json();
      const { projectId, workspaceId, path, content } = body;
      const targetId = projectId || workspaceId || 'diet-ghazipur';

      if (!targetId || !path || content === undefined) {
        return NextResponse.json({ error: 'Missing projectId, path, or content' }, { status: 400 });
      }

      try {
        writeWorkspaceFile(targetId, path, content);
        const ip = getClientIp(req);
        logAudit(user.email, 'File Saved', `Saved changes to ${path}`, `${targetId}/${path}`, ip, 'Success');
        return NextResponse.json({ success: true, message: 'File saved successfully' });
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    },
    'edit_code'
  );
}

export async function POST(req: NextRequest) {
  return secureApiHandler(
    req,
    async (r, user) => {
      const body = await req.json();
      const { projectId, workspaceId, path, isDirectory, action, srcPath, destPath } = body;
      const targetId = projectId || workspaceId || 'diet-ghazipur';
      const ip = getClientIp(req);

      if (action === 'copy') {
        if (!srcPath || !destPath) {
          return NextResponse.json({ error: 'srcPath and destPath are required for copy' }, { status: 400 });
        }
        try {
          copyWorkspaceItem(targetId, srcPath, destPath);
          logAudit(user.email, 'File Copied', `Copied ${srcPath} to ${destPath}`, `${targetId}/${destPath}`, ip, 'Success');
          return NextResponse.json({ success: true });
        } catch (err: any) {
          return NextResponse.json({ error: err.message }, { status: 400 });
        }
      }

      if (action === 'move') {
        if (!srcPath || !destPath) {
          return NextResponse.json({ error: 'srcPath and destPath are required for move' }, { status: 400 });
        }
        try {
          renameWorkspaceItem(targetId, srcPath, destPath);
          logAudit(user.email, 'File Moved', `Moved ${srcPath} to ${destPath}`, `${targetId}/${destPath}`, ip, 'Success');
          return NextResponse.json({ success: true });
        } catch (err: any) {
          return NextResponse.json({ error: err.message }, { status: 400 });
        }
      }

      if (!targetId || !path) {
        return NextResponse.json({ error: 'projectId and path are required' }, { status: 400 });
      }

      try {
        createWorkspaceItem(targetId, path, !!isDirectory);
        logAudit(
          user.email,
          isDirectory ? 'Folder Created' : 'File Created',
          `Created ${isDirectory ? 'directory' : 'file'} at ${path}`,
          `${targetId}/${path}`,
          ip,
          'Success'
        );
        return NextResponse.json({ success: true });
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    },
    'create_delete_files'
  );
}

export async function PATCH(req: NextRequest) {
  return secureApiHandler(
    req,
    async (r, user) => {
      const body = await req.json();
      const { projectId, workspaceId, oldPath, newPath } = body;
      const targetId = projectId || workspaceId || 'diet-ghazipur';

      if (!targetId || !oldPath || !newPath) {
        return NextResponse.json({ error: 'Missing parameters for rename' }, { status: 400 });
      }

      try {
        renameWorkspaceItem(targetId, oldPath, newPath);
        const ip = getClientIp(req);
        logAudit(user.email, 'File Renamed', `Renamed ${oldPath} to ${newPath}`, `${targetId}/${newPath}`, ip, 'Success');
        return NextResponse.json({ success: true });
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    },
    'create_delete_files'
  );
}

export async function DELETE(req: NextRequest) {
  return secureApiHandler(
    req,
    async (r, user) => {
      const body = await req.json();
      const { projectId, workspaceId, path } = body;
      const targetId = projectId || workspaceId || 'diet-ghazipur';

      if (!targetId || !path) {
        return NextResponse.json({ error: 'projectId and path are required' }, { status: 400 });
      }

      try {
        deleteWorkspaceItem(targetId, path);
        const ip = getClientIp(req);
        logAudit(user.email, 'File Deleted', `Deleted ${path}`, `${targetId}/${path}`, ip, 'Success');
        return NextResponse.json({ success: true });
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    },
    'create_delete_files'
  );
}
