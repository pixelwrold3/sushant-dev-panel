import { NextRequest, NextResponse } from 'next/server';
import { secureApiHandler, getClientIp, logAudit } from '@/lib/api/handler';
import { getDatabase, saveDatabase } from '@/lib/database/db';
import { createSessionToken } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  // Allow anonymous access for login
  return secureApiHandler(
    req,
    async () => {
      const body = await req.json();
      const { email, password } = body;
      const ip = getClientIp(req);
      const db = getDatabase();

      const user = db.users.find(u => u.email === email && u.active);
      if (!user || user.passwordHash !== password) {
        db.securityEvents.unshift({
          id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          timestamp: new Date().toISOString(),
          user: email || 'unknown',
          ip,
          action: 'Failed login attempt',
          reason: 'Invalid credentials provided',
          target: '/api/auth/login',
          result: 'FAILED',
        });
        saveDatabase();

        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
      }

      user.lastLogin = new Date().toISOString();
      logAudit(user.email, 'Login', `User signed into panel from ${ip}`, '/dashboard', ip, 'Success');

      db.securityEvents.unshift({
        id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        timestamp: new Date().toISOString(),
        user: user.email,
        ip,
        action: 'Successful login',
        reason: 'Authenticated session',
        target: '/dashboard',
        result: 'SUCCESS',
      });
      saveDatabase();

      const token = createSessionToken(user.email, db.settings.sessionTimeoutMinutes || 1440);

      const response = NextResponse.json({
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });

      // Set HTTP-only session cookie
      response.cookies.set('devpanel_session', token, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: (db.settings.sessionTimeoutMinutes || 1440) * 60,
      });

      return response;
    },
    undefined,
    true // allowAnonymous
  );
}
