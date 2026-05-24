import { EventEmitter } from 'events';
import { questions, type Question, type AnswerChoice } from './questions';

export interface Team {
  id: string;
  name: string;
  score: number;
}

export interface AnswerRecord {
  teamId: string;
  teamName: string;
  choice: AnswerChoice;
  timestamp: number;
  isCorrect: boolean;
  pointsEarned: number;
}

export type GameStatus = 'lobby' | 'question' | 'reveal' | 'leaderboard' | 'finished';

export interface PublicQuestion {
  text: string;
  options: Question['options'];
  level: string;
  levelNumber: number;
  correctAnswer?: AnswerChoice;
}

export interface PublicState {
  status: GameStatus;
  currentQuestionIndex: number;
  totalQuestions: number;
  timeLeft: number;
  answers: AnswerRecord[];
  teams: Team[];
  currentQuestion: PublicQuestion | null;
  questionStartTime: number;
  selectedLevel: 1 | 2 | 3 | null;
}

const QUESTION_TIME = 60;

function speedBonus(levelNumber: number, timeLeft: number): number {
  const maxBonus = levelNumber === 1 ? 50 : levelNumber === 2 ? 75 : 100;
  return Math.floor((timeLeft / QUESTION_TIME) * maxBonus);
}

function basePoints(levelNumber: number): number {
  return levelNumber === 1 ? 100 : levelNumber === 2 ? 150 : 200;
}

class GameStore extends EventEmitter {
  private teams: Team[] = [];
  private answers: AnswerRecord[] = [];
  private status: GameStatus = 'lobby';
  private currentQuestionIndex = 0;
  private timeLeft = QUESTION_TIME;
  private questionStartTime = 0;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private revealTimer: ReturnType<typeof setTimeout> | null = null;
  private selectedLevel: 1 | 2 | 3 | null = null;

  private get levelQuestions(): Question[] {
    if (!this.selectedLevel) return [];
    return questions.filter((q) => q.levelNumber === this.selectedLevel);
  }

  private clearRevealTimer(): void {
    if (this.revealTimer) { clearTimeout(this.revealTimer); this.revealTimer = null; }
  }

  private currentShuffleMap: Record<AnswerChoice, AnswerChoice> = { A: 'A', B: 'B', C: 'C', D: 'D' };

  private computeShuffle(): void {
    const keys: AnswerChoice[] = ['A', 'B', 'C', 'D'];
    const pool = [...keys].sort(() => Math.random() - 0.5) as AnswerChoice[];
    keys.forEach((k, i) => { this.currentShuffleMap[k] = pool[i]; });
  }

  private buildPublicQuestion(q: Question, reveal: boolean): PublicQuestion {
    const keys: AnswerChoice[] = ['A', 'B', 'C', 'D'];
    const options = {} as Question['options'];
    let shuffledCorrect: AnswerChoice = 'A';
    for (const newKey of keys) {
      const origKey = this.currentShuffleMap[newKey];
      options[newKey] = q.options[origKey];
      if (origKey === q.correctAnswer) shuffledCorrect = newKey;
    }
    return { text: q.text, options, level: q.level, levelNumber: q.levelNumber, correctAnswer: reveal ? shuffledCorrect : undefined };
  }

  // ─── Public state ────────────────────────────────────────────────────────
  getPublicState(): PublicState {
    const q = this.levelQuestions[this.currentQuestionIndex] ?? null;
    const revealAnswer =
      this.status === 'reveal' || this.status === 'leaderboard' || this.status === 'finished';

    return {
      status: this.status,
      currentQuestionIndex: this.currentQuestionIndex,
      totalQuestions: this.levelQuestions.length,
      timeLeft: this.timeLeft,
      answers: this.answers,
      teams: [...this.teams].sort((a, b) => b.score - a.score),
      questionStartTime: this.questionStartTime,
      currentQuestion: q ? this.buildPublicQuestion(q, revealAnswer) : null,
      selectedLevel: this.selectedLevel,
    };
  }

  // ─── Level selection ──────────────────────────────────────────────────────
  selectLevel(level: 1 | 2 | 3): boolean {
    if (this.status !== 'lobby') return false;
    this.selectedLevel = level;
    this.broadcast();
    return true;
  }

  // ─── Teams ───────────────────────────────────────────────────────────────
  joinTeam(teamId: string, teamName: string): boolean {
    if (this.teams.find((t) => t.id === teamId)) return false;
    if (this.status !== 'lobby') return false;
    const trimmed = teamName.trim().slice(0, 30);
    if (!trimmed) return false;
    this.teams.push({ id: teamId, name: trimmed, score: 0 });
    this.broadcast();
    return true;
  }

  reconnectTeam(teamId: string): Team | null {
    return this.teams.find((t) => t.id === teamId) ?? null;
  }

  // ─── Game control (admin) ─────────────────────────────────────────────────
  startGame(): boolean {
    if (this.status !== 'lobby') return false;
    if (!this.selectedLevel) return false;
    this.currentQuestionIndex = 0;
    this.computeShuffle();
    this.answers = [];
    this.teams.forEach((t) => (t.score = 0));
    this.status = 'question';
    this.startTimer();
    this.broadcast();
    return true;
  }

  revealAnswer(): boolean {
    if (this.status !== 'question') return false;
    this.stopTimer();
    this.status = 'reveal';
    this.broadcast();
    this.revealTimer = setTimeout(() => this.nextQuestion(), 4000);
    return true;
  }

  showLeaderboard(): boolean {
    if (this.status !== 'reveal') return false;
    this.status = 'leaderboard';
    this.broadcast();
    return true;
  }

  nextQuestion(): boolean {
    this.clearRevealTimer();
    if (this.status !== 'reveal' && this.status !== 'leaderboard') return false;
    const next = this.currentQuestionIndex + 1;
    if (next >= this.levelQuestions.length) {
      this.status = 'finished';
      this.broadcast();
      return true;
    }
    this.currentQuestionIndex = next;
    this.computeShuffle();
    this.answers = [];
    this.status = 'question';
    this.startTimer();
    this.broadcast();
    return true;
  }

  resetGame(): void {
    this.stopTimer();
    this.clearRevealTimer();
    this.teams = [];
    this.answers = [];
    this.status = 'lobby';
    this.currentQuestionIndex = 0;
    this.timeLeft = QUESTION_TIME;
    this.questionStartTime = 0;
    this.selectedLevel = null;
    this.broadcast();
  }

  // ─── Answer submission ────────────────────────────────────────────────────
  submitAnswer(
    teamId: string,
    choice: AnswerChoice,
  ): { success: boolean; isCorrect?: boolean; pointsEarned?: number; message?: string } {
    if (this.status !== 'question') return { success: false, message: 'Сұрақ белсенді емес' };

    const team = this.teams.find((t) => t.id === teamId);
    if (!team) return { success: false, message: 'Команда табылмады' };

    if (this.answers.find((a) => a.teamId === teamId))
      return { success: false, message: 'Жауап бұрын берілді' };

    const q = this.levelQuestions[this.currentQuestionIndex];
    if (!q) return { success: false, message: 'Сұрақ жоқ' };

    const isCorrect = this.currentShuffleMap[choice] === q.correctAnswer;
    const elapsed = Math.floor((Date.now() - this.questionStartTime) / 1000);
    const remaining = Math.max(0, QUESTION_TIME - elapsed);
    const pts = isCorrect ? basePoints(q.levelNumber) + speedBonus(q.levelNumber, remaining) : 0;

    this.answers.push({
      teamId,
      teamName: team.name,
      choice,
      timestamp: elapsed,
      isCorrect,
      pointsEarned: pts,
    });
    team.score += pts;
    this.broadcast();

    if (this.answers.length >= this.teams.length && this.teams.length > 0) {
      setTimeout(() => this.revealAnswer(), 500);
    }

    return { success: true, isCorrect, pointsEarned: pts };
  }

  // ─── Timer ────────────────────────────────────────────────────────────────
  private startTimer(): void {
    this.stopTimer();
    this.timeLeft = QUESTION_TIME;
    this.questionStartTime = Date.now();

    this.timerInterval = setInterval(() => {
      this.timeLeft = Math.max(0, this.timeLeft - 1);
      this.broadcast();
      if (this.timeLeft <= 0) {
        this.stopTimer();
        if (this.status === 'question') this.revealAnswer();
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private broadcast(): void {
    this.emit('stateChange', this.getPublicState());
  }
}

// Singleton via global to survive Next.js HMR in dev
const g = global as typeof global & { _gameStore?: GameStore };
if (!g._gameStore) g._gameStore = new GameStore();
export const gameStore = g._gameStore;
