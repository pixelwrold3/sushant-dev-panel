import { NextRequest } from 'next/server';
import { User, UserRole, hasPermission, PermissionAction } from './rbac';
import { getDatabase } from '../database/db';

export function getCurrentUser(req?: NextRequest): User {
  // Check auth header or cookie, or default to current active session user
  const db = getDatabase();
  const email = req?.headers.get('x-user-email') || 'admin@devpanel.local';
  const found = db.users.find(u => u.email === email && u.active);

  if (found) {
    return {
      id: found.id,
      name: found.name,
      email: found.email,
      role: found.role,
      active: found.active,
      createdAt: found.createdAt,
      lastLogin: found.lastLogin,
    };
  }

  // Fallback default admin
  return {
    id: 'usr_admin',
    name: 'System Admin',
    email: 'admin@devpanel.local',
    role: 'OWNER',
    active: true,
    createdAt: new Date().toISOString(),
  };
}

export function authorize(req: NextRequest, action: PermissionAction): { authorized: boolean; user: User; error?: string } {
  const user = getCurrentUser(req);
  if (!hasPermission(user.role, action)) {
    return {
      authorized: false,
      user,
      error: `Access Denied: Role "${user.role}" does not have permission "${action}".`,
    };
  }
  return { authorized: true, user };
}

