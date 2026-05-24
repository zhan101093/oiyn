'use client';

import { useEffect, useRef, useState } from 'react';
import type { PublicState } from '@/lib/game-store';
import type { AnswerChoice } from '@/lib/questions';

const CHOICES: AnswerChoice[] = ['A', 'B', 'C', 'D'];

const CHOICE_COLORS: Record<AnswerChoice, { base: string; selected: string; correct: string; wrong: string }> = {
  A: { base: 'bg-red-500 border-red-600 text-white',   selected: 'bg-red-600 border-red-700 text-white shadow-lg scale-95',   correct: 'bg-red-500 border-red-600 text-white ring-4 ring-gold ring-offset-2 scale-105', wrong: 'bg-red-500/20 border-red-300 text-red-300 opacity-30' },
  B: { base: 'bg-blue-600 border-blue-700 text-white', selected: 'bg-blue-700 border-blue-800 text-white shadow-lg scale-95', correct: 'bg-blue-600 border-blue-700 text-white ring-4 ring-gold ring-offset-2 scale-105', wrong: 'bg-blue-600/20 border-blue-300 text-blue-300 opacity-30' },
  C: { base: 'bg-amber-400 border-amber-500 text-ink', selected: 'bg-amber-500 border-amber-600 text-ink shadow-lg scale-95', correct: 'bg-amber-400 border-amber-500 text-ink ring-4 ring-gold ring-offset-2 scale-105',  wrong: 'bg-amber-400/20 border-amber-300 text-amber-300 opacity-30' },
  D: { base: 'bg-green-600 border-green-700 text-white',selected: 'bg-green-700 border-green-800 text-white shadow-lg scale-95',correct: 'bg-green-600 border-green-700 text-white ring-4 ring-gold ring-offset-2 scale-105',wrong: 'bg-green-600/20 border-green-300 text-green-300 opacity-30' },
};

function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function getOrCreateTeamId(): string {
  let id = localStorage.getItem('oiyn_team_id');
  if (!id) { id = genId(); localStorage.setItem('oiyn_team_id', id); }
  return id;
}

// ─── Join Screen ───────────────────────────────────────────────────────────────
function JoinScreen({ onJoin }: { onJoin: (name: string) => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('Команда атын енгізіңіз'); return; }
    if (trimmed.length > 30) { setError('Атың тым ұзын (макс. 30 таңба)'); return; }
    onJoin(trimmed);
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-ink">ОЙЫН</h1>
          <p className="text-muted mt-2 font-medium">Отбасылық викторина</p>
        </div>
        <div className="bg-white rounded-2xl border-2 border-border p-6 shadow-sm">
          <label className="block text-sm font-bold text-ink mb-2">Атыңыз</label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Мысалы: Асель"
            maxLength={30}
            className="w-full border-2 border-border rounded-xl px-4 py-3 text-lg font-semibold text-ink placeholder-muted outline-none focus:border-gold transition-colors"
          />
          {error && <p className="text-crimson text-sm font-medium mt-2">{error}</p>}
          <button
            onClick={submit}
            className="mt-4 w-full bg-gold text-white font-black text-lg rounded-xl py-3 hover:bg-gold-dark active:scale-95 transition-all"
          >
            Қосылу
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Answer Button ─────────────────────────────────────────────────────────────
function AnswerButton({
  choice,
  onPress,
  disabled,
  selected,
  revealed,
  isCorrect,
}: {
  choice: AnswerChoice;
  onPress: () => void;
  disabled: boolean;
  selected: boolean;
  revealed: boolean;
  isCorrect: boolean;
}) {
  const colors = CHOICE_COLORS[choice];
  let cls = 'w-full min-h-[80px] rounded-2xl border-2 font-black text-3xl transition-all duration-300 ';

  if (!revealed) {
    if (selected) cls += colors.selected;
    else if (disabled) cls += `${colors.base} opacity-50 cursor-not-allowed`;
    else cls += `${colors.base} hover:brightness-110 hover:shadow-md cursor-pointer`;
  } else {
    if (isCorrect) cls += colors.correct + ' answer-correct';
    else if (selected) cls += colors.wrong;
    else cls += colors.wrong;
  }

  return (
    <button onClick={onPress} disabled={disabled} className={cls} aria-label={`Жауап ${choice}`}>
      {choice}
    </button>
  );
}

// ─── Main Play Page ────────────────────────────────────────────────────────────
export default function PlayPage() {
  const [state, setState] = useState<PublicState | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string>('');
  const [myAnswer, setMyAnswer] = useState<AnswerChoice | null>(null);
  const [answerResult, setAnswerResult] = useState<{ isCorrect: boolean; pointsEarned: number } | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const esRef = useRef<EventSource | null>(null);

  // Load persisted team info
  useEffect(() => {
    const id = getOrCreateTeamId();
    setTeamId(id);
    const savedName = localStorage.getItem('oiyn_team_name');
    if (savedName) {
      // Attempt reconnect silently
      fetch('/api/game/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: id, teamName: savedName }),
      })
        .then((r) => r.json())
        .then((d) => { if (d.success) setTeamName(savedName); })
        .catch(() => {});
    }
  }, []);

  // SSE connection
  useEffect(() => {
    if (!teamName) return;
    const connect = () => {
      const es = new EventSource('/api/game/events');
      esRef.current = es;
      es.onmessage = (e) => {
        try {
          const newState: PublicState = JSON.parse(e.data);
          setState((prev) => {
            // Reset myAnswer when new question starts
            if (prev && prev.currentQuestionIndex !== newState.currentQuestionIndex) {
              setMyAnswer(null);
              setAnswerResult(null);
            }
            return newState;
          });
        } catch { /* ignore */ }
      };
      es.onerror = () => { es.close(); setTimeout(connect, 3000); };
    };
    connect();
    return () => esRef.current?.close();
  }, [teamName]);

  const handleJoin = async (name: string) => {
    setJoining(true);
    setJoinError('');
    try {
      const res = await fetch('/api/game/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, teamName: name }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('oiyn_team_name', name);
        setTeamName(name);
      } else {
        setJoinError(data.message ?? 'Қосылу мүмкін болмады');
      }
    } catch {
      setJoinError('Желі қатесі. Қайталаңыз.');
    } finally {
      setJoining(false);
    }
  };

  const handleAnswer = async (choice: AnswerChoice) => {
    if (myAnswer || state?.status !== 'question') return;
    setMyAnswer(choice);
    try {
      const res = await fetch('/api/game/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, choice }),
      });
      const data = await res.json();
      if (data.success) setAnswerResult({ isCorrect: data.isCorrect, pointsEarned: data.pointsEarned });
    } catch { /* ignore */ }
  };

  // ── Not joined ──
  if (!teamName) {
    return (
      <>
        <JoinScreen onJoin={handleJoin} />
        {joining && (
          <div className="fixed inset-0 bg-cream/80 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {joinError && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-crimson text-white px-6 py-3 rounded-xl font-semibold text-sm shadow-lg">
            {joinError}
          </div>
        )}
      </>
    );
  }

  // ── Loading ──
  if (!state) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-muted font-semibold">Қосылуда...</p>
        </div>
      </div>
    );
  }

  const myTeam = state.teams.find((t) => t.id === teamId);
  const myRank = state.teams.findIndex((t) => t.id === teamId) + 1;
  const revealed = state.status === 'reveal' || state.status === 'leaderboard';

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {/* Header */}
      <div className="bg-white border-b-2 border-border px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted font-medium">Ойыншы</p>
          <p className="font-black text-ink text-lg leading-tight">{teamName}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted font-medium">Ұпай</p>
          <p className="font-black text-gold text-2xl">{myTeam?.score ?? 0}</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col p-4">
        {/* ── LOBBY ── */}
        {state.status === 'lobby' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 animate-[fadeIn_0.5s_ease-out]">
            <div className="w-16 h-16 rounded-2xl bg-gold/10 border-2 border-gold flex items-center justify-center">
              <span className="text-3xl">⏳</span>
            </div>
            <div>
              <h2 className="text-2xl font-black text-ink">Сәлем, {teamName}!</h2>
              <p className="text-muted mt-1">Ойын басталуын күте отырыңыз...</p>
            </div>
            <div className="bg-gold/10 border border-gold/30 rounded-xl px-4 py-2">
              <p className="text-sm text-muted">{state.teams.length} ойыншы қосылды</p>
            </div>
          </div>
        )}

        {/* ── QUESTION ── */}
        {state.status === 'question' && (
          <div className="flex-1 flex flex-col animate-[fadeIn_0.3s_ease-out]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-gold uppercase tracking-wider">
                {state.currentQuestion?.level}
              </span>
              <span className="text-xs text-muted">
                {state.currentQuestionIndex + 1}/{state.totalQuestions}
              </span>
              <span className={`text-sm font-black tabular-nums ${state.timeLeft <= 10 ? 'text-crimson' : 'text-ink'}`}>
                ⏱ {state.timeLeft}с
              </span>
            </div>

            {!myAnswer ? (
              <>
                <p className="text-center text-muted font-semibold mb-6 text-sm">Жауапты таңдаңыз</p>
                <div className="flex flex-col gap-3 flex-1">
                  {CHOICES.map((ch) => (
                    <AnswerButton
                      key={ch}
                      choice={ch}
                      onPress={() => handleAnswer(ch)}
                      disabled={false}
                      selected={false}
                      revealed={false}
                      isCorrect={false}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-5 animate-[bounceIn_0.5s_ease-out]">
                <div className="w-20 h-20 rounded-2xl bg-gold/10 border-2 border-gold flex items-center justify-center">
                  <span className="text-5xl font-black text-gold">{myAnswer}</span>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-ink">Жауабыңыз қабылданды!</p>
                  <p className="text-muted mt-1 text-sm">Нәтижені күте отырыңыз...</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── REVEAL ── */}
        {(state.status === 'reveal' || state.status === 'leaderboard') && (
          <div className="flex-1 flex flex-col animate-[fadeIn_0.4s_ease-out]">
            {answerResult ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center">
                {answerResult.isCorrect ? (
                  <>
                    <div className="w-24 h-24 rounded-full bg-gold/10 border-4 border-gold flex items-center justify-center animate-[bounceIn_0.6s_ease-out]">
                      <span className="text-5xl">✦</span>
                    </div>
                    <div>
                      <p className="text-3xl font-black text-gold">Дұрыс!</p>
                      <p className="text-xl font-bold text-ink mt-1">+{answerResult.pointsEarned} ұпай</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-24 h-24 rounded-full bg-crimson/10 border-4 border-crimson/40 flex items-center justify-center animate-[bounceIn_0.6s_ease-out]">
                      <span className="text-5xl">✗</span>
                    </div>
                    <div>
                      <p className="text-3xl font-black text-crimson">Қате...</p>
                      <p className="text-muted mt-1">
                        Дұрыс жауап:{' '}
                        <span className="font-black text-gold text-xl">{state.currentQuestion?.correctAnswer}</span>
                      </p>
                    </div>
                  </>
                )}

                {/* Answer grid (muted review) */}
                <div className="w-full grid grid-cols-2 gap-2 mt-2">
                  {CHOICES.map((ch) => (
                    <AnswerButton
                      key={ch}
                      choice={ch}
                      onPress={() => {}}
                      disabled
                      selected={myAnswer === ch}
                      revealed
                      isCorrect={state.currentQuestion?.correctAnswer === ch}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gold/10 border-2 border-gold flex items-center justify-center">
                  <span className="text-3xl">⏳</span>
                </div>
                <p className="text-muted">Уақыт бітті — жауаптар тіркелуде</p>
                <p className="text-sm text-muted">
                  Дұрыс жауап:{' '}
                  <span className="font-black text-gold text-xl">{state.currentQuestion?.correctAnswer}</span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── FINISHED ── */}
        {state.status === 'finished' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center animate-[fadeIn_0.5s_ease-out]">
            <p className="text-6xl">🏆</p>
            <div>
              <h2 className="text-3xl font-black text-gold">Ойын аяқталды!</h2>
              <p className="text-ink font-bold text-xl mt-2">
                Сіздің ұпайыңыз: <span className="text-gold">{myTeam?.score ?? 0}</span>
              </p>
              {myRank > 0 && (
                <p className="text-muted mt-1">{myRank}-орын ({state.teams.length} командадан)</p>
              )}
            </div>
            <div className="w-full space-y-2 text-left">
              {state.teams.slice(0, 5).map((t, i) => (
                <div key={t.id} className={`flex items-center gap-3 px-4 py-2 rounded-xl border-2 ${t.id === teamId ? 'border-gold bg-gold/10' : 'border-border bg-white'}`}>
                  <span className="font-black text-sm text-muted w-5">{i + 1}</span>
                  <span className="flex-1 font-semibold text-ink truncate">{t.name}</span>
                  <span className={`font-black ${i === 0 ? 'text-gold' : 'text-ink'}`}>{t.score}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
