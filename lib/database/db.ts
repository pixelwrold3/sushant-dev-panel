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

export interface ChatAttachment {
  id: string;
  name: string;
  type: 'image' | 'file';
  size: number;
  url: string; // Base64 or local URL
}

export interface ChatMessage {
  id: string;
  senderEmail: string;
  senderName: string;
  senderRole?: string;
  recipientEmail?: string | null; // null = public channel, email = direct message
  content: string;
  attachments?: ChatAttachment[];
  timestamp: string;
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

export interface ProjectRecord {
  id: string;
  name: string;
  type: 'connected' | 'sandbox';
  path: string; // Absolute directory on the server e.g. /var/www/diet-website
  repoUrl?: string;
  branch: string;
  runtime?: 'Node.js' | 'Python' | 'Docker' | 'Static' | 'Other';
  buildCommand?: string;
  restartCommand?: string;
  systemdService?: string;
  autoStart?: boolean;
  createdAt: string;
  lastActive: string;
  status: 'ready' | 'cloning' | 'error';
}

export interface PullHistoryRecord {
  id: string;
  projectId: string;
  timestamp: string;
  user: string;
  fromCommit: string;
  toCommit: string;
  branch: string;
  status: 'active' | 'undone';
  envProtected: boolean;
  affectedFiles?: string[];
  revertedAt?: string;
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
  repeatOffenderEscalation: number[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'local-db.json');

export interface DatabaseSchema {
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
  projects: ProjectRecord[];
  workspaces?: ProjectRecord[];
  pullHistory?: PullHistoryRecord[];
  securityRules: SecurityRule[];
  ipRecords: IPRecord[];
  securityEvents: SecurityEvent[];
  auditLogs: AuditLog[];
  requestLogs: RequestRecord[];
  chatMessages?: ChatMessage[];
  onlineUsers?: Record<string, { email: string; name: string; role: string; lastSeen: string }>;
  settings: PanelSettings;
}

const DEFAULT_SETTINGS: PanelSettings = {
  rateLimitingEnabled: true,
  ipBlockingEnabled: true,
  auditLogsEnabled: true,
  secureHeadersEnabled: true,
  loginProtectionEnabled: true,
  sessionTimeoutMinutes: 1440,
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
      passwordHash: 'adminpassword123',
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
  ],
  projects: [
    {
      id: 'diet-ghazipur',
      name: 'Diet Ghazipur',
      type: 'connected',
      path: '/var/www/diet-website',
      repoUrl: 'https://github.com/diet-ghazipur/diet-website.git',
      branch: 'main',
      runtime: 'Node.js',
      buildCommand: 'npm run build',
      restartCommand: 'systemctl restart diet-website',
      systemdService: 'diet-website',
      autoStart: true,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      status: 'ready',
    },
    {
      id: 'dev',
      name: 'Dev (Temp Testing)',
      type: 'connected',
      path: '/var/www/dev',
      repoUrl: '',
      branch: 'main',
      runtime: 'Node.js',
      buildCommand: 'npm run build',
      restartCommand: '',
      systemdService: '',
      autoStart: false,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      status: 'ready',
    },
    {
      id: 'main-website',
      name: 'Sandbox Project',
      type: 'sandbox',
      path: './workspaces/main-website',
      branch: 'main',
      runtime: 'Node.js',
      buildCommand: 'npm run build',
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      status: 'ready',
    },
  ],
  pullHistory: [],
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
  ],
  ipRecords: [
    {
      id: 'ip_1',
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
    },
  ],
  securityEvents: [],
  auditLogs: [],
  requestLogs: [],
  settings: DEFAULT_SETTINGS,
};

let dbCache: DatabaseSchema | null = null;
let saveDebounceTimer: NodeJS.Timeout | null = null;

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
      if (!dbCache?.settings) dbCache!.settings = DEFAULT_SETTINGS;
      if (!dbCache?.users) dbCache!.users = DEFAULT_DB.users;

      if (!dbCache?.projects) {
        if (dbCache?.workspaces && Array.isArray(dbCache.workspaces)) {
          dbCache.projects = dbCache.workspaces.map(w => ({
            ...w,
            type: w.type || (w.path.startsWith('/') ? 'connected' : 'sandbox'),
          }));
        } else {
          dbCache!.projects = DEFAULT_DB.projects;
        }
      }

      if (!dbCache?.projects.some(p => p.id === 'diet-ghazipur' || p.path === '/var/www/diet-website')) {
        dbCache!.projects.unshift(DEFAULT_DB.projects[0]);
      }

      if (!dbCache?.projects.some(p => p.id === 'dev' || p.path === '/var/www/dev')) {
        const devProj = DEFAULT_DB.projects.find(p => p.id === 'dev');
        if (devProj) {
          dbCache!.projects.push(devProj);
        }
      }

      if (!dbCache?.pullHistory) dbCache!.pullHistory = [];
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
  saveDatabaseSync();
  return dbCache!;
}

export function saveDatabase(): void {
  if (!dbCache) return;
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer);
  }

  saveDebounceTimer = setTimeout(() => {
    saveDatabaseSync();
  }, 1000);
}

export function saveDatabaseSync(): void {
  if (!dbCache) return;
  ensureDataDirectory();
  try {
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(dbCache, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Failed to write to local db file:', err);
  }
}
