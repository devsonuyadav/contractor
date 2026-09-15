// Demo persistence: the whole database lives in localStorage, one key, versioned by SCHEMA.
import type { DemoDB } from '@/lib/types';
import { SCHEMA, buildSeed } from './seed';

const KEY = 'ezc-demo-db';
let cache: DemoDB | null = null;
let listening = false;

function listen(): void {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  // Another tab wrote the DB: drop our copy so the next request reads theirs.
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) cache = null;
  });
}

export function loadDb(): DemoDB {
  listen();
  if (cache) return cache;
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DemoDB;
        if (parsed && parsed.schema === SCHEMA) {
          cache = parsed;
          return cache;
        }
      }
    } catch {
      // unreadable or blocked storage: fall through to a fresh seed
    }
  }
  cache = buildSeed();
  saveDb(cache);
  return cache;
}

function stripLargeFiles(db: DemoDB): void {
  for (const a of db.assignments) {
    for (const ev of [a.submission.evidence, a.approval?.evidence, ...a.previous.map((p) => p.evidence)]) {
      if (ev && ev.kind === 'DOCUMENT' && ev.file.data_url && ev.file.data_url.length > 60_000) ev.file.data_url = null;
    }
  }
}

export function saveDb(db: DemoDB): void {
  cache = db;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // Storage is full: keep metadata, drop large uploaded previews, try once more.
    stripLargeFiles(db);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      // still full; the in-memory copy keeps working for this tab
    }
  }
}

export function resetDb(): DemoDB {
  cache = buildSeed();
  saveDb(cache);
  return cache;
}
