import { NextRequest, NextResponse } from 'next/server';
import { secureApiHandler } from '@/lib/api/handler';
import { getCurrentUser } from '@/lib/auth/session';
import { getDatabase } from '@/lib/database/db';

export async function GET(req: NextRequest) {
  return secureApiHandler(req, async () => {
    const user = getCurrentUser(req);
    const db = getDatabase();
    return NextResponse.json({
      user,
      availableUsers: db.users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role })),
    });
  });
}

