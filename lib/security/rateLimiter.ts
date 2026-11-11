import { getDatabase, saveDatabase, IPRecord, SecurityEvent, RequestRecord } from '../database/db';
import { blockIpAtKernel, unblockIpAtKernel } from './kernelFirewall';

interface RateTracker {
  timestamps: number[];
  violations: number;
}

// In-memory sliding window request store for quick rate limit evaluations
const ipRequestWindow = new Map<string, RateTracker>();

export interface CheckResult {
  allowed: boolean;
  blockedReason?: string;
  remaining?: number;
  resetSeconds?: number;
  ruleName?: string;
}

let lastCleanupTime = 0;
const CLEANUP_INTERVAL_MS = 60000;

/**
 * Clean up expired temporary IP blocks periodically (throttled to at most once a minute)
 */
export function cleanupExpiredBlocks() {
  const now = Date.now();
  if (now - lastCleanupTime < CLEANUP_INTERVAL_MS) {
    return;
  }
  lastCleanupTime = now;

  const db = getDatabase();
  let modified = false;

  for (const record of db.ipRecords) {
    if (record.status === 'active' && record.type === 'temporary' && record.expiresAt) {
      const exp = new Date(record.expiresAt).getTime();
      if (exp <= now) {
        record.status = 'expired';
        modified = true;
        unblockIpAtKernel(record.ip).catch(() => {});
        db.securityEvents.unshift({
          id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          timestamp: new Date().toISOString(),
          ip: record.ip,
          action: 'IP Unblocked (Automatic)',
          reason: 'Temporary block duration expired',
          target: 'IP Access',
          result: 'ALLOWED',
        });
      }
    }
  }

  if (modified) {
    saveDatabase();
  }
}

/**
 * Checks an incoming request against IP Allowlist, IP Blocklist, and Rate Limiting Rules.
 */
export function checkRequest(ip: string, method: string, route: string): CheckResult {
  cleanupExpiredBlocks();
  const db = getDatabase();
  const settings = db.settings;

  // 1. Check IP allowlist
  const allowRecord = db.ipRecords.find(r => r.ip === ip && r.type === 'allowlist' && r.status === 'active');
  if (allowRecord) {
    allowRecord.requestCount = (allowRecord.requestCount || 0) + 1;
    allowRecord.lastRequest = new Date().toISOString();
    return { allowed: true };
  }

  // 2. Check if IP is currently blocked
  if (settings.ipBlockingEnabled) {
    const blockRecord = db.ipRecords.find(r => r.ip === ip && (r.type === 'permanent' || r.type === 'temporary') && r.status === 'active');
    if (blockRecord) {
      blockRecord.requestCount = (blockRecord.requestCount || 0) + 1;
      blockRecord.blockedCount = (blockRecord.blockedCount || 0) + 1;
      blockRecord.lastRequest = new Date().toISOString();
      if (!blockRecord.routesHit) blockRecord.routesHit = [];
      if (!blockRecord.routesHit.includes(route)) blockRecord.routesHit.push(route);

      return {
        allowed: false,
        blockedReason: `IP is blocked: ${blockRecord.reason}`,
      };
    }
  }

  // 3. Evaluate Rate Limiting rules
  if (settings.rateLimitingEnabled) {
    const now = Date.now();
    const activeRules = db.securityRules.filter(r => r.enabled);

    for (const rule of activeRules) {
      const routeMatches = rule.route === '*' || route === rule.route || (rule.route.endsWith('/*') && route.startsWith(rule.route.slice(0, -2)));
      const methodMatches = rule.method === 'ALL' || rule.method.toUpperCase() === method.toUpperCase();

      if (routeMatches && methodMatches) {
        const trackerKey = `${ip}::${rule.id}`;
        let tracker = ipRequestWindow.get(trackerKey);
        if (!tracker) {
          tracker = { timestamps: [], violations: 0 };
          ipRequestWindow.set(trackerKey, tracker);
        }

        const windowStart = now - (rule.windowSeconds * 1000);
        tracker.timestamps = tracker.timestamps.filter(t => t > windowStart);
        tracker.timestamps.push(now);

        if (tracker.timestamps.length > rule.threshold) {
          tracker.violations += 1;

          let blockMins = rule.blockDurationMinutes;
          if (settings.autoBlockRepeatOffenders && settings.repeatOffenderEscalation.length > 0) {
            const index = Math.min(tracker.violations - 1, settings.repeatOffenderEscalation.length - 1);
            blockMins = settings.repeatOffenderEscalation[index];
          }

          const expiresAt = blockMins > 0 ? new Date(now + blockMins * 60 * 1000).toISOString() : null;

          let ipRec = db.ipRecords.find(r => r.ip === ip);
          if (ipRec) {
            ipRec.status = 'active';
            ipRec.type = blockMins === 0 ? 'permanent' : 'temporary';
            ipRec.reason = `Rate limit violation on rule "${rule.name}" (${tracker.timestamps.length} reqs / ${rule.windowSeconds}s)`;
            ipRec.expiresAt = expiresAt;
            ipRec.blockedCount = (ipRec.blockedCount || 0) + 1;
            ipRec.lastRequest = new Date().toISOString();
          } else {
            db.ipRecords.unshift({
              id: `ip_${Date.now()}_${Math.random().toString(36).substring(7)}`,
              ip,
              type: blockMins === 0 ? 'permanent' : 'temporary',
              reason: `Rate limit exceeded: ${rule.name}`,
              status: 'active',
              createdAt: new Date().toISOString(),
              expiresAt,
              requestCount: tracker.timestamps.length,
              blockedCount: 1,
              lastRequest: new Date().toISOString(),
              routesHit: [route],
            });
          }

          db.securityEvents.unshift({
            id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            timestamp: new Date().toISOString(),
            ip,
            action: 'Rate limit exceeded',
            reason: `Exceeded ${rule.threshold} req / ${rule.windowSeconds}s on ${route}`,
            target: route,
            result: 'BLOCKED',
          });

          saveDatabase();

          // Drop IP instantly at kernel level via Go agent so CPU stays at ~0%
          blockIpAtKernel(ip, `Rate limit exceeded: ${rule.name}`).catch(() => {});

          return {
            allowed: false,
            blockedReason: `Rate limit exceeded for rule "${rule.name}". IP blocked for ${blockMins} minutes.`,
            ruleName: rule.name,
            resetSeconds: blockMins * 60,
          };
        }
      }
    }
  }

  return { allowed: true };
}

/**
 * Records request analytics
 */
export function recordRequestLog(ip: string, method: string, route: string, status: number, durationMs: number, blocked: boolean, userAgent?: string) {
  const db = getDatabase();
  const entry: RequestRecord = {
    id: `req_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    timestamp: new Date().toISOString(),
    ip,
    method,
    route,
    status,
    durationMs,
    blocked,
    userAgent: userAgent?.slice(0, 80),
  };

  db.requestLogs.unshift(entry);

  if (db.requestLogs.length > 300) {
    db.requestLogs = db.requestLogs.slice(0, 300);
  }
}
