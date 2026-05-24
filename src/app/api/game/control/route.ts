import { gameStore } from '@/lib/game-store';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

type Action = 'start' | 'reveal' | 'leaderboard' | 'next' | 'reset' | 'selectLevel';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action ?? '') as Action;

  let ok = false;
  switch (action) {
    case 'start':       ok = gameStore.startGame();       break;
    case 'reveal':      ok = gameStore.revealAnswer();    break;
    case 'leaderboard': ok = gameStore.showLeaderboard(); break;
    case 'next':        ok = gameStore.nextQuestion();    break;
    case 'reset':       gameStore.resetGame(); ok = true; break;
    case 'selectLevel': {
      const level = Number(body.level);
      if (level === 1 || level === 2 || level === 3) {
        ok = gameStore.selectLevel(level as 1 | 2 | 3);
      }
      break;
    }
    default:
      return NextResponse.json({ success: false, message: 'Белгісіз action' }, { status: 400 });
  }

  return NextResponse.json({ success: ok, state: gameStore.getPublicState() });
}
