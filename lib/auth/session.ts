import { NextRequest } from 'next/server';
import { User, UserRole, hasPermission, PermissionAction } from './rbac';
import { getDatabase } from '../database/db';

export function getSessionToken(req?: NextRequest): string | null {
  if (!req) return null;
  // Check cookie or header
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(/devpanel_session=([^;]+)/);
  if (match) return decodeURIComponent(match[1]);

  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  const customHeader = req.headers.get('x-session-token');
  if (customHeader) return customHeader;

  return null;
}

export function getCurrentUser(req?: NextRequest): User | null {
  const token = getSessionToken(req);
  if (!token) {
    return null;
  }

  try {
    // Session token format: base64(email:timestamp:signature)
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [email, expiresAt] = decoded.split(':::');

    if (!email || !expiresAt) return null;

    if (Date.now() > parseInt(expiresAt, 10)) {
      return null; // Expired
    }

    const db = getDatabase();
    const found = db.users.find(u => u.email === email && u.active);
    if (!found) return null;

    return {
      id: found.id,
      name: found.name,
      email: found.email,
      role: found.role,
      active: found.active,
      createdAt: found.createdAt,
      lastLogin: found.lastLogin,
    };
  } catch {
    return null;
  }
}

export function createSessionToken(email: string, timeoutMinutes: number = 1440): string {
  const expiresAt = Date.now() + timeoutMinutes * 60 * 1000;
  return Buffer.from(`${email}:::${expiresAt}`).toString('base64');
}

export function authorize(req: NextRequest, action: PermissionAction): { authorized: boolean; user: User | null; error?: string } {
  const user = getCurrentUser(req);
  if (!user) {
    return {
      authorized: false,
      user: null,
      error: 'Authentication Required: Please sign in to access DevPanel.',
    };
  }

  if (!hasPermission(user.role, action)) {
    return {
      authorized: false,
      user,
      error: `Access Denied: Role "${user.role}" does not have permission "${action}".`,
    };
  }
  return { authorized: true, user };
}
