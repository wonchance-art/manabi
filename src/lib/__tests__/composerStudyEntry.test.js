// KO-COMPOSER-001 · WRITE-STUDY-ENTRY-001 (#1337, 2026-10-08) — 자료 작성·글 자료 학습 입구의 계약.
// ⑴ 자료 언어 목록은 정본(LEARNING_LANGUAGES)을 재사용한다 — 목록 두 벌이 한국어 누락의 원인이었다.
// ⑵ 한국어는 계정의 배포 계약이 확인됐을 때만 고를 수 있고, 학습 행 메타는 기존 한국어 가져오기와 같다.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { LEARNING_LANGUAGES } from '../learningSources';
import { COMPOSER_LANGUAGES, composerRow, createComposerSave, newComposerDraft, studyLanguages,
  shouldReadComposerOriginal } from '../materialComposer';
import { documentOf, openDocumentStudy } from '../materialDocument';
import { openSourcePassage, PASSAGE_LANGUAGES } from '../sourcePassage';
import { LEVELS } from '../constants';

const owner = '00000000-0000-4000-8000-000000000321';
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const FOUR = ['Japanese', 'Chinese', 'English', 'French'];

function seed({ body = '학교에 갔어요.\n친구를 만났어요.', language = 'Korean' } = {}) {
  const save = createComposerSave(owner, { ...newComposerDraft(uuid(1)), title: '하루', body, language }, { explanationLocale: 'zh-TW' });
  return { ...save.attempt.row, id: 42, document_json: null };
}
// materialDocument.test.js와 같은 모양의 최소 모의 클라이언트 — 읽기·갱신·삽입만.
function backend(row) {
  const rows = [structuredClone(row)], writes = [];
  let failRead = false;
  const value = (r, key) => key.includes('importAttempt') ? r.processed_json.metadata.importAttempt : r[key];
  const client = { from() {
    let mode = 'read', patch, single = false; const filters = [];
    const chain = { select() { return chain; }, limit() { return chain; }, maybeSingle() { single = true; return chain; },
      eq(k, v) { filters.push(r => typeof value(r, k) === 'object' ? JSON.stringify(value(r, k)) === v : String(value(r, k)) === String(v)); return chain; },
      update(v) { mode = 'update'; patch = v; return chain; }, insert(v) { mode = 'insert'; patch = v[0]; return chain; },
      then(resolve, reject) { return Promise.resolve().then(() => {
        if (failRead) throw new Error('offline');
        let found = rows.filter(r => filters.every(f => f(r)));
        if (mode === 'update') { found.forEach(r => Object.assign(r, structuredClone(patch))); writes.push(patch); }
        if (mode === 'insert') { const r = { ...structuredClone(patch), id: rows.length + 42 }; rows.push(r); found = [r]; writes.push(patch); }
        return { data: single ? structuredClone(found[0] || null) : structuredClone(found) };
      }).then(resolve, reject); } };
    return chain;
  } };
  return { client, rows, writes, failRead: () => { failRead = true; } };
}

describe('KO-COMPOSER — 정본 언어 목록 재사용', () => {
  it('자료 언어 목록은 LEARNING_LANGUAGES와 원소 집합이 같다(따로 들지 않는다)', () => {
    expect(new Set(COMPOSER_LANGUAGES)).toEqual(new Set(LEARNING_LANGUAGES));
    expect(COMPOSER_LANGUAGES).toHaveLength(LEARNING_LANGUAGES.length);
  });
  it('수준(레벨) 4언어 상수는 그대로다(오너 결정 2026-09-02)', () => {
    expect(Object.keys(LEVELS).sort()).toEqual([...FOUR].sort());
  });
  it('한국어 선택지는 계정 계약이 확인됐을 때만, 다른 네 언어는 항상', () => {
    expect(studyLanguages(true)).toEqual([...FOUR, 'Korean']);
    expect(studyLanguages(false)).toEqual(FOUR);
  });
  it('작성 화면에서 한국어로 저장한 초안의 언어가 직렬화에서 지워지지 않는다', () => {
    const row = composerRow(owner, { ...newComposerDraft(uuid(3)), body: '학교', language: 'Korean' }, { explanationLocale: 'ko' });
    expect(row.processed_json.metadata.language).toBe('Korean');
    expect(shouldReadComposerOriginal(row, new URLSearchParams('study=1'))).toBe(false);
  });
  it('한국어 학습 행 메타는 기존 한국어 가져오기와 같은 키·값(level \'\' · explanationLocale)을 가진다', () => {
    const row = composerRow(owner, { ...newComposerDraft(uuid(4)), body: '학교', language: 'Korean' }, { explanationLocale: 'zh-TW' });
    expect(row.processed_json.metadata).toMatchObject({ language: 'Korean', level: '', explanationLocale: 'zh-TW' });
    // 기존 한국어 가져오기(옛 화면)의 한국어 분기가 같은 두 키를 싣는다 — 둘 중 하나가 바뀌면 여기서 갈린다.
    const legacy = readFileSync('src/views/MaterialAddPage.jsx', 'utf8');
    expect(legacy).toContain("level: isKoreanReading ? '' : level");
    expect(legacy).toContain('...(isKoreanReading ? { explanationLocale } : {})');
    // 다른 언어 행은 이전과 같다(새 키를 얹지 않는다).
    const english = composerRow(owner, { ...newComposerDraft(uuid(5)), body: 'text', language: 'English' }, { explanationLocale: 'zh-TW' });
    expect(english.processed_json.metadata).not.toHaveProperty('explanationLocale');
    expect(english.processed_json.metadata).not.toHaveProperty('level');
  });
  it('openDocumentStudy(…, Korean)는 언어 오류로 거절되지 않고 한국어 메타를 채운다', async () => {
    const db = backend(seed());
    const same = await openDocumentStudy(db.client, db.rows[0], 'Korean', { explanationLocale: 'zh-TW' });
    expect(same.id).toBe(42); expect(db.writes).toEqual([]);
    const other = backend(seed({ language: '' }));
    const first = await openDocumentStudy(other.client, other.rows[0], 'Korean', { explanationLocale: 'zh-CN' });
    expect(first.processed_json.metadata).toMatchObject({ language: 'Korean', level: '', explanationLocale: 'zh-CN' });
    const japanese = await openDocumentStudy(db.client, db.rows[0], 'Japanese', { explanationLocale: 'zh-CN' });
    expect(japanese.id).not.toBe(42);
    expect(japanese.processed_json.metadata).not.toHaveProperty('explanationLocale');
  });
  it('수정한 한국어 본문의 새 학습 행도 같은 한국어 메타를 가진다', async () => {
    const row = seed();
    row.document_json = { ...documentOf(row), revision: uuid(9), body: '새로 쓴 글이에요.', hasBody: true, excerpt: '새로 쓴 글이에요.' };
    const db = backend(row);
    const study = await openDocumentStudy(db.client, db.rows[0], 'Korean', { explanationLocale: 'ko' });
    expect(study.id).not.toBe(42);
    expect(study).toMatchObject({ raw_text: '새로 쓴 글이에요.', processed_json: { status: 'pending',
      metadata: { language: 'Korean', level: '', explanationLocale: 'ko', composer: { role: 'study', parentId: '42' } } } });
  });
  it('구간 학습은 DB의 open_source_passage가 네 언어만 받으므로 한국어를 클라이언트에서 먼저 막는다(DB 변경 전까지)', async () => {
    const sql = readFileSync('supabase/migrations/20260908060607_source_passage_study.sql', 'utf8');
    const rpc = sql.match(/p_language NOT IN \(([^)]+)\)/)[1].split(',').map(value => value.trim().replace(/'/g, ''));
    expect(new Set(PASSAGE_LANGUAGES)).toEqual(new Set(rpc));
    expect(PASSAGE_LANGUAGES.every(language => COMPOSER_LANGUAGES.includes(language))).toBe(true);
    const client = { rpc: vi.fn() };
    await expect(openSourcePassage(client, { id: 42 }, {}, '학교', 'Korean')).rejects.toThrow('PASSAGE_LANGUAGE');
    expect(client.rpc).not.toHaveBeenCalled();
  });
});
