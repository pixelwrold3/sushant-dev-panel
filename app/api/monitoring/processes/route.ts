import { NextRequest, NextResponse } from 'next/server';
import { secureApiHandler } from '@/lib/api/handler';
import { getTopProcesses } from '@/lib/monitoring/system';

export async function GET(req: NextRequest) {
  return secureApiHandler(
    req,
    async () => {
      const processes = await getTopProcesses(25);
      return NextResponse.json({ processes });
    },
    'view_monitoring'
  );
}

