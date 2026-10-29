import { NextRequest, NextResponse } from 'next/server';
import { secureApiHandler } from '@/lib/api/handler';
import { getLiveMetrics, getMetricsHistory } from '@/lib/monitoring/system';

export async function GET(req: NextRequest) {
  return secureApiHandler(
    req,
    async () => {
      const current = await getLiveMetrics();
      const history = getMetricsHistory();
      return NextResponse.json({ current, history });
    },
    'view_monitoring'
  );
}

