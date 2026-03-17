import { NextResponse } from 'next/server';

const ALLOWED_ORIGINS = [
  'https://prospectai-crm.fly.dev',
  'http://localhost:5173',
  'http://localhost:8080',
];

export function middleware(request) {
  const origin = request.headers.get('origin') ?? '';
  const isAllowed = ALLOWED_ORIGINS.includes(origin);

  // Handle preflight
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });
    if (isAllowed) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    return response;
  }

  const response = NextResponse.next();

  if (isAllowed) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Vary', 'Origin');
  }

  // Allow iframe embedding from allowed origins
  response.headers.set('X-Frame-Options', 'ALLOWALL');

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon).*)'],
};
