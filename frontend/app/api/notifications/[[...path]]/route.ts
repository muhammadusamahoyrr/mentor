import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const NOTIFICATION_SERVICE =
  process.env.NOTIFICATION_SERVICE_URL ||
  'http://localhost:3003';

interface RouteContext {
  params: Promise<{ path?: string[] }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyToNotification(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyToNotification(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyToNotification(request, context);
}

async function proxyToNotification(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  const path = (params?.path || []).join('/');
  const token = (await cookies()).get('token')?.value;

  const url = path
    ? `${NOTIFICATION_SERVICE}/api/notifications/${path}${request.nextUrl.search}`
    : `${NOTIFICATION_SERVICE}/api/notifications${request.nextUrl.search}`;

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

  const response = await fetch(url, init);
  const body = await response.text();

  return new NextResponse(body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('content-type') || 'application/json',
    },
  });
}
