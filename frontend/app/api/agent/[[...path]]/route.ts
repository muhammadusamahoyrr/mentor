import { NextRequest } from 'next/server';
import { proxyToAgentService } from '../../../../lib/agentServiceProxy';

// SSE responses must not be statically optimised or buffered.
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ path?: string[] }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  return proxyToAgentService(request, path);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  return proxyToAgentService(request, path);
}
