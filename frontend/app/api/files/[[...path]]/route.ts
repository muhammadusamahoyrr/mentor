import { NextRequest } from 'next/server';
import { proxyToFileService } from '../../../../lib/fileServiceProxy';

interface RouteContext {
  params: Promise<{ path?: string[] }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const params = await context.params;
  const path = params?.path || [];
  return proxyToFileService(request, path);
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const params = await context.params;
  const path = params?.path || [];
  return proxyToFileService(request, path);
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const params = await context.params;
  const path = params?.path || [];
  return proxyToFileService(request, path);
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const params = await context.params;
  const path = params?.path || [];
  return proxyToFileService(request, path);
}
