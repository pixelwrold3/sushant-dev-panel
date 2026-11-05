import { NextRequest, NextResponse } from 'next/server';
import { secureApiHandler, logAudit, getClientIp } from '@/lib/api/handler';
import { listServices, executeServiceAction, AllowedService, AllowedAction } from '@/lib/services/serviceManager';
import { hasPermission } from '@/lib/auth/rbac';

export async function GET(req: NextRequest) {
  return secureApiHandler(
    req,
    async () => {
      const services = await listServices();
      return NextResponse.json({ services });
    },
    'view_monitoring'
  );
}

export async function POST(req: NextRequest) {
  return secureApiHandler(
    req,
    async (r, user) => {
      const body = await req.json();
      const { service, action } = body as { service: AllowedService; action: AllowedAction };

      if (!service || !action) {
        return NextResponse.json({ error: 'service and action are required' }, { status: 400 });
      }

      // Project-level services ('diet-website', 'dev', 'application') can be managed by DEVELOPER/ADMIN/OWNER.
      // System infrastructure services ('nginx', 'mongod', 'cloudflared') strictly require 'server_actions'.
      const isProjectService = ['diet-website', 'dev', 'application'].includes(service);
      const isAuthorized = isProjectService
        ? hasPermission(user.role, 'edit_code') || hasPermission(user.role, 'server_actions')
        : hasPermission(user.role, 'server_actions');

      if (!isAuthorized) {
        return NextResponse.json(
          { error: `Forbidden: User role ${user.role} lacks permission to manage service ${service}` },
          { status: 403 }
        );
      }

      const ip = getClientIp(req);
      try {
        const result = await executeServiceAction(service, action);
        logAudit(
          user.email,
          `Service Action (${action})`,
          `Executed ${action} on ${service}`,
          service,
          ip,
          result.success ? 'Success' : 'Failure'
        );
        return NextResponse.json(result);
      } catch (err: any) {
        logAudit(user.email, `Service Action Failed`, err.message, service, ip, 'Failure');
        return NextResponse.json({ error: err.message }, { status: 403 });
      }
    }
  );
}
