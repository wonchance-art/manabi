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
const WIKIS = { zh: 'https://zh.wikisource.org', fr: 'https://fr.wikisource.org', ko: 'https://ko.wikisource.org', en: 'https://en.wikisource.org' };
const KEY = /^ws-(zh|fr|ko|en)-[a-z0-9]+(?:-[a-z0-9]+)*_[a-z0-9]+(?:-[a-z0-9]+)*$/u;

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
export function extractFragment(html, { section = null } = {}) {
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
  // 한국어 시집(진달래꽃 1925): 「현대어 | 원문」 두 칸 표 — 원문 칸은 옛한글(ᄭᅩᆺ 등)이라 읽기·분석에 쓰지 않고 현대어 칸만 남긴다.
  // 「옛한글을 포함하고 있습니다」 안내 상자(messagebox)도 본문이 아니다.
  body = body.replace(/<table class="messagebox"[\s\S]*?<\/table>\n?/gu, '');
  body = body.replace(/<table class="multicol"[\s\S]*?<\/table>/gu, (table) => {
    const modern = /<td\b[^>]*>\s*<p><b>현대어<\/b>\s*<\/p>([\s\S]*?)<\/td>/u.exec(table);
    if (!modern) throw new Error('두 칸 표에서 현대어 칸을 찾지 못했다');
    return modern[1];
  });
  // 같은 두 칸을 표 대신 나란한 div 두 개로 둔 쪽(먼 후일 등) — 「원문」 칸 div를 통째로 빼고 「현대어」 머리글만 걷는다
  for (let at = body.search(/<div style="[^"]*float:left[^"]*">\s*<center><b>원문<\/b>/u); at >= 0; at = body.search(/<div style="[^"]*float:left[^"]*">\s*<center><b>원문<\/b>/u)) {
    const block = balancedDiv(body, at);
    if (!block) throw new Error('원문 칸 div를 닫지 못했다');
    body = body.slice(0, at) + body.slice(at + block.length);
  }
  body = body.replace(/<center><b>현대어<\/b>\s*<\/center>\n?/gu, '');
  // 본문 뒤 꼬리 제목(한국어 위키문헌 「바깥 고리」 · 「라이선스」 — 저작권 틀 위 h1/h2)은 본문이 아니다
  body = body.replace(/<div class="mw-heading mw-heading[1-6]"><h([1-6]) id="(?:라이선스|바깥_고리)">[\s\S]*?<\/h\1><\/div>\n?/gu, '');
  if (section) return { extract: `section:${section}`, html: sectionOf(body, section) };
  return { extract: 'body', html: body };
}

/**
 * 한 쪽에 판이 여럿 실린 문서(3·1독립선언서 「원문 · 현대어 · 쉽고 바르게 읽는」)에서 h2 한 절만 — 그 제목부터 다음 h2 앞까지.
 * 퍼블릭 도메인인 1919년 원문만 싣는다(현대어 판은 출처 미상 · 「쉽고 바르게」는 공공누리라 권리 선이 다르다).
 */
export function sectionOf(body, id) {
  const heading = (name) => new RegExp(`<div class="mw-heading mw-heading2"><h2 id="${name}">`, 'u');
  const start = body.search(heading(id.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  if (start < 0) throw new Error(`절이 없다: ${id}`);
  const rest = body.slice(start + 1);
  const next = rest.search(heading('[^"]+'));
  // 본문 조각 모양(parser-output 한 div)을 지킨다 — 빌드 파서는 그 뿌리로 위키문헌 조각을 알아본다
  // 절 제목(「원문」)은 판 이름이라 본문·장 제목이 아니다 — 걷어 낸다.
  const part = (next < 0 ? body.slice(start) : body.slice(start, start + 1 + next)).replace(/^<div class="mw-heading mw-heading2">[\s\S]*?<\/div>\n?/u, '');
  return `<div class="mw-content-ltr mw-parser-output">${part}</div>`;
}

async function main() {
  const wiki = flag('wiki');
  const key = flag('key');
  const mainTitle = flag('main');
  const pattern = flag('pattern');
  const variants = (flag('variants') || '').split(',').filter(Boolean);
  if (!WIKIS[wiki] || !KEY.test(key ?? '') || !key.startsWith(`ws-${wiki}-`) || !mainTitle) {
    throw new Error('--wiki zh|fr|ko|en --key ws-<wiki>-<작가>_<작품> --main <쪽 제목> [--pattern <장 쪽 정규식>] [--variants zh-hans,zh-hant]');
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
  const entryPath = path.join(out, 'entry.json');
  const previous = existsSync(entryPath) ? JSON.parse(readFileSync(entryPath, 'utf8')) : {};
  const files = [];
  // 받는 중에 끊겨도 이어 갈 수 있게 쪽마다 진행을 entry.json에 적는다(--resume이 읽는다)
  const progress = () => writeFileSync(entryPath, `${JSON.stringify({ ...previous, files: [...files] }, null, 2)}\n`);
  for (const [index, title] of titles.entries()) {
    const revision = revisions.get(title);
    if (!revision) throw new Error(`판 번호가 없다: ${title}`);
    const stem = String(index + 1).padStart(3, '0');
    const page = { page: title, revid: revision.revid, timestamp: revision.timestamp, variants: [] };
    for (const variant of variants.length ? variants : [null]) {
      const file = `${stem}${variant ? `.${variant}` : ''}.html`;
      // --resume: 한도(429)로 끊긴 받기를 이어 간다 — 이번에 이미 저장한 쪽 조각은 다시 받지 않는다(판 번호는 위에서 새로 받았다)
      if (args.includes('--resume') && existsSync(path.join(out, 'source', file)) && previous.files?.some((item) => item.page === title && item.revid === revision.revid)) {
        const kept = readFileSync(path.join(out, 'source', file), 'utf8');
        page.variants.push({ variant, path: file, extract: previous.files.find((item) => item.page === title).variants.find((item) => item.path === file)?.extract ?? 'body', sha256: sha256(kept) });
        continue;
      }
      const { extract, html } = extractFragment(await get(render(title, variant)), { section: flag('section') });
      if (!html) throw new Error(`본문 조각을 닫지 못했다: ${title}`);
      writeFileSync(path.join(out, 'source', file), `${html}\n`);
      page.variants.push({ variant, path: file, extract, sha256: sha256(`${html}\n`) });
      process.stdout.write(`  ${file} ← ${title}${variant ? ` (${variant})` : ''}\n`);
      await sleep(1000);
    }
    files.push(page);
    if (args.includes('--resume')) progress();
  }

  const entry = {
    schemaVersion: 1,
    provider: 'wikisource',
    wiki,
    key,
    main: mainTitle,
    ...(flag('section') ? { section: flag('section') } : {}),
    url: `${base}/wiki/${encodeURIComponent(mainTitle.replace(/ /gu, '_'))}`,
    title: previous.title ?? '', author: previous.author ?? '', level: previous.level ?? '',
    publishedYear: previous.publishedYear ?? null, authorDeathYear: previous.authorDeathYear ?? null,
    countryOfOrigin: previous.countryOfOrigin ?? null, mortPourLaFrance: previous.mortPourLaFrance ?? null,
    rights: previous.rights ?? { status: 'pending', basis: 'public-domain', reviewedJurisdictions: [], reviewer: null, reviewedAt: null },
    display: previous.display ?? {},
    ...(args.includes('--collection') || previous.collection ? { collection: true } : {}), // 시집 — 시 한 편 = 쪽 하나(빌드가 이어 묶는다)
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
