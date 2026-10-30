import { NextRequest, NextResponse } from 'next/server';
import { checkRequest, recordRequestLog } from '../security/rateLimiter';
import { getCurrentUser } from '../auth/session';
import { PermissionAction, hasPermission, User } from '../auth/rbac';
import { getDatabase, saveDatabase } from '../database/db';

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp;
  return '127.0.0.1';
}

export function logAudit(user: string, action: string, details: string, target?: string, ip?: string, result: 'Success' | 'Failure' | 'Warning' = 'Success') {
  const db = getDatabase();
  db.auditLogs.unshift({
    id: `aud_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    timestamp: new Date().toISOString(),
    user,
    action,
    details,
    target,
    ip: ip || '127.0.0.1',
    result,
  });
  saveDatabase();
}

export async function secureApiHandler(
  req: NextRequest,
  handler: (req: NextRequest, user: User) => Promise<NextResponse>,
  requiredPermission?: PermissionAction,
  allowAnonymous: boolean = false
): Promise<NextResponse> {
  const startTime = Date.now();
  const ip = getClientIp(req);
  const method = req.method;
  const route = req.nextUrl.pathname;

  // 1. Rate Limit & IP block check
  const rateCheck = checkRequest(ip, method, route);
  if (!rateCheck.allowed) {
    const durationMs = Date.now() - startTime;
    recordRequestLog(ip, method, route, 429, durationMs, true, req.headers.get('user-agent') || undefined);

    return NextResponse.json(
      {
        error: rateCheck.blockedReason || 'Too Many Requests',
        rule: rateCheck.ruleName,
        resetSeconds: rateCheck.resetSeconds,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateCheck.resetSeconds || 60),
        },
      }
    );
  }

  // 2. Authentication check
  const user = getCurrentUser(req);
  if (!user && !allowAnonymous) {
    const durationMs = Date.now() - startTime;
    recordRequestLog(ip, method, route, 401, durationMs, false, req.headers.get('user-agent') || undefined);
    return NextResponse.json(
      { error: 'Unauthorized: Session missing or expired. Please sign in.' },
      { status: 401 }
    );
  }

  // 3. Permission check
  if (user && requiredPermission && !hasPermission(user.role, requiredPermission)) {
    const durationMs = Date.now() - startTime;
    recordRequestLog(ip, method, route, 403, durationMs, false, req.headers.get('user-agent') || undefined);

    const db = getDatabase();
    db.securityEvents.unshift({
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: new Date().toISOString(),
      user: user.email,
      ip,
      action: 'Permission Denied',
      reason: `User role ${user.role} attempted unauthorized action: ${requiredPermission}`,
      target: route,
      result: 'FAILED',
    });
    saveDatabase();

    return NextResponse.json(
      { error: `Forbidden: Missing required permission [${requiredPermission}]` },
      { status: 403 }
    );
  }

  // 4. Execute handler
  try {
    const response = await handler(req, user as User);
    const durationMs = Date.now() - startTime;
    recordRequestLog(ip, method, route, response.status, durationMs, false, req.headers.get('user-agent') || undefined);
    return response;
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    recordRequestLog(ip, method, route, 500, durationMs, false, req.headers.get('user-agent') || undefined);
    console.error(`API Error on ${method} ${route}:`, err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
