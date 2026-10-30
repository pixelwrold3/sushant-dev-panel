import { NextRequest, NextResponse } from 'next/server';
import { secureApiHandler, getClientIp, logAudit } from '@/lib/api/handler';

export async function POST(req: NextRequest) {
  return secureApiHandler(
    req,
    async (r, user) => {
      const ip = getClientIp(req);
      logAudit(user.email, 'Logout', `User signed out from ${ip}`, '/login', ip, 'Success');

      const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
      response.cookies.delete('devpanel_session');
      return response;
    }
  );
}

