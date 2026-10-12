// KO-COMPOSER-001 · WRITE-STUDY-ENTRY-001 (#1337, 2026-10-08) — 자료 작성·글 자료 학습 입구의 계약.
// ⑴ 자료 언어 목록은 정본(LEARNING_LANGUAGES)을 재사용한다 — 목록 두 벌이 한국어 누락의 원인이었다.
// ⑵ 한국어는 계정의 배포 계약이 확인됐을 때만 고를 수 있고, 학습 행 메타는 기존 한국어 가져오기와 같다.
// ⑶ 언어 칩 짐작은 글자 종류로만 하고, 사용자가 고른 값·저장된 값은 덮지 않는다.
// ⑷ 「저장하고 공부하기」는 기존 openDocumentStudy를 그대로 쓰고, 실패해도 다시 저장하지 않는다.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { LEARNING_LANGUAGES } from '../learningSources';
import { COMPOSER_LANGUAGES, composerRow, createComposerSave, newComposerDraft, studyLanguages,
  guessStudyLanguage, guessedLanguagePatch, composerStudyState, shouldReadComposerOriginal } from '../materialComposer';
import { documentOf, openDocumentStudy, openStudyOrOriginal } from '../materialDocument';
import { openSourcePassage, PASSAGE_LANGUAGES, passageLanguageChoices, passageLanguageOptions } from '../sourcePassage';
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
  it('구간 학습 언어는 작성 언어 전부이고, 적용 SQL(KO-PASSAGE-001)이 여는 DB 목록과 같다', async () => {
    const listOf = text => text.split(',').map(value => value.trim().replace(/'/g, ''));
    const migration = readFileSync('supabase/migrations/20260908060607_source_passage_study.sql', 'utf8');
    const apply = readFileSync('docs/sql/korean-source-passage.sql', 'utf8');
    const before = listOf(migration.match(/p_language NOT IN \(([^)]+)\)/)[1]);
    const after = listOf(apply.match(/to_list constant text := 'NOT IN \(([^)]+)\)'/)[1]);
    expect(new Set(after)).toEqual(new Set([...before, 'Korean']));
    expect(new Set(PASSAGE_LANGUAGES)).toEqual(new Set(after));
    expect(PASSAGE_LANGUAGES).toEqual(COMPOSER_LANGUAGES);
    const client = { rpc: vi.fn(async () => ({ data: { id: 7, processed_json: { metadata: { composer: { version: 1, role: 'study', passage: { kind: 'body' } } } } }, error: null })) };
    await openSourcePassage(client, { id: 42 }, { kind: 'body' }, '학교', 'Korean');
    expect(client.rpc).toHaveBeenCalledWith('open_source_passage', expect.objectContaining({ p_language: 'Korean', p_parent: '42' }));
    await expect(openSourcePassage(client, { id: 42 }, {}, 'escuela', 'Spanish')).rejects.toThrow('PASSAGE_LANGUAGE');
  });
  it('화면의 구간 언어 선택지는 계정 계약을 따른다 — 한국어는 지원 계정에서만', () => {
    expect(passageLanguageChoices(studyLanguages(true))).toContain('Korean');
    expect(passageLanguageChoices(studyLanguages(false))).not.toContain('Korean');
    expect(passageLanguageChoices(studyLanguages(false))).toEqual(FOUR);
    // 화면에 나가는 라벨 그대로 — 한국어는 「한국어」, 다섯 라벨이 서로 다르다(같은 이름 두 개 = 고를 수 없는 선택지).
    const labels = passageLanguageOptions(studyLanguages(true)).map(option => option.label);
    expect(labels).toEqual(['일본어', '중국어', '영어', '프랑스어', '한국어']);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('WRITE-STUDY-ENTRY — 글자로 짐작', () => {
  const all = [...FOUR, 'Korean'];
  it('한글 글 → 한국어(지원 계정만), 가나 포함 → 일본어, 한자만 → 중국어, 라틴 → 짐작 없음', () => {
    expect(guessStudyLanguage('오늘은 비가 와서 집에서 책을 읽었어요.', all)).toBe('Korean');
    expect(guessStudyLanguage('오늘은 비가 와서 집에서 책을 읽었어요.', FOUR)).toBe('');
    expect(guessStudyLanguage('今日は雨なので家で本を読みました。', all)).toBe('Japanese');
    expect(guessStudyLanguage('今天下雨，我在家看书。', all)).toBe('Chinese');
    expect(guessStudyLanguage('It rained today, so I read at home.', all)).toBe('');
    expect(guessStudyLanguage('Il a plu aujourd’hui, j’ai lu à la maison.', all)).toBe('');
    expect(guessStudyLanguage('', all)).toBe('');
  });
  it('섞인 글은 지배 문자가 없으면 짐작하지 않는다(영어 글 속 일본어 한 단어 등)', () => {
    expect(guessStudyLanguage('My favourite word is すき and I use it every day.', all)).toBe('');
  });
  it('사용자가 고른 뒤에는 본문을 바꿔도 덮지 않는다 · 편집 중인 자료는 저장된 언어를 그대로 둔다', () => {
    const draft = { ...newComposerDraft(uuid(6)), body: '今日は雨です。' };
    expect(guessedLanguagePatch(draft, all)).toEqual({ language: 'Japanese', languageGuessed: true });
    const guessed = { ...draft, language: 'Japanese', languageGuessed: true, body: '今天下雨。' };
    expect(guessedLanguagePatch(guessed, all)).toEqual({ language: 'Chinese', languageGuessed: true });
    expect(guessedLanguagePatch({ ...guessed, body: 'Rain today.' }, all)).toEqual({ language: '', languageGuessed: false });
    const chosen = { ...draft, language: 'English', languageChosen: true, body: '今日は雨です。' };
    expect(guessedLanguagePatch(chosen, all)).toBeNull();
    expect(guessedLanguagePatch({ ...draft, language: '', languageChosen: true }, all)).toBeNull();
    // 이전 초안(선택 상자로 고른 값)도 사용자의 선택이다.
    expect(guessedLanguagePatch({ ...draft, language: 'French' }, all)).toBeNull();
    expect(guessedLanguagePatch({ ...draft, language: '' }, all, { editing: true })).toBeNull();
  });
});

describe('WRITE-STUDY-ENTRY — 「저장하고 공부하기」 상태', () => {
  const draft = { ...newComposerDraft(uuid(7)) };
  it('본문 + 언어가 있어야 켜지고, 아니면 이유를 보인다', () => {
    expect(composerStudyState({ ...draft, body: 'Bonjour', language: 'French' }, FOUR)).toEqual({ visible: true, ready: true, reason: '' });
    expect(composerStudyState({ ...draft, body: 'Bonjour' }, FOUR)).toEqual({ visible: true, ready: false, reason: '공부할 언어를 골라 주세요' });
    expect(composerStudyState({ ...draft, language: 'French' }, FOUR)).toEqual({ visible: true, ready: false, reason: '본문이 있어야 공부할 수 있어요' });
    // 지원이 확인되지 않은 언어(예: 계정 미지원 한국어)는 고른 것으로 치지 않는다.
    expect(composerStudyState({ ...draft, body: '학교', language: 'Korean' }, FOUR).ready).toBe(false);
  });
  it('첨부·링크만 있고 본문이 없으면 숨긴다 · 쓰기 노트에는 두지 않는다', () => {
    expect(composerStudyState({ ...draft, files: [{ hash: 'a' }], language: 'French' }, FOUR).visible).toBe(false);
    expect(composerStudyState({ ...draft, links: ['https://example.org'] }, FOUR).visible).toBe(false);
    expect(composerStudyState({ ...draft, body: 'Bonjour', files: [{ hash: 'a' }], language: 'French' }, FOUR).visible).toBe(true);
    expect(composerStudyState({ ...draft, body: 'Bonjour', language: 'French' }, FOUR, { note: true }).visible).toBe(false);
  });
  it('저장된 자료로 기존 학습 경로를 1회 열고, 실패하면 다시 저장하지 않고 원본 주소를 돌려준다', async () => {
    const db = backend(seed({ body: '今日は雨です。', language: 'Japanese' }));
    const record = structuredClone(db.rows[0]);
    const opened = await openStudyOrOriginal(db.client, record, 'Japanese', { returnTo: '/materials?view=owned' });
    expect(opened.href).toBe('/viewer/42?study=1&returnTo=%2Fmaterials%3Fview%3Downed');
    expect(opened.study.id).toBe(42); expect(db.writes).toEqual([]);
    db.failRead();
    const failed = await openStudyOrOriginal(db.client, record, 'Japanese', { returnTo: '/materials?view=owned' });
    expect(failed.study).toBeUndefined(); expect(failed.error).toBeTruthy();
    expect(failed.href).toBe('/viewer/42?returnTo=%2Fmaterials%3Fview%3Downed');
    expect(db.writes).toEqual([]);
  });
});
