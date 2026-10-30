import { NextRequest, NextResponse } from 'next/server';
import { getSessionToken } from './lib/auth/session';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow static assets, images, favicon, and login API/page
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth/login') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.js')
  ) {
    return NextResponse.next();
  }

  // Check session cookie
  const token = req.cookies.get('devpanel_session')?.value || req.headers.get('authorization');

  if (!token) {
    // If API route, return 401
    if (pathname.startsWith('/api/')) {
      // /api/auth/me allows check
      if (pathname === '/api/auth/me') {
        return NextResponse.next();
      }
      return NextResponse.json({ error: 'Unauthorized: Session required' }, { status: 401 });
    }

    // Redirect browser to login
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

