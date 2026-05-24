import { NextResponse } from 'next/server';
import { getSessions } from '@/lib/sessions-store';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(getSessions());
}
