import fs from 'fs';
import path from 'path';

export interface SecurityRule {
  id: string;
  name: string;
  route: string;
  method: 'ALL' | 'GET' | 'POST' | 'PUT' | 'DELETE';
  threshold: number; // max requests
  windowSeconds: number; // in seconds
  action: 'block' | 'alert' | 'throttle';
  blockDurationMinutes: number; // 0 for permanent
  enabled: boolean;
  createdAt: string;
}

export interface IPRecord {
  id: string;
  ip: string;
  type: 'temporary' | 'permanent' | 'allowlist';
  reason: string;
  status: 'active' | 'expired' | 'removed';
  createdAt: string;
  expiresAt?: string | null;
  requestCount?: number;
  blockedCount?: number;
  lastRequest?: string;
  routesHit?: string[];
}

export interface SecurityEvent {
  id: string;
  timestamp: string;
  user?: string;
  ip: string;
  action: string;
  reason: string;
  target: string;
  result: 'BLOCKED' | 'FLAGGED' | 'ALLOWED' | 'SUCCESS' | 'FAILED';
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
  target?: string;
  ip?: string;
  result: 'Success' | 'Failure' | 'Warning';
}

export interface WorkspaceRecord {
  id: string;
  name: string;
  repoUrl?: string;
  branch: string;
  path: string;
  createdAt: string;
  lastActive: string;
  status: 'ready' | 'cloning' | 'error';
}

export interface RequestRecord {
  id: string;
  timestamp: string;
  ip: string;
  method: string;
  route: string;
  status: number;
  durationMs: number;
  blocked: boolean;
  userAgent?: string;
}

export interface PanelSettings {
  rateLimitingEnabled: boolean;
  ipBlockingEnabled: boolean;
  auditLogsEnabled: boolean;
  secureHeadersEnabled: boolean;
  loginProtectionEnabled: boolean;
  sessionTimeoutMinutes: number;
  maxLoginAttempts: number;
  loginLockoutMinutes: number;
  requestLogRetentionDays: number;
  securityEventRetentionDays: number;
  autoBlockRepeatOffenders: boolean;
  repeatOffenderEscalation: number[]; // e.g. [5, 15, 60, 360, 1440]
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'local-db.json');

interface DatabaseSchema {
  users: Array<{
    id: string;
    name: string;
    email: string;
    passwordHash: string;
    role: 'OWNER' | 'ADMIN' | 'DEVELOPER' | 'VIEWER';
    active: boolean;
    createdAt: string;
    lastLogin?: string;
  }>;
  workspaces: WorkspaceRecord[];
  securityRules: SecurityRule[];
  ipRecords: IPRecord[];
  securityEvents: SecurityEvent[];
  auditLogs: AuditLog[];
  requestLogs: RequestRecord[];
  settings: PanelSettings;
}

const DEFAULT_SETTINGS: PanelSettings = {
  rateLimitingEnabled: true,
  ipBlockingEnabled: true,
  auditLogsEnabled: true,
  secureHeadersEnabled: true,
  loginProtectionEnabled: true,
  sessionTimeoutMinutes: 60,
  maxLoginAttempts: 5,
  loginLockoutMinutes: 15,
  requestLogRetentionDays: 7,
  securityEventRetentionDays: 30,
  autoBlockRepeatOffenders: true,
  repeatOffenderEscalation: [5, 15, 60, 360, 1440],
};

const DEFAULT_DB: DatabaseSchema = {
  users: [
    {
      id: 'usr_admin',
      name: 'System Admin',
      email: 'admin@devpanel.local',
      passwordHash: 'adminpassword123', // In real app salted hash
      role: 'OWNER',
      active: true,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    },
    {
      id: 'usr_dev1',
      name: 'Dev Lead',
      email: 'lead@devpanel.local',
      passwordHash: 'devpassword123',
      role: 'DEVELOPER',
      active: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'usr_viewer',
      name: 'Auditor',
      email: 'viewer@devpanel.local',
      passwordHash: 'viewpassword123',
      role: 'VIEWER',
      active: true,
      createdAt: new Date().toISOString(),
    }
  ],
  workspaces: [
    {
      id: 'main-website',
      name: 'Main Application Project',
      repoUrl: 'https://github.com/example/main-website.git',
      branch: 'main',
      path: 'main-website',
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      status: 'ready',
    }
  ],
  securityRules: [
    {
      id: 'rule_global',
      name: 'Global DDoS / Brute Force Rate Limit',
      route: '*',
      method: 'ALL',
      threshold: 120,
      windowSeconds: 60,
      action: 'block',
      blockDurationMinutes: 15,
      enabled: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'rule_login',
      name: 'Login Brute Force Protection',
      route: '/api/auth/login',
      method: 'POST',
      threshold: 5,
      windowSeconds: 60,
      action: 'block',
      blockDurationMinutes: 30,
      enabled: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'rule_api_heavy',
      name: 'API Abuse Protection',
      route: '/api/*',
      method: 'ALL',
      threshold: 60,
      windowSeconds: 60,
      action: 'throttle',
      blockDurationMinutes: 10,
      enabled: true,
      createdAt: new Date().toISOString(),
    }
  ],
  ipRecords: [
    {
      id: 'ip_1',
      ip: '185.220.101.5',
      type: 'temporary',
      reason: 'Rate limit violation on /api/login',
      status: 'active',
      createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 18).toISOString(),
      requestCount: 420,
      blockedCount: 45,
      lastRequest: new Date().toISOString(),
      routesHit: ['/api/login', '/admin'],
    },
    {
      id: 'ip_2',
      ip: '103.145.74.12',
      type: 'permanent',
      reason: 'Automated vulnerability scanner probing /wp-admin',
      status: 'active',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      expiresAt: null,
      requestCount: 1890,
      blockedCount: 1890,
      lastRequest: new Date().toISOString(),
      routesHit: ['/wp-admin', '/.env', '/config.json'],
    },
    {
      id: 'ip_3',
      ip: '127.0.0.1',
      type: 'allowlist',
      reason: 'Localhost / Admin machine',
      status: 'active',
      createdAt: new Date().toISOString(),
      expiresAt: null,
      requestCount: 24,
      blockedCount: 0,
      lastRequest: new Date().toISOString(),
      routesHit: ['/'],
    }
  ],
  securityEvents: [
    {
      id: 'evt_1',
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      ip: '185.220.101.5',
      action: 'Rate limit exceeded',
      reason: 'Triggered rule: Login Brute Force Protection (5 req/min)',
      target: '/api/auth/login',
      result: 'BLOCKED'
    },
    {
      id: 'evt_2',
      timestamp: new Date(Date.now() - 1000 * 60 * 22).toISOString(),
      ip: '103.145.74.12',
      action: 'Malicious path probe',
      reason: 'Attempted access to sensitive configuration path',
      target: '/.env',
      result: 'BLOCKED'
    },
    {
      id: 'evt_3',
      timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      ip: '127.0.0.1',
      user: 'admin@devpanel.local',
      action: 'Admin Authentication',
      reason: 'Dashboard sign-in',
      target: '/dashboard',
      result: 'SUCCESS'
    }
  ],
  auditLogs: [
    {
      id: 'aud_1',
      timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
      user: 'admin@devpanel.local',
      action: 'IP Blocked',
      details: 'Temporarily blocked 185.220.101.5 for 30 minutes',
      target: '185.220.101.5',
      ip: '127.0.0.1',
      result: 'Success',
    },
    {
      id: 'aud_2',
      timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
      user: 'lead@devpanel.local',
      action: 'Git Push',
      details: 'Pushed commit to branch main (feat: authentication middleware)',
      target: 'main-website',
      ip: '127.0.0.1',
      result: 'Success',
    },
    {
      id: 'aud_3',
      timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
      user: 'admin@devpanel.local',
      action: 'Security Rule Created',
      details: 'Added rule "Login Brute Force Protection"',
      target: '/api/auth/login',
      ip: '127.0.0.1',
      result: 'Success',
    }
  ],
  requestLogs: [],
  settings: DEFAULT_SETTINGS,
};

// In-memory cache synced with disk
let dbCache: DatabaseSchema | null = null;

function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function getDatabase(): DatabaseSchema {
  if (dbCache) return dbCache;

  ensureDataDirectory();

  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      dbCache = JSON.parse(raw);
      // Ensure any newly added fields exist
      if (!dbCache?.settings) dbCache!.settings = DEFAULT_SETTINGS;
      if (!dbCache?.users) dbCache!.users = DEFAULT_DB.users;
      if (!dbCache?.workspaces) dbCache!.workspaces = DEFAULT_DB.workspaces;
      if (!dbCache?.securityRules) dbCache!.securityRules = DEFAULT_DB.securityRules;
      if (!dbCache?.ipRecords) dbCache!.ipRecords = DEFAULT_DB.ipRecords;
      if (!dbCache?.securityEvents) dbCache!.securityEvents = DEFAULT_DB.securityEvents;
      if (!dbCache?.auditLogs) dbCache!.auditLogs = DEFAULT_DB.auditLogs;
      if (!dbCache?.requestLogs) dbCache!.requestLogs = [];
      return dbCache!;
    } catch (err) {
      console.error('Error reading local db file, initializing default:', err);
    }
  }

  dbCache = JSON.parse(JSON.stringify(DEFAULT_DB));
  saveDatabase();
  return dbCache!;
}

export function saveDatabase(): void {
  if (!dbCache) return;
  ensureDataDirectory();
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbCache, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write to local db file:', err);
  }
}

