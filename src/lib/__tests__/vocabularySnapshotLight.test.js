import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { compactVocabularySnapshot, defaultRegistryEntry, expandLightSnapshot, LIGHT_SUMMARY_COLUMNS } from '../vocabularySnapshotLight';
import { readVocabularyLearningSnapshotLight, validateVocabularyLearningSnapshot } from '../server/fsrsVocabulary';
import { VOCABULARY_LEARNING_SUMMARY_FIELDS } from '../vocabularyLearningRead';
import { projectVocabularyLearningRows } from '../vocabularyLearningRows';
import { selectLegacyReviewRows } from '../vocabularyDueIndex';
import { introduceFsrsCard } from '../fsrsScheduler';
import { sliceBetween } from './helpers/sliceBetween';

// SNAPSHOT-LIGHT-001(오너 승인 2026-10-25 KST 「권장대로」 — ㉠ 복습방 첫 숫자 병합 전 · 로그인 감사 F2 · F8).
// 서버 첫 화면 · /study 조립은 전체 학습 snapshot 대신 fsrs_vocabulary_snapshot_light(같은 판정의 부분 집합)를 읽는다. 계약:
// ⑴ 판정은 하나 — light 본문의 계정 검사 · WITH 판정 · registry 칸이 최신 snapshot 정의와 **바이트 그대로** 같다(snapshot이 바뀌면 여기서 깨진다)
// ⑵ 왕복 — expand(compact(snapshot)) = snapshot의 그 언어 부분(요약이면 요약 칸) · 모양이 어긋나면 snapshot을 못 읽은 것과 같은 오류
// ⑶ 서버 읽기 — 정확한 인자 · 같은 검사 · 함수 없음(PGRST202)일 때만 전체 snapshot으로 물러섬(다른 오류는 그대로)
// ⑷ /study 조립이 읽는 값(그 언어 예전 일정 줄 · 그 언어 행 · 시각)이 전체 snapshot과 같다. 첫 화면 숫자 동치는 reviewRoomFirstScreen.test.js ⑴.
// SQL 함수 = compactVocabularySnapshot(SQL snapshot)은 supabase/tests/vocabulary-snapshot-light.mjs(PGlite)가 증명한다.
const ROOT = path.resolve(__dirname, '../../..');
const MIGRATIONS = path.join(ROOT, 'supabase/migrations');
const md5 = text => createHash('md5').update(text).digest('hex');

/** 마이그레이션 중 그 함수를 마지막으로 정의한 파일과 본문($fn$ 안). */
function latestDefinition(signature) {
  const pattern = new RegExp(`CREATE OR REPLACE FUNCTION ${signature.replace(/[.()]/g, '\\$&')}[\\s\\S]*? AS \\$fn\\$([\\s\\S]*?)\\$fn\\$;`);
  let found = null;
  for (const file of fs.readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort()) {
    const match = fs.readFileSync(path.join(MIGRATIONS, file), 'utf8').match(pattern);
    if (match) found = { file, body: match[1] };
  }
  if (!found) throw new Error(`${signature} 정의가 없다`);
  return found;
}
const between = (text, start, end) => {
  const i = text.indexOf(start);
  const j = text.indexOf(end, i + start.length);
  if (i < 0 || j < 0) throw new Error(`조각을 찾지 못했다: ${start.slice(0, 40)}`);
  return text.slice(i, j + end.length);
};

describe('⑴ 판정은 하나 — light 본문의 판정 조각 = 최신 snapshot 정의', () => {
  const snap = latestDefinition('public.fsrs_vocabulary_snapshot(p_actor uuid)');
  const light = latestDefinition('public.fsrs_vocabulary_snapshot_light(p_actor uuid, p_language text, p_summary boolean)');
  const lightFile = fs.readFileSync(path.join(MIGRATIONS, light.file), 'utf8');

  it('light 마이그레이션이 검사하는 snapshot 본문 md5 = 저장소의 최신 snapshot 정의(그 뒤에 snapshot을 바꾸면 light도 함께 바꿔야 한다)', () => {
    expect(light.file > snap.file).toBe(true);
    expect(lightFile).toContain(`IS DISTINCT FROM '${md5(snap.body)}'`);
  });
  it('계정 검사(무결성 · 행위자 42501 · 55000 둘) · 설정 읽기가 같다', () => {
    const guard = body => between(body, ' PERFORM fsrs_private.require_admission_integrity();', ' SELECT * INTO STRICT s FROM fsrs_private.settings;');
    expect(guard(light.body)).toBe(guard(snap.body));
    const foreign = body => between(body, ' IF EXISTS(SELECT 1 FROM public.fsrs_cards f JOIN public.user_vocabulary v', "USING ERRCODE='55000'; END IF;");
    expect(foreign(light.body)).toBe(foreign(snap.body));
  });
  it('WITH 판정(아는 단어 · 제외 · 다음 질문)이 같고, 다른 것은 x의 언어 조건 하나다', () => {
    const judged = body => between(body, ' WITH kw AS (', '  WHERE v.user_id=p_actor');
    expect(judged(light.body)).toBe(judged(snap.body));
    expect(light.body).toContain("  WHERE v.user_id=p_actor AND (p_language IS NULL OR v.language=p_language))\n");
    expect(snap.body).toContain('  WHERE v.user_id=p_actor)\n');
  });
  it('머리 칸 · registry 칸이 같고, registry는 기본값이 아닌 칸만 싣는다', () => {
    const head = body => between(body, " SELECT jsonb_build_object('version',1,", "'now',fsrs_private.iso_milliseconds(statement_timestamp()),");
    expect(head(light.body)).toBe(head(snap.body));
    const registry = body => between(body, "'registry',coalesce(jsonb_agg(jsonb_build_object(", '   ORDER BY x.id)');
    expect(registry(light.body)).toBe(registry(snap.body));
    expect(light.body).toContain('   ORDER BY x.id) FILTER (WHERE x.fid IS NOT NULL OR x.is_known OR x.is_excluded_only),\'[]\'::jsonb))');
    // 기본값 칸(JS가 채우는 것) = 그 jsonb_build_object에서 fid NULL · known false · excluded-only false일 때의 값.
    expect(defaultRegistryEntry('x', 'u')).toEqual({ cardId: 'x', userId: 'u', enrolled: false, card: null, known: false, excluded: false,
      eligible: true, nextQuestionAt: null, firstQuestionAt: null });
    expect([...registry(snap.body).matchAll(/[(,\s]'(\w+)',(?=x\.|p_actor|NOT |CASE )/g)].map(m => m[1]).filter(key => key !== 'milliseconds')).toEqual(Object.keys(defaultRegistryEntry('x', 'u')));
  });
  it('요약 칸 = 요약 조회(fields=summary) 칸 − user_id, SQL의 칸 이름 · 배열 순서가 같다', () => {
    expect(LIGHT_SUMMARY_COLUMNS).toEqual(VOCABULARY_LEARNING_SUMMARY_FIELDS.filter(key => key !== 'user_id'));
    expect(JSON.parse(light.body.match(/'(\["id",[^']*\])'::jsonb/)[1])).toEqual(LIGHT_SUMMARY_COLUMNS);
    const array = between(light.body, 'jsonb_build_array((x.vrow).id', 'ELSE to_jsonb(x.vrow) END');
    expect([...array.matchAll(/\(x\.vrow\)\.(\w+)/g)].map(m => m[1])).toEqual(LIGHT_SUMMARY_COLUMNS);
  });
  it('권한은 snapshot과 같은 모양 — service_role만 EXECUTE, 앱 사용자 키로는 부를 수 없다', () => {
    expect(lightFile).toMatch(/REVOKE ALL ON FUNCTION public\.fsrs_vocabulary_snapshot_light\(uuid,text,boolean\) FROM PUBLIC, anon, authenticated, service_role;\nGRANT EXECUTE ON FUNCTION public\.fsrs_vocabulary_snapshot_light\(uuid,text,boolean\) TO service_role;/);
    expect(light.body.startsWith('\nDECLARE s fsrs_private.settings%rowtype; result jsonb;\nBEGIN\n')).toBe(true);
    expect(lightFile).toMatch(/fsrs_vocabulary_snapshot_light\(p_actor uuid, p_language text, p_summary boolean\)\n RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''/);
  });
});

const ACTOR = '10000000-0000-4000-8000-0000000000aa';
const NOW = Date.parse('2026-10-25T03:00:00.000Z');
const iso = ms => new Date(ms).toISOString();
const id = n => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
/** snapshot RPC 원문 모양 — 두 엔진 · 아는 단어 · 제외 · 언어 없음 · 목록 밖 언어 · 요약 밖 칸이 섞여 있다. */
function snapshot() {
  const rows = [], registry = [];
  const add = (language, extra = {}, reg = {}) => {
    const n = rows.length + 1;
    const row = { id: id(n), user_id: ACTOR, word_text: `w${n}`, base_form: `w${n}`, meaning: `뜻 ${n}`, language, created_at: iso(NOW - n * 86400000),
      interval: 3.5, ease_factor: 2.5, repetitions: 1, last_reviewed_at: iso(NOW - 4 * 86400000), next_review_at: iso(NOW - (n % 3) * 86400000 + 3600000),
      source_material_id: n % 5 === 0 ? 50000 + n : null, source_ref: n % 4 === 0 ? 'level:N4' : null,
      furigana: `ふ${n}`, pos: '명사', status: 'Review', last_review: null, material_id: null, source_sentence: `w${n}の文。`, etym: null, hanja: null, ...extra };
    rows.push(row);
    registry.push({ ...defaultRegistryEntry(row.id, ACTOR), ...reg });
  };
  for (let i = 0; i < 6; i++) add('Japanese');
  add('Japanese', {}, { known: true, excluded: true, eligible: false });
  add('Chinese', {}, { excluded: true, eligible: false });
  add('Chinese');
  add(null);
  const card = introduceFsrsCard(NOW - 3600000, { policyVersion: 'anki-v2' });
  add('Japanese', { interval: null, ease_factor: null, repetitions: 0, last_reviewed_at: null, next_review_at: null },
    { enrolled: true, card, nextQuestionAt: card.due, firstQuestionAt: null });
  return { version: 1, learningAdmissionVersion: 1, actorId: ACTOR, enabled: true, registryAvailable: true, complete: true, now: iso(NOW), rows, registry };
}
const LANGS = [null, 'Japanese', 'Chinese', 'French'];
const subset = (full, language, summary) => {
  const rows = full.rows.filter(r => language === null || r.language === language);
  const byId = new Map(full.registry.map(e => [e.cardId, e]));
  return { ...full, rows: rows.map(r => (summary ? Object.fromEntries(['user_id', ...LIGHT_SUMMARY_COLUMNS].map(k => [k, r[k]])) : r)), registry: rows.map(r => byId.get(r.id)) };
};
const unavailable = { code: 'fsrs_snapshot_unavailable' };

describe('⑵ 왕복 · 실패는 닫힌다', () => {
  it.each(LANGS.flatMap(language => [false, true].map(summary => [language, summary])))('language=%s summary=%s: expand(compact(snapshot)) = 그 부분', (language, summary) => {
    const full = snapshot();
    const light = compactVocabularySnapshot(full, { language, summary });
    expect(light.registry.every(entry => entry.enrolled || entry.known || entry.excluded)).toBe(true); // 기본값 칸은 싣지 않는다
    if (summary) expect(light.rows.every(values => Array.isArray(values) && values.length === LIGHT_SUMMARY_COLUMNS.length)).toBe(true);
    const back = expandLightSnapshot(JSON.parse(JSON.stringify(light)), ACTOR, { language, summary });
    expect(back).toEqual(subset(full, language, summary));
    // 검증 · 투영도 그대로 지난다(같은 함수).
    expect(projectVocabularyLearningRows(validateVocabularyLearningSnapshot(back, ACTOR), { actorId: ACTOR }).projections).toHaveLength(back.rows.length);
  });
  it('full 모양 행 객체는 복사하지 않는다(snapshot 읽기와 같은 객체 동일성)', () => {
    const full = snapshot();
    const back = expandLightSnapshot(compactVocabularySnapshot(full, { language: 'Japanese', summary: false }), ACTOR, { language: 'Japanese', summary: false });
    expect(back.rows[0]).toBe(full.rows[0]);
  });
  it.each([
    ['머리 없음', l => { delete l.light; }],
    ['머리 판 다름', l => { l.light.version = 2; }],
    ['요약 여부가 요청과 다름', l => { l.light.summary = false; }],
    ['언어가 요청과 다름', l => { l.light.language = 'Chinese'; }],
    ['칸 목록 다름', l => { l.light.columns = [...l.light.columns].reverse(); }],
    ['요약 행 길이 다름', l => { l.rows[0] = l.rows[0].slice(1); }],
    ['기본값 칸을 실음', l => { l.registry.push(defaultRegistryEntry(l.rows[1][0], ACTOR)); }],
    ['행 없는 registry 칸', l => { l.registry.push({ ...l.registry[0], cardId: id(999) }); }],
    ['registry 칸 중복', l => { l.registry.push({ ...l.registry[0] }); }],
    ['다른 계정', l => { l.actorId = id(777); }],
    ['행이 배열이 아님', l => { l.rows = null; }],
  ])('%s → snapshot을 못 읽은 것과 같은 오류', (_name, mutate) => {
    const light = compactVocabularySnapshot(snapshot(), { language: null, summary: true });
    mutate(light);
    expect(() => expandLightSnapshot(light, ACTOR, { language: null, summary: true })).toThrow(expect.objectContaining(unavailable));
  });
  it('기준 구현도 칸이 빠진 snapshot은 줄이지 않는다', () => {
    const full = snapshot(); full.registry.pop();
    expect(() => compactVocabularySnapshot(full)).toThrow(expect.objectContaining(unavailable));
  });
});

describe('⑶ 서버 읽기 — 정확한 인자 · 같은 검사 · 함수 없음일 때만 물러섬', () => {
  const client = (handler) => ({ rpc: vi.fn(handler) });
  const lightOf = full => (name, args) => (name === 'fsrs_vocabulary_snapshot_light'
    ? { data: compactVocabularySnapshot(full, { language: args.p_language, summary: args.p_summary }), error: null } : { data: full, error: null });

  it('가벼운 RPC 하나를 정확한 인자로 부르고, 결과는 전체 snapshot을 같은 검사에 통과시킨 그 부분과 같다', async () => {
    const full = snapshot();
    for (const [language, summary] of [[null, true], ['Japanese', false]]) {
      const service = client(lightOf(full));
      const got = await readVocabularyLearningSnapshotLight({ serviceClient: service, userId: ACTOR, language, summary });
      expect(service.rpc.mock.calls).toEqual([['fsrs_vocabulary_snapshot_light', { p_actor: ACTOR, p_language: language, p_summary: summary }]]);
      expect(got).toEqual(validateVocabularyLearningSnapshot(subset(full, language, summary), ACTOR));
    }
  });
  it('운영에 함수가 아직 없으면(PGRST202 + 그 이름) 전체 snapshot 한 번으로 같은 값', async () => {
    const full = snapshot();
    const missing = { code: 'PGRST202', message: 'Could not find the function public.fsrs_vocabulary_snapshot_light(p_actor, p_language, p_summary) in the schema cache' };
    const service = client(name => (name === 'fsrs_vocabulary_snapshot_light' ? { data: null, error: missing } : { data: full, error: null }));
    const got = await readVocabularyLearningSnapshotLight({ serviceClient: service, userId: ACTOR, language: null, summary: true });
    expect(service.rpc.mock.calls.map(c => c[0])).toEqual(['fsrs_vocabulary_snapshot_light', 'fsrs_vocabulary_snapshot']);
    expect(got).toEqual(await readVocabularyLearningSnapshotLight({ serviceClient: client(lightOf(full)), userId: ACTOR, language: null, summary: true }));
  });
  it('다른 오류(시간 초과 · 다른 함수 없음 · 계정)는 물러서지 않고 그대로 — 과부하 때 읽기를 두 배로 하지 않는다', async () => {
    for (const error of [{ code: '57014', message: 'canceling statement due to statement timeout' },
      { code: 'PGRST202', message: 'Could not find the function public.fsrs_capabilities in the schema cache' },
      { code: '42501', message: 'invalid_fsrs_actor' }]) {
      const service = client(() => ({ data: null, error }));
      await expect(readVocabularyLearningSnapshotLight({ serviceClient: service, userId: ACTOR, language: null, summary: true })).rejects.toThrow();
      expect(service.rpc).toHaveBeenCalledTimes(1);
    }
  });
  it('알 수 없는 언어 · 요약 여부 · 계정 없음은 부르기 전에 거절', async () => {
    const service = client(() => ({ data: null, error: null }));
    await expect(readVocabularyLearningSnapshotLight({ serviceClient: service, userId: ACTOR, language: 'German', summary: false })).rejects.toMatchObject({ status: 400 });
    await expect(readVocabularyLearningSnapshotLight({ serviceClient: service, userId: ACTOR, language: null, summary: 'yes' })).rejects.toMatchObject({ status: 400 });
    await expect(readVocabularyLearningSnapshotLight({ serviceClient: service, userId: null, language: null, summary: true })).rejects.toMatchObject({ status: 401 });
    expect(service.rpc).not.toHaveBeenCalled();
  });
});

describe('⑷ /study 조립이 읽는 값은 전체 snapshot과 같다', () => {
  it('조립은 학습 목록을 이 세 곳(그 언어 예전 일정 줄 둘 · 그 언어 행 · 시각)에서만 읽는다', () => {
    const assemble = sliceBetween(fs.readFileSync(path.join(ROOT, 'src/lib/studyMaterials.js'), 'utf8'), 'export async function assembleStudyMaterials');
    expect(assemble).toContain("readVocabularyLearningSnapshotLight({ serviceClient: fsrsServiceClient(), userId, language: lang, summary: false })");
    expect([...assemble.matchAll(/\blearning\b[^\n;]*/g)].map(m => m[0]).filter(line => !line.startsWith('learning]'))).toEqual([
      'learning.now))',
      'learning, { language: lang, at: nowMs, dueOnly: false })',
      'learning, { language: lang, at: dueIso, limit: 4 })',
      'learning.rows.filter(row => row.language === lang)',
    ]);
  });
  it.each(['Japanese', 'Chinese', 'French'])('%s: 예전 일정 줄(전체 · 만기 4) · 그 언어 행이 전체 snapshot에서 고른 것과 같다', async lang => {
    const full = validateVocabularyLearningSnapshot(snapshot(), ACTOR);
    const light = await readVocabularyLearningSnapshotLight({ serviceClient: { rpc: async (name, args) => ({ data: compactVocabularySnapshot(snapshot(), { language: args.p_language, summary: args.p_summary }), error: null }) },
      userId: ACTOR, language: lang, summary: false });
    const at = NOW + 1000, due = iso(NOW + 36 * 3600000);
    expect(selectLegacyReviewRows(light, { language: lang, at, dueOnly: false })).toEqual(selectLegacyReviewRows(full, { language: lang, at, dueOnly: false }));
    expect(selectLegacyReviewRows(light, { language: lang, at: due, limit: 4 })).toEqual(selectLegacyReviewRows(full, { language: lang, at: due, limit: 4 }));
    expect(light.rows.filter(row => row.language === lang)).toEqual(full.rows.filter(row => row.language === lang));
    expect(light.now).toBe(full.now);
  });
});
