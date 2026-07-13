import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const NOTES_SERVICE = process.env.NOTES_SERVICE_URL || 'http://localhost:3006';

/**
 * Proxies vital-sign readings to notes-service, which owns the Vital resource.
 *
 * The service scopes every read to the caller's own patientId taken from the
 * JWT, so there is no patient parameter here to tamper with.
 */
export async function proxyToVitalsService(
  request: NextRequest,
  pathSegments: string[] = []
) {
  const token = (await cookies()).get('token')?.value;
  const path = pathSegments.join('/');
  const url = path
    ? `${NOTES_SERVICE}/api/vitals/${path}${request.nextUrl.search}`
    : `${NOTES_SERVICE}/api/vitals${request.nextUrl.search}`;

  const headers: Record<string, string> = {};
  const contentType = request.headers.get('content-type');
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  if (token) {
    headers['Cookie'] = `token=${token}`;
    headers['Authorization'] = `Bearer ${token}`;
  }

  const init: RequestInit = { method: request.method, headers };

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
