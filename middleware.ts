import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow static assets, images, favicon, WebSocket endpoints, and login API/page
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/ws') ||
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

  // Check session cookie or authorization header
  const token = req.cookies.get('devpanel_session')?.value || req.headers.get('authorization');

  if (!token) {
    if (pathname.startsWith('/api/')) {
      if (pathname === '/api/auth/me') {
        return NextResponse.next();
      }
      return NextResponse.json({ error: 'Unauthorized: Session required' }, { status: 401 });
    }

    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
