import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const FILE_SERVICE = process.env.FILE_SERVICE_URL || 'http://localhost:3005';

/**
 * Proxies the medical-file vault, including the actual file bytes.
 *
 * This proxy is binary-safe, which the JSON ones are not. It previously did
 * `await request.text()` on the way up and `await response.text()` on the way
 * down — decoding both directions as UTF-8. That silently corrupts every byte
 * sequence that isn't valid UTF-8, which is to say every PDF, JPEG and PNG:
 * invalid bytes get replaced with U+FFFD and the file is quietly destroyed. It
 * only ever "worked" because no real bytes were being sent.
 *
 * ArrayBuffers pass through untouched.
 */
export async function proxyToFileService(
  request: NextRequest,
  pathSegments: string[] = []
) {
  const token = (await cookies()).get('token')?.value;
  const path = pathSegments.join('/');
  const url = path
    ? `${FILE_SERVICE}/api/files/${path}${request.nextUrl.search}`
    : `${FILE_SERVICE}/api/files${request.nextUrl.search}`;

  const headers: Record<string, string> = {};

  // Forward Content-Type verbatim. For a multipart upload it carries the
  // boundary token, and the body is unparseable without it.
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
    const body = await request.arrayBuffer();
    if (body.byteLength > 0) {
      init.body = body;
    }
  }

  const response = await fetch(url, init);

  // Read the response as bytes too — a downloaded PDF must not be run through a
  // text decoder on its way back to the browser.
  const responseBody = await response.arrayBuffer();

  const outHeaders: Record<string, string> = {
    'Content-Type': response.headers.get('content-type') || 'application/json',
  };

  // Preserve the filename and the attachment disposition on downloads.
  const disposition = response.headers.get('content-disposition');
  if (disposition) {
    outHeaders['Content-Disposition'] = disposition;
  }

  return new NextResponse(responseBody, {
    status: response.status,
    headers: outHeaders,
  });
}
