import { NextRequest, NextResponse } from 'next/server';
import { secureApiHandler, logAudit, getClientIp } from '@/lib/api/handler';
import {
  listTrash,
  moveToTrash,
  restoreFromTrash,
  deletePermanent,
  emptyTrash,
} from '@/lib/filesystem/trash';

export async function GET(req: NextRequest) {
  return secureApiHandler(
    req,
    async () => {
      const { searchParams } = new URL(req.url);
      const projectId = searchParams.get('projectId') || searchParams.get('workspaceId') || 'diet-ghazipur';

      try {
        const items = listTrash(projectId);
        return NextResponse.json({ items });
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    },
    'view_code'
  );
}

export async function POST(req: NextRequest) {
  return secureApiHandler(
    req,
    async (r, user) => {
      const body = await req.json();
      const { projectId, workspaceId, action, path: itemPath, trashId } = body;
      const targetId = projectId || workspaceId || 'diet-ghazipur';
      const ip = getClientIp(req);

      try {
        if (action === 'trash') {
          if (!itemPath) return NextResponse.json({ error: 'path is required to trash' }, { status: 400 });
          const trashed = moveToTrash(targetId, itemPath, user.email);
          logAudit(user.email, 'File Moved to Trash', `Moved ${itemPath} to Recycle Bin`, `${targetId}/${itemPath}`, ip, 'Success');
          return NextResponse.json({ success: true, item: trashed });
        }

        if (action === 'restore') {
          if (!trashId) return NextResponse.json({ error: 'trashId is required to restore' }, { status: 400 });
          const restored = restoreFromTrash(targetId, trashId);
          logAudit(user.email, 'File Restored', `Restored ${restored.name} to ${restored.originalPath}`, `${targetId}/${restored.originalPath}`, ip, 'Success');
          return NextResponse.json({ success: true, item: restored });
        }

        if (action === 'delete_permanent') {
          if (!trashId) return NextResponse.json({ error: 'trashId is required' }, { status: 400 });
          deletePermanent(targetId, trashId);
          logAudit(user.email, 'Permanent Delete', `Permanently deleted trash item ${trashId}`, `${targetId}`, ip, 'Success');
          return NextResponse.json({ success: true });
        }

        if (action === 'empty') {
          emptyTrash(targetId);
          logAudit(user.email, 'Recycle Bin Emptied', `Emptied all recycle bin items for ${targetId}`, `${targetId}`, ip, 'Success');
          return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: `Unknown trash action: ${action}` }, { status: 400 });
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    },
    'create_delete_files'
  );
}
