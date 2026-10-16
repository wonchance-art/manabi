#!/usr/bin/env node
// Wikisource 정본 책 원문 받기·고정(LIT-SRC-WS-1, 오너 「같이해. 위 3편+3편+1편(레미제라블 추가). 간체와 번체 옵션 같이」 2026-10-17 KST).
//
//   NODE_USE_ENV_PROXY=1 node scripts/literature/ws-add-work.mjs --wiki fr --key ws-fr-jules-verne_le-tour-du-monde \
//     --main "Le Tour du monde en quatre-vingts jours" --pattern "^Le Tour du monde en quatre-vingts jours/Chapitre \d+$"
//   NODE_USE_ENV_PROXY=1 node scripts/literature/ws-add-work.mjs --wiki zh --key ws-zh-lu-xun_kong-yi-ji --main 孔乙己 --variants zh-hans,zh-hant
//
// 한 쪽(장)마다 렌더된 본문 조각(교정본 prp-pages-output — 없으면 본문에서 머리·꼬리 틀을 뺀 것)만 source/에 저장하고, 파일마다
// SHA-256과 위키 판 번호(revid)를 entry.json에 적는다 — Standard Ebooks의 커밋 고정과 같은 원리(원문이 바뀌면 빌드가 실패).
// 중국어는 같은 쪽을 간체(zh-hans)·번체(zh-hant)로 따로 받는다 — 위키문헌의 글자 변환기가 같은 교정본에서 두 글자로 그린다.
// 받기는 1초에 한 번(위키미디어 예절). 권리·표기·레벨은 entry.json에 사람이 적고 --approve로 확정한다(빌드는 approved만 쓴다).
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = 'src/content/literature/wikisource';
const UA = 'manabi-literature/1.0 (non-commercial language-learning reader; https://manabi.co.kr)';
const WIKIS = { zh: 'https://zh.wikisource.org', fr: 'https://fr.wikisource.org', ko: 'https://ko.wikisource.org' };
const KEY = /^ws-(zh|fr|ko)-[a-z0-9]+(?:-[a-z0-9]+)*_[a-z0-9]+(?:-[a-z0-9]+)*$/u;

const args = process.argv.slice(2);
const flag = (name) => { const index = args.indexOf(`--${name}`); return index >= 0 ? args[index + 1] : null; };
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

async function get(url) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetch(url, { headers: { 'user-agent': UA } });
    if (response.ok) return response.text();
    if (response.status !== 429 && response.status < 500) throw new Error(`${response.status} ${url}`);
    // 429는 Retry-After(초)를 따른다 — 없으면 30초씩 늘려 기다린다(위키미디어 API 한도).
    const retryAfter = Number(response.headers.get('retry-after'));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 300) * 1000 : 30000 * (attempt + 1));
  }
  throw new Error(`받지 못했다: ${url}`);
}

/** 같은 깊이의 닫는 </div>까지 — 렌더 HTML의 div 하나를 통째로. 못 찾으면 null. */
export function balancedDiv(html, start) {
  const pattern = /<(\/?)div\b[^>]*>/gu;
  pattern.lastIndex = start;
  let depth = 0;
  for (let match = pattern.exec(html); match; match = pattern.exec(html)) {
    depth += match[1] ? -1 : 1;
    if (depth === 0) return html.slice(start, match.index + match[0].length);
  }
  return null;
}

/** 렌더 HTML → 본문 조각. 교정본(prp-pages-output)이 있으면 그것, 없으면 parser-output에서 머리·꼬리 틀을 뺀 것. */
export function extractFragment(html) {
  const prp = html.search(/<div class="prp-pages-output"/u);
  if (prp >= 0) return { extract: 'prp', html: balancedDiv(html, prp) };
  const root = html.search(/<div class="mw-content-ltr mw-parser-output"/u);
  if (root < 0) throw new Error('본문(mw-parser-output)이 없다');
  let body = balancedDiv(html, root);
  for (const name of ['headertemplate', 'footertemplate', 'licenseContainer', 'licensetpl', 'noprint', 'ws-noexport']) {
    for (let at = body.search(new RegExp(`<div class="[^"]*\\b${name}\\b`, 'u')); at >= 0; at = body.search(new RegExp(`<div class="[^"]*\\b${name}\\b`, 'u'))) {
      const block = balancedDiv(body, at);
      if (!block) break;
      body = body.slice(0, at) + body.slice(at + block.length);
    }
  }
  // 본문 뒤 꼬리 제목(한국어 위키문헌 「바깥 고리」 · 「라이선스」 — 저작권 틀 위 h1/h2)은 본문이 아니다
  body = body.replace(/<div class="mw-heading mw-heading[1-6]"><h([1-6]) id="(?:라이선스|바깥_고리)">[\s\S]*?<\/h\1><\/div>\n?/gu, '');
  return { extract: 'body', html: body };
}

async function main() {
  const wiki = flag('wiki');
  const key = flag('key');
  const mainTitle = flag('main');
  const pattern = flag('pattern');
  const variants = (flag('variants') || '').split(',').filter(Boolean);
  if (!WIKIS[wiki] || !KEY.test(key ?? '') || !key.startsWith(`ws-${wiki}-`) || !mainTitle) {
    throw new Error('--wiki zh|fr|ko --key ws-<wiki>-<작가>_<작품> --main <쪽 제목> [--pattern <장 쪽 정규식>] [--variants zh-hans,zh-hant]');
  }
  if (wiki === 'zh' && variants.join(',') !== 'zh-hans,zh-hant') throw new Error('중국어는 --variants zh-hans,zh-hant(간체 정본 + 번체 보기)');
  if (wiki !== 'zh' && variants.length) throw new Error('글자 변환은 중국어만');
  const base = WIKIS[wiki];
  const render = (title, variant) => `${base}/w/index.php?${new URLSearchParams({ title, action: 'render', ...(variant ? { variant } : {}) })}`;

  let titles = [mainTitle];
  if (pattern) {
    const index = await get(render(mainTitle));
    const wanted = new RegExp(pattern, 'u');
    const decode = (value) => value.replace(/&amp;/gu, '&').replace(/&#039;/gu, "'").replace(/&quot;/gu, '"');
    titles = [...new Set([...index.matchAll(/title="([^"]+)"/gu)].map((match) => decode(match[1])).filter((title) => wanted.test(title)))];
    if (!titles.length) throw new Error(`장 쪽이 없다: ${pattern}`);
    await sleep(1000);
  }

  // 판 번호 — 50쪽씩 한 번에
  const revisions = new Map();
  for (let from = 0; from < titles.length; from += 50) {
    const batch = titles.slice(from, from + 50);
    const json = JSON.parse(await get(`${base}/w/api.php?${new URLSearchParams({ action: 'query', prop: 'revisions', rvprop: 'ids|timestamp', titles: batch.join('|'), format: 'json', formatversion: '2' })}`));
    const normalized = new Map((json.query.normalized || []).map((item) => [item.to, item.from]));
    for (const page of json.query.pages) {
      if (page.missing || !page.revisions?.[0]) throw new Error(`쪽이 없다: ${page.title}`);
      revisions.set(normalized.get(page.title) ?? page.title, { revid: page.revisions[0].revid, timestamp: page.revisions[0].timestamp });
    }
    await sleep(1000);
  }

  const out = path.join(ROOT, key);
  mkdirSync(path.join(out, 'source'), { recursive: true });
  const files = [];
  for (const [index, title] of titles.entries()) {
    const revision = revisions.get(title);
    if (!revision) throw new Error(`판 번호가 없다: ${title}`);
    const stem = String(index + 1).padStart(3, '0');
    const page = { page: title, revid: revision.revid, timestamp: revision.timestamp, variants: [] };
    for (const variant of variants.length ? variants : [null]) {
      const { extract, html } = extractFragment(await get(render(title, variant)));
      if (!html) throw new Error(`본문 조각을 닫지 못했다: ${title}`);
      const file = `${stem}${variant ? `.${variant}` : ''}.html`;
      writeFileSync(path.join(out, 'source', file), `${html}\n`);
      page.variants.push({ variant, path: file, extract, sha256: sha256(`${html}\n`) });
      process.stdout.write(`  ${file} ← ${title}${variant ? ` (${variant})` : ''}\n`);
      await sleep(1000);
    }
    files.push(page);
  }

  const entryPath = path.join(out, 'entry.json');
  const previous = existsSync(entryPath) ? JSON.parse(readFileSync(entryPath, 'utf8')) : {};
  const entry = {
    schemaVersion: 1,
    provider: 'wikisource',
    wiki,
    key,
    main: mainTitle,
    url: `${base}/wiki/${encodeURIComponent(mainTitle.replace(/ /gu, '_'))}`,
    title: previous.title ?? '', author: previous.author ?? '', level: previous.level ?? '',
    publishedYear: previous.publishedYear ?? null, authorDeathYear: previous.authorDeathYear ?? null,
    countryOfOrigin: previous.countryOfOrigin ?? null, mortPourLaFrance: previous.mortPourLaFrance ?? null,
    rights: previous.rights ?? { status: 'pending', basis: 'public-domain', reviewedJurisdictions: [], reviewer: null, reviewedAt: null },
    display: previous.display ?? {},
    fetchedAt: new Date().toISOString().slice(0, 10),
    files,
  };
  if (args.includes('--approve')) entry.rights = { ...entry.rights, status: 'approved' };
  writeFileSync(entryPath, `${JSON.stringify(entry, null, 2)}\n`);
  process.stdout.write(`✓ ${key}: ${files.length}쪽 — ${entryPath}에 제목·작가·권리·표기를 적는다\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => { process.stderr.write(`✗ ${error.message}\n`); process.exit(1); });
}
