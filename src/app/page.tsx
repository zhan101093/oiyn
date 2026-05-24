'use client';

import { useEffect, useRef, useState } from 'react';
import type { PublicState } from '@/lib/game-store';

const STATUS_LABELS: Record<string, string> = {
  lobby: 'Күту залы',
  question: 'Сұрақ белсенді',
  reveal: 'Жауап ашылды',
  leaderboard: 'Рейтинг кестесі',
  finished: 'Ойын аяқталды',
};

const STATUS_COLORS: Record<string, string> = {
  lobby: 'bg-gray-100 text-gray-600',
  question: 'bg-gold/20 text-gold-dark',
  reveal: 'bg-crimson/10 text-crimson',
  leaderboard: 'bg-gold/20 text-gold-dark',
  finished: 'bg-gray-100 text-gray-600',
};

type Action = 'start' | 'reveal' | 'leaderboard' | 'next' | 'reset';

export default function AdminPage() {
  const [state, setState] = useState<PublicState | null>(null);
  const [loading, setLoading] = useState<Action | null>(null);
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

  const send = async (action: Action) => {
    setLoading(action);
    try {
      await fetch('/api/game/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
    } catch { /* ignore */ }
    finally { setLoading(null); }
  };

  if (!state) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { status, teams, currentQuestionIndex, totalQuestions, timeLeft, answers, currentQuestion } = state;

  return (
    <div className="min-h-screen bg-cream p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Title */}
        <div className="text-center">
          <h1 className="text-4xl font-black text-ink">ОЙЫН</h1>
          <p className="text-muted text-sm font-medium">Админ панелі</p>
        </div>

        {/* Status card */}
        <div className="bg-white rounded-2xl border-2 border-border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-ink text-lg">Ойын күйі</h2>
            <span className={`px-3 py-1 rounded-lg text-sm font-bold ${STATUS_COLORS[status] ?? ''}`}>
              {STATUS_LABELS[status] ?? status}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-cream rounded-xl p-3">
              <p className="text-2xl font-black text-gold">{teams.length}</p>
              <p className="text-xs text-muted font-medium">Ойыншы</p>
            </div>
            <div className="bg-cream rounded-xl p-3">
              <p className="text-2xl font-black text-ink">{currentQuestionIndex + 1}/{totalQuestions}</p>
              <p className="text-xs text-muted font-medium">Сұрақ</p>
            </div>
            <div className="bg-cream rounded-xl p-3">
              <p className={`text-2xl font-black ${timeLeft <= 10 ? 'text-crimson' : 'text-ink'}`}>{timeLeft}с</p>
              <p className="text-xs text-muted font-medium">Уақыт</p>
            </div>
          </div>

          {currentQuestion && (
            <div className="mt-4 p-3 bg-gold/5 border border-gold/20 rounded-xl">
              <p className="text-xs font-bold text-gold mb-1">{currentQuestion.level} · Сұрақ {currentQuestionIndex + 1}</p>
              <p className="text-sm font-semibold text-ink line-clamp-2">{currentQuestion.text}</p>
              {currentQuestion.correctAnswer && (
                <p className="text-xs text-muted mt-1">
                  Дұрыс жауап: <span className="font-black text-gold">{currentQuestion.correctAnswer}</span>
                </p>
              )}
            </div>
          )}

          {status === 'question' && (
            <p className="text-sm text-center text-muted mt-3">
              {answers.length} / {teams.length} ойыншы жауап берді
            </p>
          )}
        </div>

        {/* Control buttons */}
        <div className="bg-white rounded-2xl border-2 border-border p-5 shadow-sm">
          <h2 className="font-bold text-ink text-lg mb-4">Басқару</h2>
          <div className="space-y-3">
            {status === 'lobby' && (
              <CtrlBtn label="▶  Ойынды бастау" action="start" loading={loading} onClick={send}
                disabled={teams.length === 0}
                note={teams.length === 0 ? 'Алдымен командалар қосылуы керек' : undefined}
              />
            )}
            {status === 'question' && (
              <CtrlBtn label="Жауапты ашу" action="reveal" loading={loading} onClick={send} />
            )}
            {status === 'reveal' && (
              <>
                <CtrlBtn label="Рейтинг кестесін көрсету" action="leaderboard" loading={loading} onClick={send} />
                <CtrlBtn label="Келесі сұрақ →" action="next" loading={loading} onClick={send} />
              </>
            )}
            {status === 'leaderboard' && (
              <CtrlBtn label="Келесі сұрақ →" action="next" loading={loading} onClick={send} />
            )}
            {status === 'finished' && (
              <p className="text-center text-muted font-semibold py-2">Ойын аяқталды!</p>
            )}
            <CtrlBtn label="Қалпына келтіру (Reset)" action="reset" loading={loading} onClick={send} danger />
          </div>
        </div>

        {/* Team list */}
        <div className="bg-white rounded-2xl border-2 border-border p-5 shadow-sm">
          <h2 className="font-bold text-ink text-lg mb-3">
            Ойыншылар <span className="text-muted font-normal text-sm">({teams.length})</span>
          </h2>
          {teams.length === 0 ? (
            <p className="text-muted text-sm text-center py-4">
              Ойыншылар <strong>localhost:3000/play</strong> арқылы қосылады
            </p>
          ) : (
            <div className="space-y-2">
              {teams.map((t, i) => (
                <div key={t.id} className="flex items-center gap-3 px-3 py-2 bg-cream rounded-xl">
                  <span className="w-6 text-xs font-bold text-muted text-center">{i + 1}</span>
                  <span className="flex-1 font-semibold text-ink truncate">{t.name}</span>
                  <span className="font-black text-gold">{t.score}</span>
                  {answers.find((a) => a.teamId === t.id) && (
                    <span className="w-2 h-2 rounded-full bg-gold animate-pulse" title="Жауап берді" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick links */}
        <div className="bg-white rounded-2xl border-2 border-border p-4 shadow-sm">
          <h2 className="font-bold text-ink text-sm mb-3">Жылдам сілтемелер</h2>
          <div className="grid grid-cols-2 gap-2">
            <a href="/tv" target="_blank" className="flex items-center gap-2 px-4 py-3 bg-gold/10 border-2 border-gold/30 rounded-xl hover:border-gold transition-colors">
              <span className="text-xl">📺</span>
              <span className="font-bold text-gold text-sm">ТД экраны</span>
            </a>
            <a href="/play" target="_blank" className="flex items-center gap-2 px-4 py-3 bg-cream border-2 border-border rounded-xl hover:border-gold transition-colors">
              <span className="text-xl">📱</span>
              <span className="font-bold text-ink text-sm">Ойыншы пульті</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function CtrlBtn({
  label, action, loading, onClick, disabled, note, danger,
}: {
  label: string;
  action: Action;
  loading: Action | null;
  onClick: (a: Action) => void;
  disabled?: boolean;
  note?: string;
  danger?: boolean;
}) {
  const isLoading = loading === action;
  const base = 'w-full py-3 px-5 rounded-xl font-bold text-base transition-all active:scale-95 flex items-center justify-center gap-2 ';
  const cls = danger
    ? `${base} border-2 border-crimson/30 text-crimson hover:bg-crimson/5`
    : `${base} bg-gold text-white hover:bg-gold-dark disabled:opacity-50 disabled:cursor-not-allowed`;

  return (
    <div>
      <button onClick={() => onClick(action)} disabled={disabled || !!loading} className={cls}>
        {isLoading ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : null}
        {label}
      </button>
      {note && <p className="text-xs text-muted mt-1 text-center">{note}</p>}
    </div>
  );
}
