import { NextRequest, NextResponse } from 'next/server';
import { secureApiHandler } from '@/lib/api/handler';
import { getDatabase } from '@/lib/database/db';

export async function GET(req: NextRequest) {
  return secureApiHandler(
    req,
    async () => {
      const db = getDatabase();
      return NextResponse.json({ auditLogs: db.auditLogs.slice(0, 100) });
    },
    'view_audit_logs'
  );
}

