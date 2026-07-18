import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const AUTH_SERVICE =
  process.env.AUTH_SERVICE_URL ||
  'http://localhost:3001';

interface RouteContext {
  params: Promise<{ path?: string[] }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyToAuth(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const response = await proxyToAuth(request, context);
  // Forward Set-Cookie from auth-service back to the browser
  return response;
}

async function proxyToAuth(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const path = (params?.path || []).join('/');
  const token = (await cookies()).get('token')?.value;

  const url = path
    ? `${AUTH_SERVICE}/api/auth/${path}${request.nextUrl.search}`
    : `${AUTH_SERVICE}/api/auth${request.nextUrl.search}`;

  const headers: Record<string, string> = {};
  const contentType = request.headers.get('content-type');
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  if (token) {
    headers['Cookie'] = `token=${token}`;
    headers['Authorization'] = `Bearer ${token}`;
  }

  const init: RequestInit = {
    method: request.method,
    headers,
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.text();
  }

  const upstreamResponse = await fetch(url, init);
  const body = await upstreamResponse.text();

  const nextResponse = new NextResponse(body, {
    status: upstreamResponse.status,
    headers: {
      'Content-Type': upstreamResponse.headers.get('content-type') || 'application/json',
    },
  });

  // Forward any Set-Cookie headers from auth-service (e.g., the JWT token cookie)
  const setCookie = upstreamResponse.headers.get('set-cookie');
  if (setCookie) {
    nextResponse.headers.set('Set-Cookie', setCookie);
  }

  return nextResponse;
}
