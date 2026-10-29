#!/usr/bin/env node
/**
 * 「그림 한 장 읽기」 출처 스냅샷 받기 (ART-AUTO-1). 네트워크가 필요하다 — CI·prebuild에는 걸지 않는다(세션·수동에서만).
 *
 * 실행(리포 루트, Node fetch는 NODE_USE_ENV_PROXY=1):
 *   node scripts/art/snapshot-sources.mjs                    entries가 고른 출처를 모두 다시 받아 스냅샷을 쓴다
 *   node scripts/art/snapshot-sources.mjs --work <작품 id>   그 작품만(여러 번 줄 수 있다)
 *   node scripts/art/snapshot-sources.mjs --missing          스냅샷이 없는 것만 받는다
 *
 * 쓰는 곳:
 *   src/content/art/sources/colbase/cobas-<번호>.json   재팬서치 항목 API에서 빌드가 쓰는 필드 + 출처 기록(해설 HTML은 받은 그대로)
 *   src/content/art/sources/aic/<id>.json              시카고 미술관 API(id·title·date_display·description)
 *   src/content/art/sources/images/<작품 id>.json       그림 출처 기록(record) + public/art 파일의 sha256·바이트·픽셀
 * 그림 파일은 다시 받지 않는다 — public/art에 둔 파일을 해시한다(받은 바이트 그대로, 재인코딩 없음).
 * 위키미디어 공용 그림(commons)은 공용 API 요청 제한(429) 때문에 record·sourceUrl을 손으로 먼저 쓰고, 이 스크립트는 파일 값만 채운다.
 * 응답 → 스냅샷 모양·크레딧은 src/lib/artSource.js 출처표 하나뿐이다. 받은 내용이 같으면 fetchedAt을 바꾸지 않는다(diff 잡음 방지).
 * 받은 뒤 node scripts/build-art.mjs로 works.json을 만들고 diff(해설 원문 변화)를 검토한다.
 */
import '../eval/productImportHooks.mjs';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const { ART_SOURCES, ART_IMAGE_SOURCES } = await import('../../src/lib/artSource.js');
const { ART_PUBLIC_DIR, ART_ROOT, descriptionSnapshotPath, imageSnapshotPath, jpegSize, kstDate, loadArtEntries, serializeSnapshot, sha256 } =
  await import('../lib/art-build.mjs');

const args = process.argv.slice(2);
const onlyMissing = args.includes('--missing');
const only = new Set(args.flatMap((arg, index) => (arg === '--work' && args[index + 1] ? [args[index + 1]] : [])));
const USER_AGENT = 'manabi-art-catalog/1 (educational; https://github.com/wonchance-art/manabi)';
const GAP_MS = 1100;
const today = kstDate();

let lastRequest = 0;
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/** 직렬 요청 · 1초 간격 · 429면 Retry-After(없으면 지수)만큼 기다려 최대 3번 다시 묻는다. 폐기 응답(404·410)은 명시 오류. */
async function fetchJson(url) {
  for (let attempt = 0; ; attempt += 1) {
    const wait = lastRequest + GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();
    // 시카고 미술관 API는 AIC-User-Agent(이용자 연락처) 머리를 요청한다 — 없으면 봇 차단(Cloudflare 403)에 걸린다(DISCOVER-ART-001 실측 2026-10-23 KST).
    const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': USER_AGENT, 'AIC-User-Agent': USER_AGENT } });
    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get('retry-after'));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt);
      continue;
    }
    if (response.status === 404 || response.status === 410) throw new Error(`${url} → HTTP ${response.status}(없는 기록이거나 폐기된 엔드포인트 — 출처표 ART_SOURCES를 확인한다)`);
    if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`);
    return response.json();
  }
}

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

/** 받은 날짜만 다르면 쓰지 않는다. @returns {'written'|'unchanged'} */
function writeSnapshot(file, value) {
  const current = existsSync(file) ? readJson(file) : null;
  if (current && value.fetchedAt !== undefined) {
    const sameExceptDate = serializeSnapshot({ ...current, fetchedAt: null }) === serializeSnapshot({ ...value, fetchedAt: null });
    if (sameExceptDate) return 'unchanged';
  }
  const output = serializeSnapshot(value);
  if (current && serializeSnapshot(current) === output) return 'unchanged';
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, output);
  return 'written';
}

async function snapshotDescription(ref) {
  const source = ART_SOURCES[ref.source];
  if (!source) throw new Error(`모르는 해설 출처 ${ref.source}`);
  const json = await fetchJson(source.apiUrl(ref.sourceId));
  const snapshot = { ...source.snapshot(json, ref.sourceId), fetchedAt: today };
  if (String(snapshot.id) !== ref.sourceId) throw new Error(`${ref.source}:${ref.sourceId} 응답 id가 ${snapshot.id}다`);
  if (!source.snapshotRaw(snapshot, ref.language)) throw new Error(`${ref.source}:${ref.sourceId}에 ${ref.language} 해설이 없다`);
  return snapshot;
}

async function snapshotImage(entry, file) {
  const ref = entry.image;
  const source = ART_IMAGE_SOURCES[ref.source];
  if (!source) throw new Error(`모르는 그림 출처 ${ref.source}`);
  const current = existsSync(file) ? readJson(file) : null;
  const base = { workId: entry.id, source: ref.source, sourceId: ref.sourceId, file: current?.file ?? `${entry.id}.jpg` };
  let fetched;
  if (source.apiUrl) {
    const json = await fetchJson(source.apiUrl(ref.sourceId));
    fetched = { record: source.record(json), sourceUrl: source.sourceUrl(json), fetchedAt: today };
  } else {
    if (!current?.record || !current?.sourceUrl) throw new Error(`${ref.source} 그림은 ${file}에 record·sourceUrl을 손으로 먼저 쓴다(받는 API가 없다)`);
    fetched = { record: current.record, sourceUrl: current.sourceUrl, ...(current.fetchedAt ? { fetchedAt: current.fetchedAt } : {}) };
    if (current.note) fetched.note = current.note;
  }
  const imageFile = path.join(ART_PUBLIC_DIR, 'art', base.file);
  if (!existsSync(imageFile)) throw new Error(`${imageFile}이 없다 — 그림 파일을 먼저 public/art에 둔다`);
  const bytes = readFileSync(imageFile);
  const size = jpegSize(bytes);
  if (!size) throw new Error(`${imageFile}: JPEG 크기를 읽지 못했다`);
  return { ...base, ...fetched, ...size, bytes: bytes.length, sha256: sha256(bytes) };
}

const { entries, errors } = loadArtEntries(ART_ROOT);
if (errors.length) {
  console.error(`✗ entries 읽기 실패\n${errors.map((error) => `  - ${error}`).join('\n')}`);
  process.exit(1);
}
const selected = entries.filter((entry) => only.size === 0 || only.has(entry.id));
for (const id of only) if (!entries.some((entry) => entry.id === id)) console.error(`  ? ${id}: entries에 없다`);

let failed = 0;
const done = new Set();
async function run(label, file, make) {
  if (done.has(file)) return;
  done.add(file);
  if (onlyMissing && existsSync(file)) return;
  try {
    console.log(`  ${writeSnapshot(file, await make()) === 'written' ? '✎' : '='} ${label}`);
  } catch (error) {
    failed += 1;
    console.error(`  ✗ ${label} — ${error.message}`);
  }
}
for (const entry of selected) {
  for (const ref of entry.descriptions ?? []) {
    await run(`${entry.id} ${ref.source}:${ref.sourceId}`, descriptionSnapshotPath(ART_ROOT, ref.source, ref.sourceId), () => snapshotDescription(ref));
  }
  if (entry.image) await run(`${entry.id} 그림 ${entry.image.source}:${entry.image.sourceId}`, imageSnapshotPath(ART_ROOT, entry.id), () => snapshotImage(entry, imageSnapshotPath(ART_ROOT, entry.id)));
}
if (failed) {
  console.error(`✗ 스냅샷 ${failed}건 실패`);
  process.exit(1);
}
console.log(`✓ 스냅샷 ${done.size}건 확인 — 이어서 node scripts/build-art.mjs`);
