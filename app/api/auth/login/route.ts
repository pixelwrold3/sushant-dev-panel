import { NextRequest, NextResponse } from 'next/server';
import { secureApiHandler, getClientIp, logAudit } from '@/lib/api/handler';
import { getDatabase, saveDatabase } from '@/lib/database/db';

export async function POST(req: NextRequest) {
  return secureApiHandler(req, async () => {
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

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  });
}

