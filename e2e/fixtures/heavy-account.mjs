// 무거운 합성 계정(로그인 핵심 화면 성능 감사 전용) — 저장 단어 3,000 · 자료 200 · 60일 review_events.
// 실제 Next 서버와 브라우저가 같은 가짜 Supabase를 HTTP로 부르게 해 요청 수 · 폭주 · N+1을 양쪽에서 한 장부로 센다.
// 켜는 법: 이 파일의 startHeavyBackend()를 띄우고 Next 서버에 E2E_HEAVY_BACKEND=http://127.0.0.1:<port>를 준다
// (server-fetch-mock.mjs가 그때만 e2e.supabase.co 요청을 이리로 넘긴다). 기본 e2e는 이 파일을 읽지 않는다.
// 운영 DB · 실계정과 무관하다. PostgREST는 감사에 필요한 만큼만 흉내 낸다(필터 · 정렬 · 범위 · count · 단일 행 · upsert).
import http from 'node:http';
import https from 'node:https';
import { readFileSync, readdirSync } from 'node:fs';

export const HEAVY_UID = '00000000-0000-4000-8000-000000000301';
export const HEAVY_SERVICE_KEY = 'e2e-heavy-service-role';
const contentRoot = new URL('../../src/content/', import.meta.url);
const DAY = 86400000;

// 결정적 의사 난수(mulberry32) — 실행마다 같은 계정.
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const uuid = (prefix, n) => `00000000-0000-4000-8000-${prefix}${String(n).padStart(12 - prefix.length, '0')}`;

// 저장소의 실제 레벨 어휘에서 표기 · 읽기 · 뜻을 뽑는다(가짜 문자열보다 글꼴 조각 · 조판 비용이 실제에 가깝다).
function contentWords(dir, re) {
  const out = [], seen = new Set();
  for (const file of readdirSync(new URL(dir, contentRoot)).filter(f => f.endsWith('.js')).sort()) {
    const text = readFileSync(new URL(`${dir}${file}`, contentRoot), 'utf8');
    for (const m of text.matchAll(re)) if (!seen.has(m[1]) && m[1].length <= 8 && !/[\s。、？！?!，．.]/.test(m[1])) { seen.add(m[1]); out.push({ word: m[1], pron: m[2], ko: m[3], pos: m[4] || '' }); }
  }
  return out;
}

export function buildHeavyAccount({ now = Date.now(), words = 3000, materials = 200, days = 60, eventsPerDay = 80 } = {}) {
  const r = rng(301);
  const ja = contentWords('japanese/vocab/', /ja: "([^"]+)", yomi: "([^"]*)", ko: "([^"]*)"(?:, pos: "([^"]*)")?/g);
  const zh = contentWords('chinese/vocab/', /zh: "([^"]+)", pinyin: "([^"]*)", ko: "([^"]*)"(?:, pos: "([^"]*)")?/g);
  const jaCount = Math.round(words * 0.8), zhCount = words - jaCount;
  const iso = ms => new Date(ms).toISOString();
  const tables = {};

  // ── 자료 200(일본어 160 · 중국어 40). 문단 3–6줄, 줄마다 토큰 8–14개. ──
  tables.reading_materials = [];
  for (let i = 0; i < materials; i++) {
    const lang = i % 5 === 4 ? 'Chinese' : 'Japanese';
    const pool = lang === 'Japanese' ? ja : zh;
    const sequence = [], dictionary = {}, lines = [];
    const lineCount = 3 + Math.floor(r() * 4);
    for (let l = 0; l < lineCount; l++) {
      const tokens = 8 + Math.floor(r() * 7), parts = [];
      for (let t = 0; t < tokens; t++) {
        const w = pool[Math.floor(r() * pool.length)], key = `id_${l}_${t}`;
        sequence.push(key); parts.push(w.word);
        dictionary[key] = { text: w.word, base_form: w.word, furigana: w.pron, pos: w.pos || '명사', meaning: w.ko };
      }
      const end = `id_${l}_${tokens}`; sequence.push(end); dictionary[end] = { text: lang === 'Japanese' ? '。' : '。', base_form: '。', furigana: '', pos: '기호', meaning: '' };
      if (l < lineCount - 1) { const br = `br_${l}_${tokens + 1}`; sequence.push(br); dictionary[br] = { text: '\n', base_form: '\n', furigana: '', pos: '개행', meaning: '' }; }
      lines.push(parts.join(lang === 'Japanese' ? '' : '') + '。');
    }
    const created = now - Math.floor(r() * 150) * DAY - Math.floor(r() * DAY);
    tables.reading_materials.push({
      id: 50000 + i, owner_id: HEAVY_UID, title: `${lang === 'Japanese' ? '일본어' : '중국어'} 읽기 자료 ${String(i + 1).padStart(3, '0')}`,
      raw_text: lines.join('\n'), visibility: 'private', status: 'completed', direction: 'read', source_pdf_id: null, page_start: null, page_end: null,
      created_at: iso(created), updated_at: iso(created), document_json: null, lesson_explanation_ko: null, conversation_script: null,
      processed_json: { status: 'completed', metadata: { language: lang, level: lang === 'Japanese' ? 'N4' : 'H2' }, sequence, dictionary, failed_indices: [] },
    });
  }
  tables.reading_progress = tables.reading_materials.slice(0, 60).map((m, i) => ({
    user_id: HEAVY_UID, material_id: m.id, last_token_idx: 5 + i, is_completed: i % 3 === 0, updated_at: iso(now - i * 3600000),
  }));

  // ── 저장 단어 3,000 — 옛 일정 칸(interval=안정도 · ease_factor=난이도 · repetitions=망각 수, src/lib/fsrs.js). 약 1/5이 오늘 만기. ──
  tables.user_vocabulary = [];
  const pick = (pool, n) => Array.from({ length: n }, (_, i) => pool[i % pool.length]);
  const rows = [...pick(ja, jaCount).map(w => ({ ...w, language: 'Japanese' })), ...pick(zh, zhCount).map(w => ({ ...w, language: 'Chinese' }))];
  const seenText = new Set();
  rows.forEach((w, i) => {
    let text = w.word; while (seenText.has(`${w.language}:${text}`)) text = `${text}${i}`;
    seenText.add(`${w.language}:${text}`);
    const created = now - Math.floor(r() * 120 * DAY);
    const reviewed = r() < 0.88;
    const stability = reviewed ? Math.round((0.5 + r() * 60) * 100) / 100 : 0;
    const roll = r();
    const due = !reviewed ? created : roll < 0.2 ? now - Math.floor(r() * 10 * DAY) : now + Math.floor((0.2 + r() * stability) * DAY);
    const material = r() < 0.35 ? tables.reading_materials[Math.floor(r() * materials)].id : null;
    tables.user_vocabulary.push({
      id: uuid('1', i + 1), user_id: HEAVY_UID, word_text: text, base_form: text, meaning: w.ko, furigana: w.pron, pos: w.pos,
      language: w.language, created_at: iso(created), interval: stability, ease_factor: reviewed ? Math.round((2 + r() * 7) * 100) / 100 : 0,
      repetitions: reviewed ? Math.floor(r() * 4) : 0, last_reviewed_at: reviewed ? iso(Math.min(now - 3600000, due - stability * DAY)) : null,
      next_review_at: iso(due), source_material_id: material, source_ref: material ? null : (r() < 0.3 ? `level:${w.language === 'Japanese' ? 'N4' : 'H2'}` : null),
      example_sentence: null, notes: null, is_excluded: false,
    });
  });
  tables.vocabulary_contexts = tables.user_vocabulary.filter(v => v.source_material_id).map((v, i) => ({
    id: uuid('2', i + 1), user_id: HEAVY_UID, vocabulary_id: v.id, kind: 'material', lang: v.language, material_id: v.source_material_id,
    chapter_slug: null, locator: { materialId: String(v.source_material_id), line: i % 5 }, quote: `${v.word_text}を含む文です。`, translation: null,
    created_at: v.created_at,
  }));
  tables.user_vocab_encounters = tables.user_vocabulary.slice(0, 1200).map((v, i) => ({
    user_id: HEAVY_UID, word_text: v.word_text, lang: v.language === 'Japanese' ? 'ja' : 'zh', context: i % 2 ? `${v.word_text}を読んだ。` : null,
    first_met_at: v.created_at, last_met_at: v.created_at, count: 1 + (i % 6), material_id: v.source_material_id,
  }));

  // ── review_events 60일 × 하루 약 80(채점 · 세션 · 레벨 연습 섞임). ──
  tables.review_events = [];
  const sources = ['vocab', 'vocab', 'vocab', 'study', 'study', 'grammar', 'level', 'ui'];
  let ev = 0;
  for (let d = days - 1; d >= 0; d--) {
    const n = Math.floor(eventsPerDay * (0.4 + r() * 1.2));
    for (let k = 0; k < n; k++) {
      const w = tables.user_vocabulary[Math.floor(r() * tables.user_vocabulary.length)];
      const source = sources[Math.floor(r() * sources.length)];
      tables.review_events.push({
        id: ++ev, user_id: HEAVY_UID, lang: w.language, source, item_key: source === 'grammar' ? `n4-${String(1 + (k % 30)).padStart(2, '0')}` : w.word_text,
        correct: r() < 0.78, detail: source === 'study' ? { kind: 'vocab', rung: 1 + (k % 3) } : null,
        created_at: iso(now - d * DAY - Math.floor(r() * DAY * 0.6)),
      });
    }
  }
  tables.grammar_review = Array.from({ length: 40 }, (_, i) => ({
    id: i + 1, user_id: HEAVY_UID, lang: 'Japanese', slug: `n5-${String(1 + i).padStart(2, '0')}`, interval: 3 + i, ease_factor: 5, repetitions: 1,
    next_review_at: iso(now + (i < 8 ? -DAY : (i - 7) * DAY)), last_reviewed_at: iso(now - 5 * DAY), created_at: iso(now - 90 * DAY),
  }));
  tables.user_ref_progress = Array.from({ length: 30 }, (_, i) => ({ user_id: HEAVY_UID, lang: 'Japanese', slug: `n5-${String(1 + i).padStart(2, '0')}`, passed: true, updated_at: iso(now - i * DAY) }));
  tables.study_paragraphs = [];
  tables.profiles = [{ id: HEAVY_UID, role: 'learner', display_name: 'E2E 학습자', onboarded: true, streak_count: 41, learning_language: ['Japanese'],
    last_login_at: iso(now - DAY), daily_goal: 20, created_at: iso(now - 200 * DAY) }];
  for (const t of ['library_collections', 'library_collection_items', 'library_bookmarks', 'library_item_state', 'library_reading_activity',
    'vocabulary_exclusions', 'known_words', 'user_known_words', 'content_overrides', 'uploaded_pdfs', 'grammar_notes', 'study_notes',
    'material_annotations', 'reading_sessions', 'user_ref_drills', 'drill_srs', 'conversations', 'study_groups', 'group_members',
    'learning_admission_receipts', 'writing_entries', 'notifications']) tables[t] ??= [];
  return { tables, now };
}

// ───────────────────────── 최소 PostgREST ─────────────────────────
function splitTop(text, sep = ',') {
  const out = []; let depth = 0, cur = '', quote = false;
  for (const ch of text) {
    if (ch === '"') quote = !quote;
    if (!quote && ch === '(') depth++;
    if (!quote && ch === ')') depth--;
    if (!quote && depth === 0 && ch === sep) { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}
function pathValue(row, expr) {
  // a->b->>c, 또는 embedded.a(필터 전용 — 무시하고 통과)
  const parts = expr.split(/->>?/);
  let v = row?.[parts[0]];
  for (const p of parts.slice(1)) v = v == null ? undefined : v[p];
  return v;
}
const scalar = v => (v === null || v === undefined ? null : typeof v === 'object' ? JSON.stringify(v) : String(v));
function parseList(text) {
  return splitTop(text.replace(/^\(|\)$/g, '')).map(s => s.replace(/^"|"$/g, ''));
}
function test(op, actual, raw) {
  const a = scalar(actual);
  const num = x => (x !== null && x !== '' && !Number.isNaN(Number(x)) ? Number(x) : x);
  const cmp = (x, y) => { const nx = num(x), ny = num(y); if (typeof nx === 'number' && typeof ny === 'number') return nx - ny; return String(x) < String(y) ? -1 : String(x) > String(y) ? 1 : 0; };
  switch (op) {
    case 'eq': return a !== null && (a === raw || num(a) === num(raw));
    case 'neq': return a !== null && a !== raw;
    case 'gt': return a !== null && cmp(a, raw) > 0;
    case 'gte': return a !== null && cmp(a, raw) >= 0;
    case 'lt': return a !== null && cmp(a, raw) < 0;
    case 'lte': return a !== null && cmp(a, raw) <= 0;
    case 'like': case 'ilike': {
      if (a === null) return false;
      const re = new RegExp(`^${raw.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[%*]/g, '.*')}$`, op === 'ilike' ? 'i' : '');
      return re.test(a);
    }
    case 'in': return a !== null && parseList(raw).includes(a);
    case 'is': return raw === 'null' ? a === null : raw === 'true' ? actual === true : raw === 'false' ? actual === false : false;
    case 'cs': try { const want = JSON.parse(raw); return Array.isArray(actual) ? want.every(x => actual.includes(x)) : false; } catch { return true; }
    case 'ov': return Array.isArray(actual) && parseList(raw.replace(/^\{|\}$/g, '')).some(x => actual.map(String).includes(x));
    default: return true;
  }
}
function condition(column, expr) {
  let neg = false, rest = expr;
  if (rest.startsWith('not.')) { neg = true; rest = rest.slice(4); }
  const dot = rest.indexOf('.');
  const op = rest.slice(0, dot), raw = rest.slice(dot + 1);
  return row => { if (column.includes('.') && !column.includes('->')) return true; const ok = test(op, pathValue(row, column), raw); return neg ? !ok : ok; };
}
function logic(kind, body) {
  const parts = splitTop(body.replace(/^\(|\)$/g, '')).map(part => {
    const m = /^(not\.)?(and|or)(\(.*\))$/.exec(part);
    if (m) { const inner = logic(m[2], m[3]); return m[1] ? row => !inner(row) : inner; }
    const firstDot = part.indexOf('.');
    return condition(part.slice(0, firstDot), part.slice(firstDot + 1));
  });
  return kind === 'or' ? row => parts.some(p => p(row)) : row => parts.every(p => p(row));
}
const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);
function filters(params) {
  const preds = [];
  for (const [key, value] of params) {
    if (RESERVED.has(key)) continue;
    if (key === 'or' || key === 'and') preds.push(logic(key, value));
    else if (key === 'not.or' || key === 'not.and') { const inner = logic(key.slice(4), value); preds.push(row => !inner(row)); } else preds.push(condition(key, value));
  }
  return row => preds.every(p => p(row));
}
function project(rows, select) {
  if (!select || select === '*') return rows;
  const items = splitTop(select).map(s => s.trim()).filter(Boolean);
  return rows.map(row => {
    const out = {};
    for (const item of items) {
      if (item === '*') { Object.assign(out, row); continue; }
      const embed = /^(?:([\w]+):)?([!\w]+)\((.*)\)$/.exec(item);
      if (embed) { out[embed[1] || embed[2].split('!')[0]] = embed[1] === undefined && embed[2] === 'materials' ? {} : null; continue; }
      const m = /^(?:([\w]+):)?([\w]+(?:->>?[\w]+)*)(?:::\w+)?$/.exec(item);
      if (!m) continue;
      const key = m[1] || m[2].split(/->>?/).pop();
      let v = pathValue(row, m[2]);
      if (/->>[\w]+$/.test(m[2]) && v != null) v = typeof v === 'object' ? JSON.stringify(v) : String(v);
      out[key] = v === undefined ? null : v;
    }
    return out;
  });
}
function sortRows(rows, order) {
  if (!order) return rows;
  const keys = splitTop(order).map(spec => { const [col, ...mods] = spec.split('.'); return { col, desc: mods.includes('desc'), nullsFirst: mods.includes('nullsfirst') }; });
  return rows.slice().sort((x, y) => {
    for (const k of keys) {
      const a = pathValue(x, k.col), b = pathValue(y, k.col);
      if (a == null || b == null) { if (a == null && b == null) continue; return (a == null) === k.nullsFirst ? -1 : 1; }
      const c = typeof a === 'number' && typeof b === 'number' ? a - b : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
      if (c) return k.desc ? -c : c;
    }
    return 0;
  });
}

const OWNER_COLUMNS = ['user_id', 'owner_id'];
function visible(table, row, claims, service) {
  if (service) return true;
  if (table === 'profiles') return row.id === claims?.sub;
  if (table === 'reading_materials') return row.owner_id === claims?.sub || row.visibility === 'public';
  const col = OWNER_COLUMNS.find(c => Object.hasOwn(row, c));
  return col ? row[col] === claims?.sub : true;
}

export function createHeavyBackend({ latencyMs = 0, browserLatencyMs = 0, snapshotMsPerRow = 0.15, log = [] } = {}) {
  let account = buildHeavyAccount();
  // admitted = fsrs_private.legacy_admissions(카드마다 한 번, 지우지 않음) · consumed = 그중 오늘 새 표현 한도를 쓴 카드(처음 보는 카드의 첫 입장만).
  // 운영 learning_admit_legacy와 같게: 이미 입장한 카드 · 복습한 적 있는 카드의 입장은 한도를 쓰지 않는다(consumed=false · used 무변화).
  const state = { account, log, admitted: new Set(), consumed: new Set(), seq: 1e6 };
  // admitted='reviewed' — 입장 기록이 쌓인 계정(오프라인 복습 e2e · F5 측정): 복습한 적 있는 카드 대부분이 이미 입장했고,
  // 7장에 1장은 입장 기록 시작(2026-10-05) 뒤로 한 번도 묻지 않은 카드로 남긴다(끊긴 동안 「연결되면 볼 수 있어요」 카드가 나올 자리).
  const seedAdmitted = mode => new Set(mode === 'reviewed'
    ? account.tables.user_vocabulary.filter((row, i) => row.last_reviewed_at && i % 7 !== 3).map(row => row.id) : []);
  const reset = ({ admitted = 'none' } = {}) => { account = buildHeavyAccount(); state.account = account; state.admitted = seedAdmitted(admitted); state.consumed = new Set(); };

  function fsrsSnapshot() {
    // 운영 RPC는 to_jsonb(user_vocabulary 행) 전체를 싣는다(20261016191600 · 250행) — 칸을 줄이지 않는다.
    const rows = account.tables.user_vocabulary.map(({ is_excluded: _x, ...row }) => row);
    return { version: 1, actorId: HEAVY_UID, enabled: true, complete: true, registryAvailable: true, rows,
      registry: rows.map(row => ({ cardId: row.id, userId: HEAVY_UID, enrolled: false, eligible: true, known: false, excluded: false,
        card: null, attempt: null, nextQuestionAt: null, firstQuestionAt: null })), now: new Date().toISOString() };
  }
  function quota() {
    const now = new Date().toISOString(), used = state.consumed.size;
    const day = new Date(Date.now() + 9 * 3600000 - 4 * 3600000).toISOString().slice(0, 10);
    return { version: 1, actorId: HEAVY_UID, installed: true, enabled: true, active: true, fsrsEnabled: true, startsAt: '2026-01-01T19:00:00.000Z',
      now, learningDay: day, timeZone: 'Asia/Seoul', rolloverHour: 4, limit: 15, policyRevision: 1, used, remaining: Math.max(0, 15 - used),
      fsrsUsed: 0, legacyUsed: used, admittedLegacyCardIds: [...state.admitted] };
  }
  function libraryPage(body) {
    const filters = body?.p_filters || {}, offset = body?.p_offset || 0, limit = body?.p_limit || 24;
    let mats = account.tables.reading_materials.slice();
    if (filters.recent) {
      const opened = account.tables.reading_progress.filter(p => !p.is_completed).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      mats = opened.map(p => mats.find(m => m.id === p.material_id)).filter(Boolean);
    } else mats.sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (filters.language) mats = mats.filter(m => m.processed_json.metadata.language === filters.language);
    if (filters.q) mats = mats.filter(m => m.title.includes(filters.q));
    const items = mats.slice(offset, offset + limit).map(m => ({
      target_kind: 'material', target_id: String(m.id), title: m.title, original_title: m.title, display_title: null, language: m.processed_json.metadata.language,
      level: m.processed_json.metadata.level, created_at: m.created_at, excerpt: m.raw_text.slice(0, 180), assets: [], link_count: 0, material_id: String(m.id),
      child_count: 0, is_note: false, owned: true, completed: account.tables.reading_progress.some(p => p.material_id === m.id && p.is_completed),
      opened_at: account.tables.reading_progress.find(p => p.material_id === m.id)?.updated_at || null, context: { materialId: String(m.id), mode: 'text' },
      failed: false, editable: true, favorite: false, state: 'active', revision: 1, folders: [], match_child: null,
    }));
    return { total: mats.length, unavailable: 0, items };
  }

  // DB 실행 시간 모형(합성 값 — 밝혀 둔 가정). snapshot은 마이그레이션 20261016191600의 운영 기대치
  // 「1,232단어 0.15~0.3초」에서 단어당 약 0.15ms로 잡는다(3,000단어 ≈ 450ms). 그 밖의 쿼리는 왕복 지연(latencyMs)만 준다.
  const rpcCost = { fsrs_vocabulary_snapshot: () => Math.round(account.tables.user_vocabulary.length * snapshotMsPerRow) };
  const rpcs = {
    fsrs_vocabulary_snapshot: () => fsrsSnapshot(),
    fsrs_capabilities: () => ({ version: 1, enabled: true, policyVersion: 'anki-v2' }),
    fsrs_list_states: () => [],
    fsrs_legacy_boundary: () => ({ version: 1, actorId: HEAVY_UID, enrolled: false }),
    learning_admission_status: () => quota(),
    learning_admit_legacy: body => {
      const request = body.p_request, first = !state.admitted.has(request.cardId);
      const row = account.tables.user_vocabulary.find(v => v.id === request.cardId);
      // 운영 RPC처럼 질문마다(새 operationId) 다시 검사한다 — 제외 · 다른 기기가 먼저 복습해 아직 때가 아님(독립 리뷰 2026-10-25 KST).
      if (!row) return { __rpcError: { code: '42501', message: 'learning_word_not_available' } };
      if (row.is_excluded) return { __rpcError: { code: '55000', message: 'vocabulary_excluded' } };
      if (row.last_reviewed_at && Date.parse(row.next_review_at) > Date.now()) return { __rpcError: { code: '55000', message: 'learning_card_not_due' } };
      state.admitted.add(request.cardId);
      if (first && !row?.last_reviewed_at) state.consumed.add(request.cardId);
      const q = quota(), consumed = state.consumed.has(request.cardId);
      return { version: 1, actorId: HEAVY_UID, operationId: request.operationId, cardId: request.cardId, admitted: true, consumed, duplicate: false,
        firstQuestionAt: consumed ? q.now : null, admittedAt: q.now, startsAt: q.startsAt, learningDay: q.learningDay, quota: q };
    },
    learning_language_capabilities: () => ({ version: 1, languages: {} }),
    is_admin: () => false,
    update_streak: () => ({ streak_count: 41 }),
    personal_library_page_v2: body => libraryPage(body),
    personal_library_children: () => [],
    public_book_catalog: () => [],
    touch_morphemes: () => null,
  };

  function rest(method, url, headers, body, claims, service) {
    const table = url.pathname.split('/').pop();
    if (url.pathname.includes('/rpc/')) {
      const fn = rpcs[table];
      if (!fn) return { status: 200, body: null, note: 'rpc-unmocked' };
      const out = fn(body || Object.fromEntries(url.searchParams));
      if (out?.__rpcError) return { status: 400, body: { ...out.__rpcError, details: null, hint: null } };
      return { status: 200, body: out, dbMs: rpcCost[table]?.() || 0 };
    }
    const rowsAll = account.tables[table];
    if (!rowsAll) { account.tables[table] = []; }
    const all = account.tables[table];
    const pred = filters(url.searchParams);
    const prefer = headers.get('prefer') || '';
    if (method === 'GET' || method === 'HEAD') {
      let rows = all.filter(row => visible(table, row, claims, service) && pred(row));
      const total = rows.length;
      rows = sortRows(rows, url.searchParams.get('order'));
      let offset = Number(url.searchParams.get('offset') || 0), limit = url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : Infinity;
      const range = /^(\d+)-(\d+)$/.exec(headers.get('range') || '');
      if (range) { offset = Number(range[1]); limit = Number(range[2]) - offset + 1; }
      rows = rows.slice(offset, offset + limit);
      const out = project(rows, url.searchParams.get('select'));
      const extra = { 'content-range': out.length ? `${offset}-${offset + out.length - 1}/${/count=/.test(prefer) ? total : '*'}` : `*/${/count=/.test(prefer) ? total : '*'}` };
      if ((headers.get('accept') || '').includes('vnd.pgrst.object')) {
        if (out.length !== 1) return { status: 406, body: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${out.length} rows` }, headers: extra };
        return { status: 200, body: out[0], headers: extra };
      }
      return { status: 200, body: method === 'HEAD' ? null : out, headers: extra };
    }
    if (method === 'PATCH') {
      const hit = all.filter(row => visible(table, row, claims, service) && pred(row));
      for (const row of hit) Object.assign(row, body);
      // count=exact면 PostgREST처럼 바뀐 행 수를 Content-Range로 알린다(예전 일정 비교 후 쓰기의 0행 판정).
      const counted = /count=exact/.test(prefer) ? { 'content-range': hit.length ? `0-${hit.length - 1}/${hit.length}` : '*/0' } : {};
      return { status: /return=representation/.test(prefer) ? 200 : 204, body: /return=representation/.test(prefer) ? project(hit, url.searchParams.get('select')) : null, headers: counted };
    }
    if (method === 'DELETE') {
      const keep = all.filter(row => !(visible(table, row, claims, service) && pred(row)));
      account.tables[table] = keep;
      return { status: 204, body: null };
    }
    if (method === 'POST') {
      const list = Array.isArray(body) ? body : [body];
      const conflict = (url.searchParams.get('on_conflict') || '').split(',').filter(Boolean);
      const inserted = [];
      for (const raw of list) {
        const row = { ...raw };
        if (!row.id && table !== 'reading_progress') row.id = table === 'review_events' ? ++state.seq : uuid('9', ++state.seq);
        row.created_at ??= new Date().toISOString();
        const existing = conflict.length ? all.find(x => conflict.every(c => String(x[c]) === String(row[c]))) : null;
        if (existing) { if (!/ignore-duplicates/.test(prefer)) Object.assign(existing, row); inserted.push(existing); } else { all.push(row); inserted.push(row); }
      }
      return { status: 201, body: /return=representation/.test(prefer) ? project(inserted, url.searchParams.get('select')) : null };
    }
    return { status: 405, body: { message: 'unsupported' } };
  }

  function userObject() {
    const now = new Date().toISOString();
    return { id: HEAVY_UID, aud: 'authenticated', role: 'authenticated', email: 'e2e-learner@example.com', email_confirmed_at: now, confirmed_at: now,
      app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: { display_name: 'E2E 학습자' }, identities: [], created_at: now, updated_at: now };
  }

  async function handle({ method, url, headers, body, origin }) {
    const started = performance.now();
    const auth = headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
    const apikey = headers.get('apikey') || '';
    const service = auth === HEAVY_SERVICE_KEY || apikey === HEAVY_SERVICE_KEY;
    let claims = null;
    try { claims = JSON.parse(Buffer.from(auth.split('.')[1], 'base64url').toString('utf8')); } catch { /* anonymous */ }
    let result;
    if (url.pathname.startsWith('/auth/v1/')) {
      if (url.pathname.endsWith('/.well-known/jwks.json')) result = { status: 200, body: { keys: [] } };
      else if (url.pathname.endsWith('/user')) result = claims?.sub ? { status: 200, body: userObject() } : { status: 401, body: { message: 'invalid e2e token' } };
      else if (url.pathname.endsWith('/logout')) result = { status: 204, body: null };
      else result = { status: 200, body: {} };
    } else if (url.pathname.startsWith('/rest/v1/')) {
      result = rest(method, url, headers, body, claims, service);
    } else if (url.pathname.startsWith('/storage/v1/')) result = { status: 404, body: { message: 'not found' } };
    else result = { status: 404, body: { message: 'unknown' } };
    const delay = (origin === 'server' ? latencyMs : browserLatencyMs) + (result.dbMs || 0);
    if (delay) await new Promise(r => setTimeout(r, delay));
    const payload = result.body === null || result.body === undefined ? '' : JSON.stringify(result.body);
    log.push({ t: Date.now(), origin, method, path: url.pathname.replace('/rest/v1/', ''), query: url.search.slice(0, 300), status: result.status,
      bytes: Buffer.byteLength(payload), ms: Math.round(performance.now() - started), note: result.note || null, service });
    return { status: result.status, headers: { 'content-type': 'application/json', ...(result.headers || {}) }, payload };
  }

  return { handle, state, reset, log };
}

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS,HEAD',
  'access-control-expose-headers': 'content-range' };

/** HTTP(서버 쪽) + 선택 HTTPS(브라우저 쪽 — host-resolver-rules로 e2e.supabase.co를 여기로) 두 귀. */
export async function startHeavyBackend({ httpPort, httpsPort, cert, key, latencyMs = 0, browserLatencyMs = 0 } = {}) {
  const backend = createHeavyBackend({ latencyMs, browserLatencyMs });
  const listener = origin => async (req, res) => {
    const url = new URL(req.url, 'http://e2e.supabase.co');
    if (url.pathname === '/__heavy/log') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(backend.log)); return; }
    if (url.pathname === '/__heavy/reset') { backend.reset({ admitted: url.searchParams.get('admitted') || 'none' }); backend.log.length = 0; res.writeHead(200); res.end('{}'); return; }
    if (url.pathname === '/__heavy/clear-log') { backend.log.length = 0; res.writeHead(200); res.end('{}'); return; }
    // 실제 Supabase처럼 요청 머리를 되돌려 준다 — Authorization은 와일드카드(*)로 허용되지 않는다.
    const cors = { ...CORS, 'access-control-allow-headers': req.headers['access-control-request-headers'] || CORS['access-control-allow-headers'] };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
    let raw = ''; for await (const chunk of req) raw += chunk;
    let body = null; try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }
    const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
    const out = await backend.handle({ method: req.method, url, headers, body, origin: req.headers['x-heavy-origin'] || origin });
    res.writeHead(out.status, { ...cors, ...out.headers });
    res.end(req.method === 'HEAD' ? undefined : out.payload);
  };
  const servers = [];
  const listen = (server, port) => new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  if (httpPort) { const s = http.createServer(listener('server')); await listen(s, httpPort); servers.push(s); }
  if (httpsPort) { const s = https.createServer({ cert, key }, listener('browser')); await listen(s, httpsPort); servers.push(s); }
  return { backend, close: () => Promise.all(servers.map(s => new Promise(r => s.close(r)))) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [httpPort, httpsPort, certPath, keyPath] = process.argv.slice(2);
  const { backend } = await startHeavyBackend({ httpPort: Number(httpPort), httpsPort: Number(httpsPort) || 0,
    cert: certPath && readFileSync(certPath), key: keyPath && readFileSync(keyPath),
    latencyMs: Number(process.env.HEAVY_LATENCY_MS || 0) });
  const t = backend.state.account.tables;
  process.stdout.write(`heavy backend ready http:${httpPort} https:${httpsPort || '-'} words=${t.user_vocabulary.length} materials=${t.reading_materials.length} events=${t.review_events.length}\n`);
}
