import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const AGENT_SERVICE = process.env.AGENT_SERVICE_URL || 'http://localhost:3007';

export async function proxyToAgentService(
  request: NextRequest,
  pathSegments: string[] = []
) {
  const token = (await cookies()).get('token')?.value;
  const path = pathSegments.join('/');
  const url = path
    ? `${AGENT_SERVICE}/api/agent/${path}${request.nextUrl.search}`
    : `${AGENT_SERVICE}/api/agent${request.nextUrl.search}`;

  const headers: Record<string, string> = {};
  const contentType = request.headers.get('content-type');
  if (contentType) headers['Content-Type'] = contentType;
  // Forward Accept so the service knows whether to stream (text/event-stream).
  const accept = request.headers.get('accept');
  if (accept) headers['Accept'] = accept;
  if (token) {
    headers['Cookie'] = `token=${token}`;
    headers['Authorization'] = `Bearer ${token}`;
  }

  const init: RequestInit = { method: request.method, headers };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.text();
  }

  const response = await fetch(url, init);
  const responseType = response.headers.get('content-type') || '';

  // Stream Server-Sent Events straight through. Buffering with .text() here would
  // defeat streaming entirely (the panel would get everything at once, or hang).
  if (responseType.includes('text/event-stream') && response.body) {
    return new NextResponse(response.body, {
      status: response.status,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  }

  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers: { 'Content-Type': responseType || 'application/json' },
  });
}
