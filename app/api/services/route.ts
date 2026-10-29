import { NextRequest, NextResponse } from 'next/server';
import { secureApiHandler, logAudit, getClientIp } from '@/lib/api/handler';
import { listServices, executeServiceAction, AllowedService, AllowedAction } from '@/lib/services/serviceManager';

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
    },
    'server_actions'
  );
}

