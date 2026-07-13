import { NextRequest } from 'next/server';
import { proxyToNotesService } from '../../../../lib/notesServiceProxy';

interface RouteContext {
  params: Promise<{ path?: string[] }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const params = await context.params;
  const path = params?.path || [];
  return proxyToNotesService(request, path);
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const params = await context.params;
  const path = params?.path || [];
  return proxyToNotesService(request, path);
}

export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  const params = await context.params;
  const path = params?.path || [];
  return proxyToNotesService(request, path);
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const params = await context.params;
  const path = params?.path || [];
  return proxyToNotesService(request, path);
}
