import fs from 'fs';
import path from 'path';

export interface PoolMCQ {
  id: string;
  sectionIndex: number;
  question: string;
  options: string[];
  correct: string; // 'A' | 'B' | 'C' | 'D'
  note?: string;
}

export interface MCQPoolFile {
  version: string;
  totalSections: number;
  items: PoolMCQ[];
}

export function normalizeSubjectName(subject: string): string {
  return subject
    .toLowerCase()
    .replace(/\s+&\s+/g, '-and-')
    .replace(/\s+/g, '-');
}

export function getPoolFilePath(subject: string, difficulty: string): string {
  const normalized = normalizeSubjectName(subject);
  return path.join(process.cwd(), 'public', 'data', 'mcqs', normalized, `${difficulty}.json`);
}

export function loadPool(subject: string, difficulty: string): MCQPoolFile | null {
  try {
    const filePath = getPoolFilePath(subject, difficulty);
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function ensureDirForPool(subject: string) {
  const dir = path.join(process.cwd(), 'public', 'data', 'mcqs', normalizeSubjectName(subject));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Simple in-memory recent ring buffers to avoid immediate repeats across sessions
const recentServedIds: Map<string, string[]> = new Map();
const RECENT_MAX = 200; // per (subject,difficulty)

export function sampleFromPool(subject: string, difficulty: string, count: number, sectionLimit?: number): PoolMCQ[] {
  const pool = loadPool(subject, difficulty);
  if (!pool || !pool.items?.length) return [];
  const validItems = pool.items.filter(it => {
    const optsOk = Array.isArray(it.options) && it.options.length >= 4 && it.options.every(o => typeof o === 'string' && o.length > 0);
    const qOk = typeof it.question === 'string' && it.question.length > 0;
    const c = (it.correct || '').toString().trim().charAt(0).toUpperCase();
    const correctOk = ['A','B','C','D'].includes(c);
    return optsOk && qOk && correctOk;
  });
  if (!validItems.length) return [];

  const key = `${normalizeSubjectName(subject)}|${difficulty}`;
  const recent = recentServedIds.get(key) || [];
  const recentSet = new Set(recent);

  // Prefer distinct sections first
  const bySection = new Map<number, PoolMCQ[]>();
  for (const item of validItems) {
    if (recentSet.has(item.id)) continue;
    const arr = bySection.get(item.sectionIndex) || [];
    arr.push(item);
    bySection.set(item.sectionIndex, arr);
  }

  // Choose a limited number of sections to create FOMO
  const allSections = Array.from(bySection.keys());
  allSections.sort((a, b) => a - b);
  const limit = Math.max(1, Math.min(sectionLimit ?? Math.min(8, allSections.length), allSections.length));
  // Randomly choose 'limit' sections
  const shuffled = [...allSections].sort(() => Math.random() - 0.5);
  const sections = shuffled.slice(0, limit);

  // Round-robin pick across chosen sections
  const picked: PoolMCQ[] = [];
  let si = 0;
  while (picked.length < count && sections.length) {
    const s = sections[si % sections.length];
    const arr = bySection.get(s) || [];
    if (arr.length) {
      const idx = Math.floor(Math.random() * arr.length);
      picked.push(arr.splice(idx, 1)[0]);
      bySection.set(s, arr);
    }
    si++;
    // Stop if all arrays are empty
    if (Array.from(bySection.values()).every(a => a.length === 0)) break;
  }

  // If not enough due to recent filter, fill from full pool
  if (picked.length < count) {
    const remaining = pool.items.filter(i => !picked.find(p => p.id === i.id));
    while (picked.length < count && remaining.length) {
      const idx = Math.floor(Math.random() * remaining.length);
      picked.push(remaining.splice(idx, 1)[0]);
    }
  }

  // Update recent ring buffer
  const newRecent = [...recent, ...picked.map(p => p.id)];
  recentServedIds.set(key, newRecent.slice(-RECENT_MAX));

  return picked;
}

export function savePool(subject: string, difficulty: string, pool: MCQPoolFile) {
  const dir = ensureDirForPool(subject);
  const file = path.join(dir, `${difficulty}.json`);
  fs.writeFileSync(file, JSON.stringify(pool, null, 2), 'utf8');
}


