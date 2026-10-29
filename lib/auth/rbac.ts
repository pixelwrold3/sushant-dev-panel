export type UserRole = 'OWNER' | 'ADMIN' | 'DEVELOPER' | 'VIEWER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  active: boolean;
  createdAt: string;
  lastLogin?: string;
}

export type PermissionAction =
  | 'view_dashboard'
  | 'view_monitoring'
  | 'view_code'
  | 'edit_code'
  | 'create_delete_files'
  | 'use_terminal'
  | 'git_read'
  | 'git_commit_push'
  | 'git_clone'
  | 'manage_security'
  | 'manage_ips'
  | 'view_audit_logs'
  | 'manage_users'
  | 'manage_settings'
  | 'server_actions'
  | 'deploy';

const ROLE_PERMISSIONS: Record<UserRole, PermissionAction[]> = {
  OWNER: [
    'view_dashboard',
    'view_monitoring',
    'view_code',
    'edit_code',
    'create_delete_files',
    'use_terminal',
    'git_read',
    'git_commit_push',
    'git_clone',
    'manage_security',
    'manage_ips',
    'view_audit_logs',
    'manage_users',
    'manage_settings',
    'server_actions',
    'deploy',
  ],
  ADMIN: [
    'view_dashboard',
    'view_monitoring',
    'view_code',
    'edit_code',
    'create_delete_files',
    'use_terminal',
    'git_read',
    'git_commit_push',
    'git_clone',
    'manage_security',
    'manage_ips',
    'view_audit_logs',
    'manage_users',
    'manage_settings',
    'server_actions',
    'deploy',
  ],
  DEVELOPER: [
    'view_dashboard',
    'view_monitoring',
    'view_code',
    'edit_code',
    'create_delete_files',
    'use_terminal',
    'git_read',
    'git_commit_push',
    'git_clone',
  ],
  VIEWER: [
    'view_dashboard',
    'view_monitoring',
    'view_code',
    'git_read',
  ],
};

export function hasPermission(role: UserRole, action: PermissionAction): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(action);
}

