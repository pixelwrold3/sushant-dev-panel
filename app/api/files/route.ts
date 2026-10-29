import { NextRequest, NextResponse } from 'next/server';
import { secureApiHandler, logAudit, getClientIp } from '@/lib/api/handler';
import {
  listWorkspaceFiles,
  readWorkspaceFile,
  writeWorkspaceFile,
  createWorkspaceItem,
  renameWorkspaceItem,
  deleteWorkspaceItem,
} from '@/lib/filesystem/workspace';

export async function GET(req: NextRequest) {
  return secureApiHandler(
    req,
    async (r) => {
      const { searchParams } = new URL(req.url);
      const workspaceId = searchParams.get('workspaceId') || 'main-website';
      const filePath = searchParams.get('path');

      try {
        if (filePath !== null && filePath !== undefined && filePath !== '') {
          // Read specific file content
          const content = readWorkspaceFile(workspaceId, filePath);
          return NextResponse.json({ content, path: filePath });
        } else {
          // List directory tree
          const tree = listWorkspaceFiles(workspaceId);
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
      const { workspaceId, path, content } = body;

      if (!workspaceId || !path || content === undefined) {
        return NextResponse.json({ error: 'Missing workspaceId, path, or content' }, { status: 400 });
      }

      try {
        writeWorkspaceFile(workspaceId, path, content);
        const ip = getClientIp(req);
        logAudit(user.email, 'File Saved', `Saved changes to ${path}`, `${workspaceId}/${path}`, ip, 'Success');
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
      const { workspaceId, path, isDirectory } = body;

      if (!workspaceId || !path) {
        return NextResponse.json({ error: 'workspaceId and path are required' }, { status: 400 });
      }

      try {
        createWorkspaceItem(workspaceId, path, !!isDirectory);
        const ip = getClientIp(req);
        logAudit(
          user.email,
          isDirectory ? 'Folder Created' : 'File Created',
          `Created ${isDirectory ? 'directory' : 'file'} at ${path}`,
          `${workspaceId}/${path}`,
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
      const { workspaceId, oldPath, newPath } = body;

      if (!workspaceId || !oldPath || !newPath) {
        return NextResponse.json({ error: 'Missing parameters for rename' }, { status: 400 });
      }

      try {
        renameWorkspaceItem(workspaceId, oldPath, newPath);
        const ip = getClientIp(req);
        logAudit(user.email, 'File Renamed', `Renamed ${oldPath} to ${newPath}`, `${workspaceId}/${newPath}`, ip, 'Success');
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
      const { workspaceId, path } = body;

      if (!workspaceId || !path) {
        return NextResponse.json({ error: 'workspaceId and path are required' }, { status: 400 });
      }

      try {
        deleteWorkspaceItem(workspaceId, path);
        const ip = getClientIp(req);
        logAudit(user.email, 'File Deleted', `Deleted ${path}`, `${workspaceId}/${path}`, ip, 'Success');
        return NextResponse.json({ success: true });
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    },
    'create_delete_files'
  );
}

