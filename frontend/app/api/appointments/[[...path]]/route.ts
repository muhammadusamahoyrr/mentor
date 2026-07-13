import { NextRequest } from 'next/server';
import { proxyToAppointmentService } from '../../../../lib/appointmentServiceProxy';

interface RouteContext {
  params: Promise<{ path?: string[] }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const params = await context.params;
  const path = params?.path || [];
  return proxyToAppointmentService(request, path);
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const params = await context.params;
  const path = params?.path || [];
  return proxyToAppointmentService(request, path);
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const params = await context.params;
  const path = params?.path || [];
  return proxyToAppointmentService(request, path);
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const params = await context.params;
  const path = params?.path || [];
  return proxyToAppointmentService(request, path);
}
