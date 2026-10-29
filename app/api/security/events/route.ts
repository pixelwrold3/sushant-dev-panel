import { NextRequest, NextResponse } from 'next/server';
import { secureApiHandler } from '@/lib/api/handler';
import { getDatabase } from '@/lib/database/db';

export async function GET(req: NextRequest) {
  return secureApiHandler(
    req,
    async () => {
      const db = getDatabase();
      return NextResponse.json({ events: db.securityEvents.slice(0, 50) });
    },
    'manage_security'
  );
}

