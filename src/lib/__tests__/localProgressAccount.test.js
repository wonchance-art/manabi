// LOCAL-PROGRESS-ACCOUNT-001 (2026-10-17 KST)
// ① 레퍼런스 진도(ja/en/fr/zh_read_chapters · _check)가 계정을 몰라, 같은 기기에서 B가 로그인하면 pullProgress(force)의 합집합이
//    「로컬 전용은 서버로」 A의 진도를 B의 user_ref_progress에 올렸다. 계정 키(…:<accountId>)로 나누고, 손님 몫(옛 키)은 그 기기의
//    첫 로그인 계정에만 한 번 합친 뒤 비운다. A의 진도는 A 키에 남는다.
// ② study_source_<lang>(넘겨줄 글 — 뷰어는 비공개 자료 본문)이 생성 성공 때만 지워져, B의 /study?source=mine이 A의 본문을 받았다.
//    { owner, at, text }로 적고, 계정이 같고 30분 안일 때만 읽고, 계정이 떠나면 지운다.
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween';

const h = vi.hoisted(() => ({ upserts: [], remote: [] }));
vi.mock('../supabase', () => ({
  supabase: {
    from: () => {
      const q = { select: () => q, eq: async () => ({ data: h.remote, error: null }), upsert: async (rows) => { h.upserts.push(...rows); return { error: null }; } };
      return q;
    },
  },
}));
const { pullProgress } = await import('../refProgress');
const store = await import('../refReadStore');
const handoff = await import('../studySourceHandoff');

const ROOT = path.resolve(__dirname, '../../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
function memoryStorage() {
  const data = new Map();
  return { data, get length() { return data.size; }, key: i => [...data.keys()][i] ?? null,
    getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k), clear: () => data.clear() };
}
const pushedSlugs = () => h.upserts.map(r => `${r.user_id}:${r.slug}`).sort();

beforeEach(() => {
  h.upserts = []; h.remote = [];
  globalThis.window = globalThis.window || {};
  globalThis.localStorage = memoryStorage();
  globalThis.sessionStorage = memoryStorage();
});

describe('재현 ① — B 로그인 때 A의 기기 진도가 B 서버 기록으로 가지 않는다', () => {
  it('옛 판(무계정 키)에 A가 남긴 진도 — A가 먼저 들어와 합친 뒤 B가 로그인해도 B의 업로드에 A 진도 0', async () => {
    localStorage.setItem('ja_read_chapters', JSON.stringify(['n5-01', 'n5-02']));
    localStorage.setItem('ja_read_chapters_check', JSON.stringify({ 'n5-02': { right: 4, total: 5, passed: true, at: 1 } }));
    expect(store.claimGuestRefProgress('A')).toBe(true); // A가 이 기기의 첫 로그인 계정
    await pullProgress('A', store.REF_READ_KEYS, { force: true });
    expect(pushedSlugs()).toEqual(['A:n5-01', 'A:n5-02', 'A:n5-02']); // A 자신의 것은 A로(읽음 2 + 확인 1)
    h.upserts = [];
    expect(store.claimGuestRefProgress('B')).toBe(false); // 이미 A가 합침
    await pullProgress('B', store.REF_READ_KEYS, { force: true });
    expect(h.upserts).toEqual([]); // B 서버 기록에 A 진도 0
    expect([...store.readRefRead('ja_read_chapters', 'B')]).toEqual([]);
  });
  it('A가 로그인한 채 쌓은 진도(계정 키)는 B의 합집합에 들지 않고, A가 다시 들어오면 그대로', async () => {
    store.addRefRead('ja_read_chapters', 'A', 'n5-03');
    store.setRefCheck('ja_read_chapters', 'A', 'n5-03', { right: 5, total: 5, passed: true, at: 2 });
    await pullProgress('B', store.REF_READ_KEYS, { force: true });
    expect(h.upserts).toEqual([]);
    expect([...store.readRefRead('ja_read_chapters', 'A')]).toEqual(['n5-03']);
    expect(store.readRefChecks('ja_read_chapters', 'A')['n5-03'].passed).toBe(true);
  });
});

describe('손님 몫 합치기 — 그 기기의 첫 로그인 계정에 한 번', () => {
  it('합집합 · 더 최근 확인 점수 · 이른 날짜로 합치고 옛 키를 비운다', () => {
    localStorage.setItem('fr_read_chapters', JSON.stringify(['a1-01']));
    localStorage.setItem('fr_read_chapters_check', JSON.stringify({ 'a1-01': { passed: true, at: 50 }, 'a1-02': { passed: false, at: 10 } }));
    localStorage.setItem('fr_read_chapters_dates', JSON.stringify({ 'a1-01': 100 }));
    store.addRefRead('fr_read_chapters', 'A', 'a1-09');
    store.setRefCheck('fr_read_chapters', 'A', 'a1-02', { passed: true, at: 20 });
    localStorage.setItem('fr_read_chapters_dates:A', JSON.stringify({ 'a1-01': 200 }));
    store.claimGuestRefProgress('A');
    expect([...store.readRefRead('fr_read_chapters', 'A')].sort()).toEqual(['a1-01', 'a1-09']);
    expect(store.readRefChecks('fr_read_chapters', 'A')).toEqual({ 'a1-01': { passed: true, at: 50 }, 'a1-02': { passed: true, at: 20 } });
    expect(JSON.parse(localStorage.getItem('fr_read_chapters_dates:A'))).toEqual({ 'a1-01': 100 });
    for (const key of ['fr_read_chapters', 'fr_read_chapters_check', 'fr_read_chapters_dates']) expect(localStorage.getItem(key)).toBeNull();
    expect(localStorage.getItem(store.GUEST_PROGRESS_CLAIM_KEY)).toBe('A');
  });
  it('합친 뒤 손님이 쌓은 것은 다음 계정(B)에도, 다시 들어온 A에게도 합치지 않는다 — 손님 화면에만', () => {
    store.claimGuestRefProgress('A');
    store.addRefRead('zh_read_chapters', null, 'h1-01'); // 로그아웃 뒤 손님
    expect(store.claimGuestRefProgress('B')).toBe(false);
    expect(store.claimGuestRefProgress('A')).toBe(false);
    expect([...store.readRefRead('zh_read_chapters', 'B')]).toEqual([]);
    expect([...store.readRefRead('zh_read_chapters', 'A')]).toEqual([]);
    expect([...store.readRefRead('zh_read_chapters', null)]).toEqual(['h1-01']);
  });
  it('계정 키 규약 — 손님은 옛 키 그대로, 쿼리 문맥 같은 이상한 값은 손님', () => {
    expect(store.refReadKey('ja_read_chapters', 'A')).toBe('ja_read_chapters:A');
    expect(store.refCheckKey('ja_read_chapters', 'A')).toBe('ja_read_chapters_check:A');
    expect(store.refReadKey('ja_read_chapters', null)).toBe('ja_read_chapters');
    expect(store.refCheckKey('ja_read_chapters', { queryKey: [] })).toBe('ja_read_chapters_check');
  });
});

describe('재현 ② — /study?source=mine 넘겨받은 글', () => {
  it('A가 넘긴 글을 B는 받지 못하고, A는 30분 안에만 받는다', () => {
    handoff.writeStudySource('Japanese', 'A의 비공개 본문', 'A', { now: 1000 });
    expect(handoff.readStudySource('Japanese', 'B', { now: 2000 })).toBe('');
    expect(handoff.readStudySource('Japanese', null, { now: 2000 })).toBe('');
    expect(handoff.readStudySource('Japanese', 'A', { now: 2000 })).toBe('A의 비공개 본문');
    expect(handoff.readStudySource('Japanese', 'A', { now: 1000 + handoff.STUDY_SOURCE_TTL_MS + 1 })).toBe('');
    expect(handoff.STUDY_SOURCE_TTL_MS).toBe(30 * 60 * 1000);
  });
  it('옛 꼴(본문만 — 누가 넘겼는지 모름)은 누구에게도 넘기지 않는다', () => {
    localStorage.setItem('study_source_Japanese', 'A의 옛 본문');
    expect(handoff.readStudySource('Japanese', 'A')).toBe('');
    expect(handoff.readStudySource('Japanese', null)).toBe('');
  });
  it('손님끼리 넘긴 글은 손님이 받는다 · 계정이 떠나면 모든 언어를 지운다', () => {
    handoff.writeStudySource('French', '손님 글', null, { now: 1 });
    expect(handoff.readStudySource('French', null, { now: 2 })).toBe('손님 글');
    handoff.writeStudySource('Japanese', 'A 글', 'A');
    localStorage.setItem('other_key', 'x');
    expect(handoff.clearAllStudySources()).toBe(2);
    expect(localStorage.getItem('study_source_Japanese')).toBeNull();
    expect(localStorage.getItem('other_key')).toBe('x');
  });
});

describe('배선 — 진도 읽기 · 쓰기는 한 모듈(refReadStore), 넘겨주기는 studySourceHandoff', () => {
  it('AuthContext: 그리기 전에 손님 몫을 합치고, 계정이 떠나면 넘겨줄 글을 지운다 · 로그인 동기화는 같은 키 바탕', () => {
    const src = read('src/lib/AuthContext.jsx');
    const adopt = sliceBetween(src, 'function adoptUser(nextUser) {', 'setUser(nextUser ?? null);');
    expect(adopt).toContain('if (nextActor) claimGuestRefProgress(nextActor);');
    expect(sliceBetween(adopt, 'if (accountCacheReset(', 'if (nextActor) claimGuestRefProgress(nextActor);')).toContain('clearAllStudySources();');
    expect(src).toContain("import { REF_READ_KEYS, claimGuestRefProgress } from './refReadStore';");
    expect(src).toContain('pullProgress(user.id, REF_READ_KEYS, { force: true })');
  });
  it('pullProgress는 그 계정의 키만 읽고 쓴다', () => {
    const fn = sliceBetween(read('src/lib/refProgress.js'), 'export async function pullProgress(', 'if (toPush.length > 0)');
    expect(fn).toContain('const ownReadKey = refReadKey(readKey, userId);');
    expect(fn).toContain('const checkKey = refCheckKey(readKey, userId);');
    expect(fn).not.toMatch(/getItem\(readKey\)|setItem\(readKey,/);
  });
  it('/study · /learn(강의 목록 · 코스 · 레퍼런스 장) · 온보딩이 같은 키 함수를 쓴다', () => {
    expect(read('src/views/StudySessionPage.jsx')).toContain('setRefCheck(readKey, recorder, meta.slug, checkResult);');
    expect(read('src/views/StudySessionPage.jsx')).toContain('addRefRead(readKey, recorder, meta.slug);');
    expect(read('src/views/LessonsPage.jsx')).toContain('map[name] = readRefRead(ref.readKey, user?.id ?? null);');
    expect(read('src/views/StudyOnboarding.jsx')).toContain('readRefChecks(readKey, user?.id ?? null)');
    const progress = read('src/lib/learn/progressStore.js');
    expect(progress).toContain('const LESSON_READ_KEYS = REF_READ_KEYS;');
    expect(progress).toContain('addStoredArray(refReadKey(readKey, accountId));');
    expect(progress).toContain('readLocalLessonProgress(lang, allowed, vocabLessons, userId)');
    const mark = read('src/components/RefReadMark.jsx');
    expect(mark).toContain('const readKey = refReadKey(storageKey, user?.id ?? null), datesKey = refDatesKey(storageKey, user?.id ?? null);');
    expect(mark).toContain('if (!storageKey || !slug || loading) return;');
    expect(read('src/components/KanaTest.jsx')).toContain('accountScopedKey(storageKey, user?.id ?? null)');
    expect(read('src/components/RefPatternCheck.jsx').match(/accountScopedKey\(storageKey, user\?\.id \?\? null\)/g)).toHaveLength(2);
  });
  it('남은 곳이 옛 키를 직접 읽고 쓰지 않는다(소스 전체 — 옛 키 이름 · readKey 직접 접근)', () => {
    const files = [];
    const walk = dir => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) { if (!['__tests__', 'textbookEditions'].includes(e.name)) walk(p); } else if (/\.(jsx?|mjs)$/.test(e.name)) files.push(p); } };
    walk(path.join(ROOT, 'src'));
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/localStorage\.(get|set|remove)Item\((ref\.readKey|`\$\{(ref\.)?readKey\}_check`|storageKey\b|'(ja|en|fr|zh)_read_chapters)/);
      expect(src, f).not.toMatch(/localStorage\.(get|set|remove)Item\(`study_source_/);
    }
  });
  it('넘겨주기 쓰는 곳 · 읽는 곳', () => {
    expect(read('src/views/ViewerPage.jsx')).toContain('writeStudySource(materialLang, (material.raw_text || \'\').slice(0, 1500), user?.id ?? null);');
    expect(read('src/views/StudyLibraryPage.jsx')).toContain('writeStudySource(lang, t.slice(0, SOURCE_MAX), knownAccount() ?? null);');
    const session = read('src/views/StudySessionPage.jsx');
    expect(session).toContain('sourceText = readStudySource(lang, user?.id ?? null);');
    expect(session).toContain('if (sourceText) clearStudySource(lang);');
  });
});
