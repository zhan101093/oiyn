'use client';

import { useEffect, useRef, useState } from 'react';
import type { PublicState } from '@/lib/game-store';
import type { AnswerChoice } from '@/lib/questions';

const CHOICES: AnswerChoice[] = ['A', 'B', 'C', 'D'];

const CHOICE_STYLE: Record<AnswerChoice, { base: string; selected: string; correct: string; wrong: string; badge: string }> = {
  A: { base: 'bg-red-500 text-white border-red-600',     selected: 'bg-red-700 text-white border-red-800 shadow-lg',     correct: 'bg-red-500 text-white border-red-600 ring-4 ring-gold ring-offset-2', wrong: 'bg-red-200 text-red-400 border-red-300 opacity-50',     badge: 'bg-red-700 text-white' },
  B: { base: 'bg-blue-600 text-white border-blue-700',   selected: 'bg-blue-800 text-white border-blue-900 shadow-lg',   correct: 'bg-blue-600 text-white border-blue-700 ring-4 ring-gold ring-offset-2', wrong: 'bg-blue-200 text-blue-400 border-blue-300 opacity-50', badge: 'bg-blue-800 text-white' },
  C: { base: 'bg-amber-400 text-ink border-amber-500',   selected: 'bg-amber-600 text-white border-amber-700 shadow-lg', correct: 'bg-amber-400 text-ink border-amber-500 ring-4 ring-gold ring-offset-2',  wrong: 'bg-amber-100 text-amber-400 border-amber-200 opacity-50', badge: 'bg-amber-600 text-white' },
  D: { base: 'bg-green-600 text-white border-green-700', selected: 'bg-green-800 text-white border-green-900 shadow-lg', correct: 'bg-green-600 text-white border-green-700 ring-4 ring-gold ring-offset-2', wrong: 'bg-green-200 text-green-400 border-green-300 opacity-50', badge: 'bg-green-800 text-white' },
};

function genId() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
function getOrCreateTeamId() {
  let id = localStorage.getItem('oiyn_team_id');
  if (!id) { id = genId(); localStorage.setItem('oiyn_team_id', id); }
  return id;
}

// ─── Join Screen ───────────────────────────────────────────────────────────────
function JoinScreen({ onJoin }: { onJoin: (name: string) => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    const t = name.trim();
    if (!t) { setError('Команда атын енгізіңіз'); return; }
    if (t.length > 30) { setError('Атың тым ұзын (макс. 30 таңба)'); return; }
    onJoin(t);
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
            type="text" value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Мысалы: Асель" maxLength={30}
            className="w-full border-2 border-border rounded-xl px-4 py-3 text-lg font-semibold text-ink placeholder-muted outline-none focus:border-gold transition-colors"
          />
          {error && <p className="text-crimson text-sm font-medium mt-2">{error}</p>}
          <button onClick={submit} className="mt-4 w-full bg-gold text-white font-black text-lg rounded-xl py-3 hover:bg-gold-dark active:scale-95 transition-all">
            Қосылу
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Answer Button with full text ──────────────────────────────────────────────
function AnswerBtn({
  choice, text, onPress, disabled, selected, revealed, isCorrect,
}: {
  choice: AnswerChoice; text: string;
  onPress: () => void; disabled: boolean;
  selected: boolean; revealed: boolean; isCorrect: boolean;
}) {
  const s = CHOICE_STYLE[choice];
  let cls = 'w-full rounded-2xl border-2 transition-all duration-300 active:scale-95 ';
  if (!revealed) {
    cls += selected ? s.selected : disabled ? `${s.base} opacity-50 cursor-not-allowed` : `${s.base} hover:brightness-110 cursor-pointer`;
  } else {
    cls += isCorrect ? s.correct : selected ? s.wrong : s.wrong;
  }
  return (
    <button onClick={onPress} disabled={disabled} className={cls}>
      <div className="flex items-start gap-3 p-4 text-left">
        <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black ${s.badge}`}>
          {choice}
        </span>
        <span className="flex-1 font-semibold text-base leading-snug pt-0.5">{text}</span>
        {revealed && isCorrect && <span className="flex-shrink-0 text-lg">✓</span>}
      </div>
    </button>
  );
}

// ─── Main Play Page ────────────────────────────────────────────────────────────
export default function PlayPage() {
  const [state, setState] = useState<PublicState | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [teamId, setTeamId] = useState('');
  const [myAnswer, setMyAnswer] = useState<AnswerChoice | null>(null);
  const [answerResult, setAnswerResult] = useState<{ isCorrect: boolean; pointsEarned: number } | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const id = getOrCreateTeamId();
    setTeamId(id);
    const saved = localStorage.getItem('oiyn_team_name');
    if (saved) {
      fetch('/api/game/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teamId: id, teamName: saved }) })
        .then((r) => r.json()).then((d) => { if (d.success) setTeamName(saved); }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!teamName) return;
    const connect = () => {
      const es = new EventSource('/api/game/events');
      esRef.current = es;
      es.onmessage = (e) => {
        try {
          const next: PublicState = JSON.parse(e.data);
          setState((prev) => {
            if (prev && prev.currentQuestionIndex !== next.currentQuestionIndex) {
              setMyAnswer(null); setAnswerResult(null);
            }
            return next;
          });
        } catch { /* ignore */ }
      };
      es.onerror = () => { es.close(); setTimeout(connect, 3000); };
    };
    connect();
    return () => esRef.current?.close();
  }, [teamName]);

  const handleJoin = async (name: string) => {
    setJoining(true); setJoinError('');
    try {
      const res = await fetch('/api/game/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teamId, teamName: name }) });
      const data = await res.json();
      if (data.success) { localStorage.setItem('oiyn_team_name', name); setTeamName(name); }
      else setJoinError(data.message ?? 'Қосылу мүмкін болмады');
    } catch { setJoinError('Желі қатесі. Қайталаңыз.'); }
    finally { setJoining(false); }
  };

  const handleAnswer = async (choice: AnswerChoice) => {
    if (myAnswer || state?.status !== 'question') return;
    setMyAnswer(choice);
    try {
      const res = await fetch('/api/game/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teamId, choice }) });
      const data = await res.json();
      if (data.success) setAnswerResult({ isCorrect: data.isCorrect, pointsEarned: data.pointsEarned });
    } catch { /* ignore */ }
  };

  if (!teamName) {
    return (
      <>
        <JoinScreen onJoin={handleJoin} />
        {joining && <div className="fixed inset-0 bg-cream/80 flex items-center justify-center"><div className="w-8 h-8 border-4 border-gold border-t-transparent rounded-full animate-spin" /></div>}
        {joinError && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-crimson text-white px-6 py-3 rounded-xl font-semibold text-sm shadow-lg">{joinError}</div>}
      </>
    );
  }

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

  const { status, currentQuestion, currentQuestionIndex, totalQuestions, timeLeft, teams } = state;
  const myTeam = teams.find((t) => t.id === teamId);
  const myRank = teams.findIndex((t) => t.id === teamId) + 1;
  const revealed = status === 'reveal' || status === 'leaderboard';

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {/* Header */}
      <div className="bg-white border-b-2 border-border px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <p className="text-xs text-muted font-medium">Ойыншы</p>
          <p className="font-black text-ink text-lg leading-tight">{teamName}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted font-medium">Ұпай</p>
          <p className="font-black text-gold text-2xl">{myTeam?.score ?? 0}</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-4 gap-4">

        {/* ── LOBBY ── */}
        {status === 'lobby' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 animate-[fadeIn_0.5s_ease-out]">
            <div className="w-16 h-16 rounded-2xl bg-gold/10 border-2 border-gold flex items-center justify-center">
              <span className="text-3xl">⏳</span>
            </div>
            <div>
              <h2 className="text-2xl font-black text-ink">Сәлем, {teamName}!</h2>
              <p className="text-muted mt-1">Ойын басталуын күте отырыңыз...</p>
            </div>
            <div className="bg-gold/10 border border-gold/30 rounded-xl px-4 py-2">
              <p className="text-sm text-muted">{teams.length} ойыншы қосылды</p>
            </div>
          </div>
        )}

        {/* ── QUESTION ── */}
        {status === 'question' && currentQuestion && (
          <div className="flex-1 flex flex-col gap-4 animate-[fadeIn_0.3s_ease-out]">
            {/* Meta */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gold uppercase tracking-wider">{currentQuestion.level}</span>
              <span className="text-xs text-muted">{currentQuestionIndex + 1}/{totalQuestions}</span>
              <span className={`text-sm font-black tabular-nums ${timeLeft <= 10 ? 'text-crimson' : 'text-ink'}`}>⏱ {timeLeft}с</span>
            </div>

            {/* Question text */}
            <div className="bg-white rounded-2xl border-2 border-border p-4 shadow-sm">
              <p className="text-base font-bold text-ink leading-snug">{currentQuestion.text}</p>
            </div>

            {/* Answers or waiting */}
            {!myAnswer ? (
              <div className="flex flex-col gap-3">
                {CHOICES.map((ch) => (
                  <AnswerBtn
                    key={ch} choice={ch} text={currentQuestion.options[ch]}
                    onPress={() => handleAnswer(ch)} disabled={false}
                    selected={false} revealed={false} isCorrect={false}
                  />
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center animate-[bounceIn_0.5s_ease-out]">
                <div className="w-20 h-20 rounded-2xl bg-gold/10 border-2 border-gold flex items-center justify-center">
                  <span className="text-4xl font-black text-gold">{myAnswer}</span>
                </div>
                <div>
                  <p className="text-lg font-bold text-ink">Жауабыңыз қабылданды!</p>
                  <p className="text-muted text-sm mt-1 leading-snug px-4">{currentQuestion.options[myAnswer]}</p>
                  <p className="text-muted text-sm mt-2">Нәтижені күте отырыңыз...</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── REVEAL ── */}
        {revealed && currentQuestion && (
          <div className="flex-1 flex flex-col gap-4 animate-[fadeIn_0.4s_ease-out]">
            {/* Question text */}
            <div className="bg-white rounded-2xl border-2 border-border p-4 shadow-sm">
              <p className="text-sm font-bold text-ink leading-snug">{currentQuestion.text}</p>
            </div>

            {answerResult ? (
              <>
                {/* Result banner */}
                <div className={`rounded-2xl border-2 p-4 text-center ${answerResult.isCorrect ? 'bg-gold/10 border-gold' : 'bg-crimson/10 border-crimson/40'}`}>
                  {answerResult.isCorrect ? (
                    <>
                      <p className="text-2xl font-black text-gold">Дұрыс!</p>
                      <p className="text-lg font-bold text-ink mt-1">+{answerResult.pointsEarned} ұпай</p>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-black text-crimson">Қате...</p>
                      <p className="text-sm text-muted mt-1">
                        Дұрыс жауап: <span className="font-black text-gold">{currentQuestion.correctAnswer} — {currentQuestion.options[currentQuestion.correctAnswer]}</span>
                      </p>
                    </>
                  )}
                </div>

                {/* Full answer review */}
                <div className="flex flex-col gap-2">
                  {CHOICES.map((ch) => (
                    <AnswerBtn
                      key={ch} choice={ch} text={currentQuestion.options[ch]}
                      onPress={() => {}} disabled
                      selected={myAnswer === ch} revealed
                      isCorrect={currentQuestion.correctAnswer === ch}
                    />
                  ))}
                </div>
              </>
            ) : (
              <>
                {/* No answer submitted */}
                <div className="bg-white rounded-2xl border-2 border-border p-4 text-center">
                  <p className="text-muted text-sm">Уақыт бітті</p>
                  <p className="text-sm mt-1">
                    Дұрыс жауап: <span className="font-black text-gold">{currentQuestion.correctAnswer} — {currentQuestion.options[currentQuestion.correctAnswer]}</span>
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {CHOICES.map((ch) => (
                    <AnswerBtn
                      key={ch} choice={ch} text={currentQuestion.options[ch]}
                      onPress={() => {}} disabled
                      selected={false} revealed
                      isCorrect={currentQuestion.correctAnswer === ch}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── FINISHED ── */}
        {status === 'finished' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center animate-[fadeIn_0.5s_ease-out]">
            <p className="text-6xl">🏆</p>
            <div>
              <h2 className="text-3xl font-black text-gold">Ойын аяқталды!</h2>
              <p className="text-xl font-bold text-ink mt-2">
                Ұпайыңыз: <span className="text-gold">{myTeam?.score ?? 0}</span>
              </p>
              {myRank > 0 && <p className="text-muted mt-1">{myRank}-орын ({teams.length} командадан)</p>}
            </div>
            <div className="w-full space-y-2 text-left">
              {teams.slice(0, 5).map((t, i) => (
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
