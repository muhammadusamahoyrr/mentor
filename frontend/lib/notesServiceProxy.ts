import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const NOTES_SERVICE =
  process.env.NOTES_SERVICE_URL ||
  'http://localhost:3006';

export async function proxyToNotesService(
  request: NextRequest,
  pathSegments: string[] = []
) {
  const token = (await cookies()).get('token')?.value;
  const path = pathSegments.join('/');
  
  // Direct to correct endpoint on notes-service (either notes or doctors)
  const isDoctorsRoute = pathSegments[0] === 'doctors';
  const subPath = isDoctorsRoute
    ? pathSegments.slice(1).join('/')
    : path;

  const url = isDoctorsRoute
    ? (subPath ? `${NOTES_SERVICE}/api/doctors/${subPath}${request.nextUrl.search}` : `${NOTES_SERVICE}/api/doctors${request.nextUrl.search}`)
    : (path ? `${NOTES_SERVICE}/api/notes/${path}${request.nextUrl.search}` : `${NOTES_SERVICE}/api/notes${request.nextUrl.search}`);

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
