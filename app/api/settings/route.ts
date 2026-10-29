import { NextRequest, NextResponse } from 'next/server';
import { secureApiHandler, logAudit, getClientIp } from '@/lib/api/handler';
import { getDatabase, saveDatabase } from '@/lib/database/db';

export async function GET(req: NextRequest) {
  return secureApiHandler(
    req,
    async () => {
      const db = getDatabase();
      return NextResponse.json({ settings: db.settings });
    },
    'manage_settings'
  );
}

export async function PUT(req: NextRequest) {
  return secureApiHandler(
    req,
    async (r, user) => {
      const body = await req.json();
      const db = getDatabase();

      db.settings = {
        ...db.settings,
        ...body,
      };

      saveDatabase();
      const ip = getClientIp(req);
      logAudit(user.email, 'Settings Updated', 'Updated security and system settings', 'Settings', ip, 'Success');

      return NextResponse.json({ success: true, settings: db.settings });
    },
    'manage_settings'
  );
}

