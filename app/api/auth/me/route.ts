import { NextRequest, NextResponse } from 'next/server';
import { secureApiHandler } from '@/lib/api/handler';
import { getCurrentUser } from '@/lib/auth/session';
import { getDatabase } from '@/lib/database/db';

export async function GET(req: NextRequest) {
  // Allow anonymous check so client knows if it should redirect to /login
  return secureApiHandler(
    req,
    async () => {
      const user = getCurrentUser(req);
      if (!user) {
        return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
      }

      const db = getDatabase();
      return NextResponse.json({
        authenticated: true,
        user,
        availableUsers: db.users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role })),
      });
    },
    undefined,
    true // allowAnonymous
  );
}
