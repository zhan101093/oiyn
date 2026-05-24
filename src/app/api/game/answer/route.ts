import { gameStore } from '@/lib/game-store';
import { NextRequest, NextResponse } from 'next/server';
import type { AnswerChoice } from '@/lib/questions';

export const runtime = 'nodejs';

const VALID_CHOICES = new Set<AnswerChoice>(['A', 'B', 'C', 'D']);

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const teamId = String(body.teamId ?? '').trim();
  const choice = String(body.choice ?? '').toUpperCase() as AnswerChoice;

  if (!teamId || !VALID_CHOICES.has(choice))
    return NextResponse.json({ success: false, message: 'teamId және дұрыс choice (A/B/C/D) міндетті' }, { status: 400 });

  const result = gameStore.submitAnswer(teamId, choice);
  return NextResponse.json(result, { status: result.success ? 200 : 409 });
}
