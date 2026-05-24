'use client';

import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { PublicState } from '@/lib/game-store';

// ─── Choice color palette (Kahoot-style) ───────────────────────────────────────
type ChoiceKey = 'A' | 'B' | 'C' | 'D';

const CHOICE_COLORS: Record<ChoiceKey, { card: string; badge: string; text: string }> = {
  A: { card: 'bg-red-500',    badge: 'bg-red-700 text-white',    text: 'text-white' },
  B: { card: 'bg-blue-600',   badge: 'bg-blue-800 text-white',   text: 'text-white' },
  C: { card: 'bg-amber-400',  badge: 'bg-amber-600 text-white',  text: 'text-ink'   },
  D: { card: 'bg-green-600',  badge: 'bg-green-800 text-white',  text: 'text-white' },
};

// ─── Circular Timer ────────────────────────────────────────────────────────────
function CircularTimer({ timeLeft, maxTime = 60 }: { timeLeft: number; maxTime?: number }) {
  const r = 70;
  const circ = 2 * Math.PI * r;
  const progress = Math.max(0, timeLeft) / maxTime;
  const offset = circ * (1 - progress);
  const urgent = timeLeft <= 10;

  return (
    <div className={`relative flex items-center justify-center ${urgent ? 'animate-[timerUrgent_0.5s_ease-in-out_infinite]' : ''}`}>
      <svg width={180} height={180} className="-rotate-90">
        <circle cx={90} cy={90} r={r} fill="none" stroke="#E8E3DA" strokeWidth={10} />
        <circle
          cx={90} cy={90} r={r} fill="none"
          stroke={urgent ? '#DC2626' : '#D4AF37'}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className="timer-circle"
        />
      </svg>
      <div className="absolute text-center">
        <span className={`text-5xl font-black tabular-nums leading-none ${urgent ? 'text-crimson' : 'text-ink'}`}>
          {timeLeft}
        </span>
        <p className="text-xs text-muted font-medium mt-1">сек</p>
      </div>
    </div>
  );
}

// ─── Answer card ───────────────────────────────────────────────────────────────
function AnswerCard({
  choice,
  text,
  revealCorrect,
  isCorrect,
  answerCount,
}: {
  choice: ChoiceKey;
  text: string;
  revealCorrect: boolean;
  isCorrect: boolean;
  answerCount: number;
}) {
  const { card, badge, text: textCls } = CHOICE_COLORS[choice];

  const cardCls = revealCorrect
    ? isCorrect
      ? `${card} ring-4 ring-gold ring-offset-2 scale-105 answer-correct`
      : `${card} opacity-25 grayscale`
    : card;

  return (
    <div className={`answer-card flex items-start gap-4 p-5 rounded-2xl min-h-[90px] transition-all duration-500 ${cardCls}`}>
      <span className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black ${badge}`}>
        {choice}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-lg font-semibold leading-snug ${textCls}`}>{text}</p>
        {revealCorrect && isCorrect && (
          <p className="text-sm font-bold text-white mt-1 drop-shadow">✦ Дұрыс жауап</p>
        )}
        {revealCorrect && (
          <p className={`text-xs mt-1 ${textCls} opacity-80`}>{answerCount} ойыншы таңдады</p>
        )}
      </div>
    </div>
  );
}

// ─── Leaderboard ───────────────────────────────────────────────────────────────
function LeaderboardView({ teams }: { teams: PublicState['teams'] }) {
  const top = teams.slice(0, 10);
  const medals = ['rank-gold', 'rank-silver', 'rank-bronze'];
  const maxScore = top[0]?.score ?? 1;

  return (
    <div className="animate-[fadeIn_0.5s_ease-out] w-full max-w-3xl mx-auto">
      <h2 className="text-4xl font-black text-ink text-center mb-8">
        <span className="text-gold">✦</span> Рейтинг кестесі <span className="text-gold">✦</span>
      </h2>
      <div className="space-y-3">
        {top.map((team, i) => (
          <div key={team.id} className="animate-[slideUp_0.4s_ease-out]" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center gap-4 bg-white rounded-2xl border-2 border-border px-5 py-3">
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0 ${medals[i] ?? 'bg-gray-100 text-muted'}`}>
                {i + 1}
              </span>
              <span className="flex-1 font-bold text-xl text-ink truncate">{team.name}</span>
              <div className="flex items-center gap-3">
                <div className="hidden sm:block w-32 h-2 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full score-bar"
                    style={{ width: `${(team.score / maxScore) * 100}%`, background: i === 0 ? '#D4AF37' : '#6B6B6B' }}
                  />
                </div>
                <span className={`font-black text-xl ${i === 0 ? 'text-gold' : 'text-ink'}`}>{team.score}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const TV_LEVELS = [
  { lvl: 1 as const, label: 'Оңай', sub: '1-деңгей', activeCard: 'bg-green-500 border-green-500', activeText: 'text-white', inactiveCard: 'bg-white border-green-200', inactiveText: 'text-green-700' },
  { lvl: 2 as const, label: 'Орташа', sub: '2-деңгей', activeCard: 'bg-gold border-gold', activeText: 'text-white', inactiveCard: 'bg-white border-gold/30', inactiveText: 'text-gold-dark' },
  { lvl: 3 as const, label: 'Күрделі', sub: '3-деңгей', activeCard: 'bg-crimson border-crimson', activeText: 'text-white', inactiveCard: 'bg-white border-crimson/30', inactiveText: 'text-crimson' },
];

// ─── Lobby ─────────────────────────────────────────────────────────────────────
function LobbyView({
  teams,
  selectedLevel,
  onSelectLevel,
  onStart,
}: {
  teams: PublicState['teams'];
  selectedLevel: 1 | 2 | 3 | null;
  onSelectLevel: (level: 1 | 2 | 3) => void;
  onStart: () => void;
}) {
  const [playUrl, setPlayUrl] = useState('');
  useEffect(() => {
    const { hostname, port, origin } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      fetch('/api/local-ip')
        .then((r) => r.json())
        .then(({ ip }: { ip: string }) => {
          setPlayUrl(`http://${ip}${port ? `:${port}` : ''}/play`);
        })
        .catch(() => setPlayUrl(origin + '/play'));
    } else {
      setPlayUrl(origin + '/play');
    }
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 animate-[fadeIn_0.5s_ease-out]">
      <div className="text-center">
        <h1 className="text-7xl font-black text-ink tracking-tight">ОЙЫН</h1>
        <p className="text-2xl text-muted font-medium mt-2">Отбасылық викторина</p>
      </div>

      {/* Level selection */}
      <div className="w-full max-w-2xl">
        <p className="text-center text-muted font-semibold text-lg mb-4">Деңгей таңдаңыз</p>
        <div className="grid grid-cols-3 gap-4">
          {TV_LEVELS.map(({ lvl, label, sub, activeCard, activeText, inactiveCard, inactiveText }) => {
            const active = selectedLevel === lvl;
            return (
              <button
                key={lvl}
                onClick={() => onSelectLevel(lvl)}
                className={`py-6 rounded-2xl border-4 font-black text-2xl transition-all duration-300 active:scale-95 flex flex-col items-center gap-1 ${active ? `${activeCard} ${activeText} scale-105 shadow-xl` : `${inactiveCard} ${inactiveText}`}`}
              >
                <span>{label}</span>
                <span className={`text-sm font-semibold ${active ? 'opacity-80' : 'opacity-60'}`}>{sub} · 20 сұрақ</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* QR + players — shown once level is selected */}
      {selectedLevel && (
        <div className="flex items-start gap-12 animate-[fadeIn_0.4s_ease-out]">
          <div className="flex flex-col items-center gap-3">
            <div className="bg-white p-4 rounded-2xl border-2 border-gold shadow-md">
              {playUrl ? (
                <QRCodeSVG value={playUrl} size={160} />
              ) : (
                <div className="w-[160px] h-[160px] flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-gold border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <p className="text-gold font-bold text-base">Қатысу үшін сканерлеңіз</p>
            <p className="text-muted text-sm font-medium">{playUrl || 'localhost:3000/play'}</p>
          </div>

          <div className="flex flex-col gap-3 min-w-[280px]">
            <p className="text-muted font-semibold">
              {teams.length > 0 ? `Қосылған ойыншылар (${teams.length})` : 'Ойыншыларды күте отырыңыз...'}
            </p>
            {teams.length > 0 && (
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {teams.map((t) => (
                  <div key={t.id} className="bg-white border-2 border-gold/30 rounded-xl px-3 py-2 flex items-center gap-2 animate-[bounceIn_0.5s_ease-out]">
                    <span className="w-2 h-2 rounded-full bg-gold flex-shrink-0" />
                    <span className="font-semibold text-ink truncate text-sm">{t.name}</span>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={onStart}
              disabled={teams.length === 0}
              className="w-full py-4 rounded-2xl bg-gold text-white font-black text-2xl hover:bg-gold-dark active:scale-95 transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed mt-2"
            >
              ▶ Ойынды бастау
            </button>
            {teams.length === 0 && (
              <p className="text-xs text-muted text-center">Командалар қосылуын күтіңіз</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Finished ──────────────────────────────────────────────────────────────────
function FinishedView({ teams, countdown }: { teams: PublicState['teams']; countdown: number | null }) {
  const winner = teams[0];
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 animate-[fadeIn_0.5s_ease-out]">
      <div className="text-center">
        <p className="text-6xl mb-4">🏆</p>
        <h2 className="text-5xl font-black text-gold">Ойын аяқталды!</h2>
        {winner && (
          <p className="text-3xl text-ink font-bold mt-3">
            Жеңімпаз: <span className="text-gold">{winner.name}</span> ({winner.score} ұпай)
          </p>
        )}
        {countdown !== null && (
          <p className="text-sm text-muted mt-3">
            Басты бетке қайту: <span className="font-bold text-ink">{countdown}с</span>
          </p>
        )}
      </div>
      <LeaderboardView teams={teams} />
    </div>
  );
}

// ─── Main TV Page ──────────────────────────────────────────────────────────────
async function ctrl(action: string, extra?: Record<string, unknown>) {
  await fetch('/api/game/control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...extra }),
  }).catch(() => {});
}

export default function TVPage() {
  const [state, setState] = useState<PublicState | null>(null);
  const [resetCountdown, setResetCountdown] = useState<number | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const connect = () => {
      const es = new EventSource('/api/game/events');
      esRef.current = es;
      es.onmessage = (e) => {
        try { setState(JSON.parse(e.data)); } catch { /* ignore */ }
      };
      es.onerror = () => { es.close(); setTimeout(connect, 3000); };
    };
    connect();
    return () => esRef.current?.close();
  }, []);

  // Auto-reset 2 minutes after game finishes
  useEffect(() => {
    if (state?.status !== 'finished') { setResetCountdown(null); return; }
    setResetCountdown(120);
    const interval = setInterval(() => {
      setResetCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          ctrl('reset');
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [state?.status]);

  if (!state) {
    return (
      <div className="tv-screen flex items-center justify-center bg-cream">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted font-semibold">Жүктелуде...</p>
        </div>
      </div>
    );
  }

  const { status, currentQuestion, timeLeft, teams, answers, currentQuestionIndex, totalQuestions, selectedLevel } = state;

  const isActiveGame = status === 'question' || status === 'reveal' || status === 'leaderboard';

  return (
    <div className="tv-screen bg-cream flex flex-col overflow-hidden">

      {/* ── Game control overlay — top-right during active game ── */}
      {isActiveGame && (
        <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 items-end">
          {status === 'question' && (
            <button
              onClick={() => ctrl('reveal')}
              className="px-5 py-2 rounded-xl bg-gold text-white font-bold text-sm shadow-lg hover:bg-gold-dark active:scale-95 transition-all"
            >
              Жауапты ашу
            </button>
          )}
          {status === 'reveal' && (
            <button
              onClick={() => ctrl('next')}
              className="px-5 py-2 rounded-xl bg-gold text-white font-bold text-sm shadow-lg hover:bg-gold-dark active:scale-95 transition-all"
            >
              Келесі сұрақ →
            </button>
          )}
          {status === 'leaderboard' && (
            <button
              onClick={() => ctrl('next')}
              className="px-5 py-2 rounded-xl bg-gold text-white font-bold text-sm shadow-lg hover:bg-gold-dark active:scale-95 transition-all"
            >
              Келесі сұрақ →
            </button>
          )}
          <button
            onClick={() => ctrl('finish')}
            className="px-5 py-2 rounded-xl bg-white border-2 border-crimson text-crimson font-bold text-sm shadow-lg hover:bg-crimson hover:text-white active:scale-95 transition-all"
          >
            Ойынды аяқтау
          </button>
        </div>
      )}

      {/* ── LOBBY ── */}
      {status === 'lobby' && (
        <div className="flex-1 p-8">
          <LobbyView
            teams={teams}
            selectedLevel={selectedLevel}
            onSelectLevel={(lvl) => ctrl('selectLevel', { level: lvl })}
            onStart={() => ctrl('start')}
          />
        </div>
      )}

      {/* ── QUESTION or REVEAL ── */}
      {(status === 'question' || status === 'reveal') && currentQuestion && (
        <div className="flex-1 flex flex-col p-6 gap-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-gold bg-gold/10 text-gold font-bold text-sm">
              {currentQuestion.level}
            </span>
            <span className="text-muted font-semibold text-sm">
              {currentQuestionIndex + 1} / {totalQuestions} сұрақ
            </span>
            <div className="flex items-center gap-3">
              {answers.length > 0 && (
                <span className="text-sm text-muted">{answers.length}/{teams.length} жауап</span>
              )}
            </div>
          </div>

          {/* Question + Timer row */}
          <div className="flex items-center gap-6 flex-1 min-h-0">
            <div className="flex-1">
              <p className="text-3xl xl:text-4xl font-black text-ink leading-tight">
                {currentQuestion.text}
              </p>
            </div>
            {status === 'question' && (
              <div className="flex-shrink-0">
                <CircularTimer timeLeft={timeLeft} />
              </div>
            )}
            {status === 'reveal' && (
              <div className="flex-shrink-0 text-center">
                <p className="text-sm text-muted font-semibold mb-1">Дұрыс жауап</p>
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${CHOICE_COLORS[currentQuestion.correctAnswer as ChoiceKey]?.card ?? 'bg-gold'}`}>
                  <span className="text-white font-black text-3xl">{currentQuestion.correctAnswer}</span>
                </div>
              </div>
            )}
          </div>

          {/* Answers grid */}
          <div className="grid grid-cols-2 gap-3">
            {(['A', 'B', 'C', 'D'] as ChoiceKey[]).map((ch) => {
              const count = answers.filter((a) => a.choice === ch).length;
              return (
                <AnswerCard
                  key={ch}
                  choice={ch}
                  text={currentQuestion.options[ch]}
                  revealCorrect={status === 'reveal'}
                  isCorrect={currentQuestion.correctAnswer === ch}
                  answerCount={count}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── LEADERBOARD ── */}
      {status === 'leaderboard' && (
        <div className="flex-1 flex items-center justify-center p-8">
          <LeaderboardView teams={teams} />
        </div>
      )}

      {/* ── FINISHED ── */}
      {status === 'finished' && (
        <div className="flex-1 p-8 overflow-auto">
          <FinishedView teams={teams} countdown={resetCountdown} />
        </div>
      )}

      {/* Live answer ticker */}
      {status === 'question' && answers.length > 0 && (
        <div className="border-t border-border bg-white px-6 py-2 flex items-center gap-3 overflow-hidden">
          <span className="text-xs font-bold text-gold uppercase tracking-wider flex-shrink-0">Жауап берді</span>
          <div className="flex gap-2 flex-wrap">
            {answers.slice(-8).map((a) => (
              <span key={a.teamId} className="text-xs bg-gold/10 text-gold font-semibold px-2 py-1 rounded-lg">
                {a.teamName}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
