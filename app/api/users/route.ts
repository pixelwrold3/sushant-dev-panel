import { NextRequest, NextResponse } from 'next/server';
import { secureApiHandler, logAudit, getClientIp } from '@/lib/api/handler';
import { getDatabase, saveDatabase } from '@/lib/database/db';
import { UserRole } from '@/lib/auth/rbac';

export async function GET(req: NextRequest) {
  return secureApiHandler(
    req,
    async () => {
      const db = getDatabase();
      const users = db.users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        active: u.active,
        createdAt: u.createdAt,
        lastLogin: u.lastLogin,
      }));
      return NextResponse.json({ users });
    },
    'manage_users'
  );
}

export async function POST(req: NextRequest) {
  return secureApiHandler(
    req,
    async (r, user) => {
      const body = await req.json();
      const { name, email, role, password } = body;

      if (!name || !email || !role || !password) {
        return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
      }

      const db = getDatabase();
      if (db.users.some(u => u.email === email)) {
        return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 });
      }

      const validRoles: UserRole[] = ['OWNER', 'ADMIN', 'DEVELOPER', 'VIEWER'];
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: 'Invalid user role' }, { status: 400 });
      }

      const newUser = {
        id: `usr_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        name,
        email,
        passwordHash: password,
        role,
        active: true,
        createdAt: new Date().toISOString(),
      };

      db.users.push(newUser);
      saveDatabase();

      const ip = getClientIp(req);
      logAudit(user.email, 'User Created', `Created user ${name} (${email}) with role ${role}`, email, ip, 'Success');

      return NextResponse.json({ success: true, user: newUser });
    },
    'manage_users'
  );
}

export async function PATCH(req: NextRequest) {
  return secureApiHandler(
    req,
    async (r, user) => {
      const body = await req.json();
      const { id, role, active } = body;

      const db = getDatabase();
      const targetUser = db.users.find(u => u.id === id);
      if (!targetUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      if (role) targetUser.role = role;
      if (active !== undefined) targetUser.active = active;

      saveDatabase();
      const ip = getClientIp(req);
      logAudit(user.email, 'User Updated', `Updated role/status for ${targetUser.email}`, targetUser.email, ip, 'Success');

      return NextResponse.json({ success: true });
    },
    'manage_users'
  );
}

