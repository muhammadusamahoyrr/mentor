import { NextRequest } from 'next/server';
import { proxyToVitalsService } from '../../../../lib/vitalsServiceProxy';

interface RouteContext {
  params: Promise<{ path?: string[] }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return proxyToVitalsService(request, params?.path || []);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return proxyToVitalsService(request, params?.path || []);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return proxyToVitalsService(request, params?.path || []);
}
