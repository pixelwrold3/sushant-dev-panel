import { NextRequest, NextResponse } from 'next/server';
import { secureApiHandler, logAudit, getClientIp } from '@/lib/api/handler';
import { getDatabase, saveDatabase, IPRecord } from '@/lib/database/db';
import { blockIpAtKernel, unblockIpAtKernel } from '@/lib/security/kernelFirewall';

export async function GET(req: NextRequest) {
  return secureApiHandler(
    req,
    async () => {
      const db = getDatabase();
      return NextResponse.json({ ipRecords: db.ipRecords });
    },
    'manage_ips'
  );
}

export async function POST(req: NextRequest) {
  return secureApiHandler(
    req,
    async (r, user) => {
      const body = await req.json();
      const { ip, type, reason, durationMinutes, confirmSelfLockout } = body;
      const currentIp = getClientIp(req);

      if (!ip || !reason) {
        return NextResponse.json({ error: 'IP address and reason are required' }, { status: 400 });
      }

      // Self-lockout check requirement from Section 18 of project.md:
      // "Never allow an admin to accidentally lock themselves out without confirmation. Before blocking current admin's IP, show confirmation."
      if ((ip === currentIp || ip === '127.0.0.1' || ip === '::1') && type !== 'allowlist') {
        if (!confirmSelfLockout) {
          return NextResponse.json(
            {
              warning: 'Self-Lockout Warning: You are attempting to block your own active connection IP! Please confirm.',
              requiresConfirmation: true,
              selfIp: currentIp,
            },
            { status: 400 }
          );
        }
      }

      const db = getDatabase();
      const durationMins = parseInt(durationMinutes || '60', 10);
      const isPermanent = type === 'permanent' || durationMins === 0;

      let expiresAt: string | null = null;
      if (!isPermanent && type !== 'allowlist') {
        expiresAt = new Date(Date.now() + durationMins * 60 * 1000).toISOString();
      }

      const existing = db.ipRecords.find(item => item.ip === ip);
      if (existing) {
        existing.status = 'active';
        existing.type = type;
        existing.reason = reason;
        existing.expiresAt = expiresAt;
      } else {
        const newRecord: IPRecord = {
          id: `ip_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          ip,
          type: type || 'temporary',
          reason,
          status: 'active',
          createdAt: new Date().toISOString(),
          expiresAt,
          requestCount: 0,
          blockedCount: 0,
          lastRequest: new Date().toISOString(),
          routesHit: [],
        };
        db.ipRecords.unshift(newRecord);
      }

      // Security event
      db.securityEvents.unshift({
        id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        timestamp: new Date().toISOString(),
        user: user.email,
        ip,
        action: type === 'allowlist' ? 'IP Added to Allowlist' : 'IP Blocked Manually',
        reason,
        target: 'IP Access',
        result: type === 'allowlist' ? 'ALLOWED' : 'BLOCKED',
      });

      saveDatabase();

      // Synchronize with kernel-level iptables via Go Agent
      if (type === 'allowlist') {
        unblockIpAtKernel(ip).catch(() => {});
      } else {
        blockIpAtKernel(ip, reason).catch(() => {});
      }

      logAudit(
        user.email,
        type === 'allowlist' ? 'IP Allowlisted' : 'IP Blocked',
        `${type === 'allowlist' ? 'Allowlisted' : 'Blocked'} IP: ${ip} (${reason})`,
        ip,
        currentIp,
        'Success'
      );

      return NextResponse.json({ success: true });
    },
    'manage_ips'
  );
}

export async function DELETE(req: NextRequest) {
  return secureApiHandler(
    req,
    async (r, user) => {
      const { searchParams } = new URL(req.url);
      const ip = searchParams.get('ip');

      if (!ip) {
        return NextResponse.json({ error: 'IP parameter is required' }, { status: 400 });
      }

      const db = getDatabase();
      const record = db.ipRecords.find(item => item.ip === ip);
      if (!record) {
        return NextResponse.json({ error: 'Record not found' }, { status: 404 });
      }

      record.status = 'removed';
      saveDatabase();

      // Unblock at kernel iptables level
      unblockIpAtKernel(ip).catch(() => {});

      const clientIp = getClientIp(req);
      db.securityEvents.unshift({
        id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        timestamp: new Date().toISOString(),
        user: user.email,
        ip,
        action: 'IP Unblocked Manually',
        reason: 'Unblocked by administrator',
        target: 'IP Access',
        result: 'ALLOWED',
      });

      logAudit(user.email, 'IP Unblocked', `Manually unblocked IP: ${ip}`, ip, clientIp, 'Success');

      return NextResponse.json({ success: true });
    },
    'manage_ips'
  );
}

export async function PATCH(req: NextRequest) {
  return secureApiHandler(
    req,
    async (r, user) => {
      const body = await req.json();
      const { ip, durationMinutes, reason, type } = body;

      const db = getDatabase();
      const record = db.ipRecords.find(item => item.ip === ip);
      if (!record) {
        return NextResponse.json({ error: 'Record not found' }, { status: 404 });
      }

      if (durationMinutes !== undefined) {
        const mins = parseInt(durationMinutes, 10);
        record.expiresAt = mins > 0 ? new Date(Date.now() + mins * 60 * 1000).toISOString() : null;
        record.type = mins > 0 ? 'temporary' : 'permanent';
        record.status = 'active';
      }
      if (reason) record.reason = reason;
      if (type) record.type = type;

      saveDatabase();
      const clientIp = getClientIp(req);
      logAudit(user.email, 'IP Record Updated', `Updated settings for IP: ${ip}`, ip, clientIp, 'Success');

      return NextResponse.json({ success: true, record });
    },
    'manage_ips'
  );
}

