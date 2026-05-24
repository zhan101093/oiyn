import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');
const FILE = join(DATA_DIR, 'sessions.json');

export interface SessionPlayer { id: string; name: string; score: number }

export interface GameSession {
  id: string;
  date: string;
  category: string;
  categoryLabel: string;
  difficulty: string;
  players: SessionPlayer[];
}

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

export function getSessions(): GameSession[] {
  ensureDir();
  if (!existsSync(FILE)) return [];
  try { return JSON.parse(readFileSync(FILE, 'utf-8')); } catch { return []; }
}

export function addSession(session: GameSession): void {
  ensureDir();
  const all = getSessions();
  all.unshift(session);
  writeFileSync(FILE, JSON.stringify(all.slice(0, 200), null, 2));
}
