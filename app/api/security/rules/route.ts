import { NextRequest, NextResponse } from 'next/server';
import { secureApiHandler, logAudit, getClientIp } from '@/lib/api/handler';
import { getDatabase, saveDatabase, SecurityRule } from '@/lib/database/db';

export async function GET(req: NextRequest) {
  return secureApiHandler(
    req,
    async () => {
      const db = getDatabase();
      return NextResponse.json({ rules: db.securityRules });
    },
    'manage_security'
  );
}

export async function POST(req: NextRequest) {
  return secureApiHandler(
    req,
    async (r, user) => {
      const body = await req.json();
      const { name, route, method, threshold, windowSeconds, action, blockDurationMinutes } = body;

      if (!name || !route || !threshold || !windowSeconds) {
        return NextResponse.json({ error: 'Missing required rule fields' }, { status: 400 });
      }

      const db = getDatabase();
      const newRule: SecurityRule = {
        id: `rule_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        name,
        route,
        method: method || 'ALL',
        threshold: parseInt(threshold, 10),
        windowSeconds: parseInt(windowSeconds, 10),
        action: action || 'block',
        blockDurationMinutes: parseInt(blockDurationMinutes || '15', 10),
        enabled: true,
        createdAt: new Date().toISOString(),
      };

      db.securityRules.push(newRule);
      saveDatabase();

      const ip = getClientIp(req);
      logAudit(user.email, 'Security Rule Created', `Created rule: "${name}" on ${route}`, route, ip, 'Success');

      return NextResponse.json({ success: true, rule: newRule });
    },
    'manage_security'
  );
}

export async function PUT(req: NextRequest) {
  return secureApiHandler(
    req,
    async (r, user) => {
      const body = await req.json();
      const { id, enabled, threshold, windowSeconds, blockDurationMinutes } = body;

      const db = getDatabase();
      const rule = db.securityRules.find(r => r.id === id);
      if (!rule) {
        return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
      }

      if (enabled !== undefined) rule.enabled = enabled;
      if (threshold !== undefined) rule.threshold = threshold;
      if (windowSeconds !== undefined) rule.windowSeconds = windowSeconds;
      if (blockDurationMinutes !== undefined) rule.blockDurationMinutes = blockDurationMinutes;

      saveDatabase();
      const ip = getClientIp(req);
      logAudit(user.email, 'Security Rule Updated', `Updated rule: "${rule.name}"`, rule.route, ip, 'Success');

      return NextResponse.json({ success: true, rule });
    },
    'manage_security'
  );
}

export async function DELETE(req: NextRequest) {
  return secureApiHandler(
    req,
    async (r, user) => {
      const { searchParams } = new URL(req.url);
      const id = searchParams.get('id');

      const db = getDatabase();
      const index = db.securityRules.findIndex(r => r.id === id);
      if (index === -1) {
        return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
      }

      const deleted = db.securityRules.splice(index, 1)[0];
      saveDatabase();

      const ip = getClientIp(req);
      logAudit(user.email, 'Security Rule Deleted', `Deleted rule: "${deleted.name}"`, deleted.route, ip, 'Success');

      return NextResponse.json({ success: true });
    },
    'manage_security'
  );
}

