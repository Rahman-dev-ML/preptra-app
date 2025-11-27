import crypto from 'crypto';
import { MCQPoolFile, PoolMCQ } from './mcq-pool';

function stableId(input: string): string {
  return crypto.createHash('sha1').update(input).digest('hex');
}

export function parseTextToPool(subject: string, raw: string): MCQPoolFile {
  const lines = raw.split(/\r?\n/);
  const items: PoolMCQ[] = [];

  const sectionOrder = new Map<string, number>();
  let currentSection = 'General';

  const pushSection = (name: string) => {
    const key = name.trim() || 'General';
    if (!sectionOrder.has(key)) sectionOrder.set(key, sectionOrder.size);
    currentSection = key;
  };

  // Heuristics for parsing blocks
  let q: string | null = null;
  let opts: string[] = [];
  let ans: string | null = null;

  const sanitize = (s: string) => {
    // Normalize unicode and replace common fancy chars
    let t = s.normalize('NFKC')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[–—−]/g, '-')
      .replace(/[·•]/g, '-')
      .replace(/[₀]/g, '0').replace(/[₁]/g, '1').replace(/[₂]/g, '2').replace(/[₃]/g, '3')
      .replace(/[₄]/g, '4').replace(/[₅]/g, '5').replace(/[₆]/g, '6').replace(/[₇]/g, '7')
      .replace(/[₈]/g, '8').replace(/[₉]/g, '9')
      .replace(/[¹]/g, '1').replace(/[²]/g, '2').replace(/[³]/g, '3');
    // Strip non-printable replacement chars
    t = t.replace(/[\uFFFD]/g, '');
    return t;
  };

  const flush = () => {
    if (!q) return;
    if (opts.length < 4 || !ans) {
      // reset
      q = null; opts = []; ans = null; return;
    }
    const sectionIndex = sectionOrder.get(currentSection) ?? 0;
    const qSan = sanitize(q);
    const optsSan = opts.slice(0,4).map(o => sanitize(o));
    const id = stableId(`${qSan}\n${optsSan.join('\n')}\n${ans}`);
    items.push({ id, sectionIndex, question: qSan.trim(), options: optsSan, correct: ans.trim().slice(0,1).toUpperCase() as any });
    q = null; opts = []; ans = null;
  };

  for (let rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Section headers like: "Section 1: Topic Name" or "## Section 1:" or "---" dividers
    const secMatch = line.match(/^#{0,2}\s*Section\s+\d+:|^[-–—]{3,}|^(Easy|Medium|Hard)\b/i);
    if (secMatch) {
      flush();
      if (/Section\s+\d+:/i.test(line)) {
        const sectionName = line.replace(/^#{0,2}\s*Section\s+\d+:\s*/i, '').replace(/\s*\(\d+\s*MCQs?\)\s*$/i, '');
        pushSection(sanitize(sectionName));
      }
      continue;
    }

    // Options: A) text or A. text or - A) text (with optional leading spaces)
    const optMatch = line.match(/^\s*(?:[-*]\s*)?([ABCD])[\)\.\-:]\s*(.+)$/i);
    if (optMatch) {
      const letter = optMatch[1].toUpperCase();
      const text = sanitize(optMatch[2].trim());
      const index = letter.charCodeAt(0) - 'A'.charCodeAt(0);
      opts[index] = `${letter}) ${text}`;
      continue;
    }

    // Answer: X
    const ansMatch = line.match(/^Answer\s*:\s*([ABCD])/i);
    if (ansMatch) {
      ans = ansMatch[1].toUpperCase();
      flush();
      continue;
    }

    // Otherwise if no options yet, treat as question (handle numbered questions like "1. Question text")
    // Skip section-like headers that are actually question labels
    if (!q && !/^Answer\s*:/i.test(line) && !/^\d+\.\s*\w+.*\((Easy|Medium|Hard)\)\s*$/i.test(line)) {
      q = sanitize(line.replace(/^Q\.?\s*/i, '').replace(/^\d+\.\s*/, '').trim());
      continue;
    }
  }

  // finalize
  const totalSections = Math.max(1, sectionOrder.size || 1);
  return { version: new Date().toISOString(), totalSections, items };
}


