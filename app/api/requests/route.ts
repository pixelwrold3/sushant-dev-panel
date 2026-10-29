import { NextRequest, NextResponse } from 'next/server';
import { secureApiHandler } from '@/lib/api/handler';
import { getDatabase } from '@/lib/database/db';

export async function GET(req: NextRequest) {
  return secureApiHandler(
    req,
    async () => {
      const db = getDatabase();
      const logs = db.requestLogs || [];

      // Calculate analytics
      const now = Date.now();
      const lastMinuteLogs = logs.filter(l => now - new Date(l.timestamp).getTime() < 60000);
      const reqPerMin = lastMinuteLogs.length;
      const reqPerSec = Math.round((reqPerMin / 60) * 10) / 10;

      let status2xx = 0;
      let status3xx = 0;
      let status4xx = 0;
      let status5xx = 0;
      let status429 = 0;
      let blockedCount = 0;

      const ipCounts: Record<string, number> = {};
      const routeCounts: Record<string, number> = {};

      for (const log of logs) {
        if (log.blocked || log.status === 429) {
          blockedCount++;
          status429++;
        } else if (log.status >= 200 && log.status < 300) status2xx++;
        else if (log.status >= 300 && log.status < 400) status3xx++;
        else if (log.status >= 400 && log.status < 500) status4xx++;
        else if (log.status >= 500) status5xx++;

        ipCounts[log.ip] = (ipCounts[log.ip] || 0) + 1;
        routeCounts[log.route] = (routeCounts[log.route] || 0) + 1;
      }

      const topIps = Object.entries(ipCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([ip, count]) => ({ ip, count }));

      const topRoutes = Object.entries(routeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([route, count]) => ({ route, count }));

      return NextResponse.json({
        recentLogs: logs.slice(0, 50),
        stats: {
          reqPerSec,
          reqPerMin,
          total: logs.length,
          status2xx,
          status3xx,
          status4xx,
          status5xx,
          status429,
          blockedCount,
          topIps,
          topRoutes,
        },
      });
    },
    'view_monitoring'
  );
}

