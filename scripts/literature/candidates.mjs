#!/usr/bin/env node
/**
 * 정본 문학책 후보 고르기 — 青空文庫 공식 색인 + 접속 순위(유명도)에서 선정 기준(D5·新字新仮名·원작만)을 통과하는 작품을
 * 유명한 순으로 보인다. 손으로 도서 카드를 하나씩 열어 보던 일을 대신한다. 결과는 「후보」일 뿐이다 — 외자·분량은
 * add-work.mjs가 원문을 받아 다시 확인하고, 권리 기록은 사람이 남긴다.
 *
 *   node scripts/literature/candidates.mjs                  상위 40편(이미 수록한 작품 제외)
 *   node scripts/literature/candidates.mjs --top 100 --author 芥川竜之介
 *   node scripts/literature/candidates.mjs --all            기준 밖 작품도 이유와 함께(왜 못 넣는지 볼 때)
 *   node scripts/literature/candidates.mjs --json > candidates.json
 *
 * 네트워크: www.aozora.gr.jp(색인 zip 약 2MB · 순위 3쪽). 받은 것은 OS 임시 폴더에 하루 동안 둔다.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../eval/productImportHooks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LITERATURE_ROOT = path.join(ROOT, 'src/content/literature/aozora');
const CACHE = path.join(tmpdir(), 'manabi-aozora');
const DAY = 24 * 60 * 60 * 1000;

const {
  AOZORA_INDEX_URL, AOZORA_RANKING_YEARS, aozoraRankingUrl, parseCsv, aozoraIndexWorks, aozoraCandidateIssues,
  parseAozoraRanking, unzipEntries,
} = await import('../lib/aozora-index.mjs');

export async function cachedFetch(url, name) {
  mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, name);
  if (existsSync(file) && Date.now() - statSync(file).mtimeMs < DAY) return readFileSync(file);
  for (let attempt = 1; ; attempt += 1) {
    try {
      const res = await fetch(url);
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      const body = Buffer.from(await res.arrayBuffer());
      writeFileSync(file, body);
      return body;
    } catch (error) {
      if (attempt >= 4) throw new Error(`${url}: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
}

/** 색인 + 순위를 받아 작품 Map(유명도 popularity 포함)을 돌려준다 — add-work.mjs도 쓴다. */
export async function loadAozoraIndex() {
  const zip = await cachedFetch(AOZORA_INDEX_URL, 'list_person_all_extended_utf8.zip');
  const csv = unzipEntries(zip).find((entry) => entry.name.endsWith('.csv'));
  if (!csv) throw new Error('색인 zip에 csv가 없다');
  const works = aozoraIndexWorks(parseCsv(csv.bytes.toString('utf8')));
  for (const year of AOZORA_RANKING_YEARS) {
    const html = (await cachedFetch(aozoraRankingUrl(year), `ranking-${year}.html`)).toString('utf8');
    for (const [id, count] of parseAozoraRanking(html)) {
      const work = works.get(id);
      if (work) work.popularity = (work.popularity ?? 0) + count;
    }
  }
  return works;
}

export function includedWorkIds() {
  if (!existsSync(LITERATURE_ROOT)) return new Set();
  return new Set(readdirSync(LITERATURE_ROOT).map((name) => name.match(/^aozora-\d{6}-(\d{6})$/u)?.[1]).filter(Boolean).map((id) => String(Number(id))));
}

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const top = Number(option('--top', 40));
  const author = option('--author', null);
  const all = process.argv.includes('--all');
  const included = includedWorkIds();
  const works = [...(await loadAozoraIndex()).values()]
    .filter((work) => !included.has(work.workId))
    .filter((work) => !author || work.author?.name === author)
    .map((work) => ({ ...work, issues: aozoraCandidateIssues(work) }))
    .filter((work) => all || work.issues.length === 0)
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0) || Number(a.workId) - Number(b.workId))
    .slice(0, top);
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(works.map(({ people: _people, ...work }) => work), null, 2));
  } else {
    console.log('| 순위 | 작품ID | 작품 | 저자(몰년) | 初出 | 열람(2020–22) | 문자 집합 | 기준 밖 이유 |');
    console.log('|---|---|---|---|---|---|---|---|');
    works.forEach((work, index) => {
      console.log(`| ${index + 1} | ${work.workId} | ${work.title} | ${work.author?.name ?? '?'}(${work.author?.deathYear ?? '?'}) | ${work.publishedYear ?? '—'} | ${(work.popularity ?? 0).toLocaleString()} | ${work.textCharset} | ${work.issues.join(' · ') || '—'} |`);
    });
    console.log(`\n다음: node scripts/literature/add-work.mjs <작품ID>  (외자·분량은 원문을 받아 확인한다)`);
  }
}
