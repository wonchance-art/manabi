#!/usr/bin/env node
// 실자료 수집 1단 (RFC authentic-sources §4): Tatoeba unstable API에서 fr A1~A2 문형별
// 후보 문장을 스냅샷으로 저장한다. 결정성: 결과는 id 오름차순 정렬·파일 커밋, 검수는 오프라인.
// 공개 엔드포인트·키 불요. 정중한 호출(1.2s 간격·재시도 2회·term 단위 fail-soft).

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.join(fileURLToPath(new URL('../', import.meta.url)), 'scripts/data/tatoeba-fr-snapshot-v1.json');
const API = 'https://api.tatoeba.org/unstable/sentences';
const LIMIT = 20;

// 기준표(docs/curriculum-fr-a1a2.md) 문형 → 검색어
const TERMS = [
  { key: 'a2-15-plus', q: "n'y a plus de" },
  { key: 'a2-15-rien', q: 'rien d’autre' },
  { key: 'a2-15-personne', q: "il n'y a personne" },
  { key: 'a2-16-si-propose', q: 'si tu veux, on peut' },
  { key: 'a2-16-sil-pleut', q: "s'il pleut" },
  { key: 'a2-17-dabord', q: "d'abord" },
  { key: 'a2-18-voudrais', q: 'je voudrais un' },
  { key: 'a2-18-pourriez', q: 'vous pourriez me' },
  { key: 'scene-14-cetait', q: "c'était comment" },
  { key: 'scene-13-rate', q: "j'ai raté" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchTerm(q) {
  const url = `${API}?lang=fra&q=${encodeURIComponent(q)}&sort=relevance&limit=${LIMIT}&trans:lang=eng`;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'manabi-authentic-sources/1 (personal study project)' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return (json.data ?? []).map((s) => ({
        id: s.id,
        text: s.text,
        license: s.license,
        owner: s.owner ?? null,
        unapproved: Boolean(s.is_unapproved),
        translations: (s.translations ?? [])
          .sort((a, b) => Number(b.is_direct) - Number(a.is_direct))
          .slice(0, 2)
          .map((t) => ({ id: t.id, text: t.text, lang: t.lang, license: t.license, owner: t.owner ?? null })),
      })).sort((a, b) => a.id - b.id);
    } catch (e) {
      if (attempt === 3) return { error: String(e) };
      await sleep(1500 * attempt);
    }
  }
  return { error: 'unreachable' };
}

const snapshot = { meta: { source: 'tatoeba', api: 'unstable/sentences', fetchedAt: new Date().toISOString(), limitPerTerm: LIMIT }, terms: {} };
for (const { key, q } of TERMS) {
  const result = await fetchTerm(q);
  if (Array.isArray(result)) {
    snapshot.terms[key] = { query: q, count: result.length, candidates: result };
    console.log(`ok ${key}: ${result.length}건`);
  } else {
    snapshot.terms[key] = { query: q, error: result.error, candidates: [] };
    console.warn(`fail ${key}: ${result.error}`);
  }
  await sleep(1200);
}
await fs.writeFile(OUT, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`snapshot → ${path.relative(process.cwd(), OUT)}`);
