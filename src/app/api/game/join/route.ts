import { gameStore } from '@/lib/game-store';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const teamId = String(body.teamId ?? '').trim();
  const teamName = String(body.teamName ?? '').trim();

  if (!teamId || !teamName)
    return NextResponse.json({ success: false, message: 'teamId және teamName міндетті' }, { status: 400 });

  // Check if team already exists (reconnect)
  const existing = gameStore.reconnectTeam(teamId);
  if (existing) return NextResponse.json({ success: true, team: existing, reconnected: true });

  const joined = gameStore.joinTeam(teamId, teamName);
  if (!joined)
    return NextResponse.json({ success: false, message: 'Ойын басталып кетті немесе команда бар' }, { status: 409 });

  return NextResponse.json({ success: true, team: { id: teamId, name: teamName, score: 0 } });
}
