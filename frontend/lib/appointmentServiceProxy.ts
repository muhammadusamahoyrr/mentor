import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const APPOINTMENT_SERVICE =
  process.env.APPOINTMENT_SERVICE_URL || 'http://localhost:3002';

export async function proxyToAppointmentService(
  request: NextRequest,
  pathSegments: string[] = []
) {
  const token = (await cookies()).get('token')?.value;
  const path = pathSegments.join('/');
  const url = path
    ? `${APPOINTMENT_SERVICE}/api/appointments/${path}${request.nextUrl.search}`
    : `${APPOINTMENT_SERVICE}/api/appointments${request.nextUrl.search}`;

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
