// LEVEL-SAVED-TAG-001 — 담기만 하고 공부하지 않은 단어(☆ · 담기)는 서버(Anki 규칙)에서 새 카드라 첫 문제가 하루 새 단어 몫을 쓴다.
// 단어 페이지는 이 단어를 「오늘」 복습으로 보였고(담은 직후 기한) · 오늘 시작한 새 단어를 오늘 생긴 행만 세어(newStartedToday) 서버와
// 어긋났다(운영 2026-10-30 KST — 10-19에 담은 단어를 채점, 서버 15/15 · 화면 0 → 몫이 찬 뒤 거절). 오너 승인 2026-10-30 KST:
//   A. 그 단어는 [담음] 표시만, 줄 · 몫 셈에서는 새 단어와 같이. B. 오늘 새 단어 수는 서버 입장 한도(쓴 수 · 남은 수 · 한도)로.
//   C. 몫 안내에 [한도 늘리기](/vocab 복습 설정) [연습만 하기](그 단어 하나 문장 연습) 두 단추.
import fs from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

let loaded = null;
vi.mock('../useLearningAdmission', () => ({ createLearningAdmissionClient: () => ({ load: async () => {
  if (loaded instanceof Error) throw loaded;
  return loaded;
} }) }));

const { levelNewSlots } = await import('../levelDailyLoad');
const { startLevelSession } = await import('../levelWordSession');
afterEach(() => { loaded = null; });

const actorId = '10000000-0000-0000-0000-000000000001';
const status = (extra) => ({ version: 1, actorId, installed: true, enabled: true, active: true, fsrsEnabled: true,
  startsAt: '2026-10-03T19:00:00.000Z', now: '2026-10-30T03:00:00.000Z', learningDay: '2026-10-30',
  timeZone: 'Asia/Seoul', rolloverHour: 4, limit: 15, policyRevision: 1, used: 15, remaining: 0,
  fsrsUsed: 15, legacyUsed: 0, admittedLegacyCardIds: [], ...extra });

describe('A. 담음 단어는 줄에서 새 단어와 같이 — 하루 몫 안에 선다', () => {
  it('saved는 fresh(새 단어)로 · newCap 밖이면 held(「새 단어 N개 더」)', () => {
    const entries = ['r', 's1', 'n1', 's2'].map((key) => ({ key }));
    const st = { r: 'today', s1: 'saved', n1: 'new', s2: 'saved' };
    const all = startLevelSession(entries, (k) => st[k], () => 0, 0);
    expect(all.queue.sort()).toEqual(['n1', 'r', 's1', 's2']);
    const capped = startLevelSession(entries, (k) => st[k], () => 0, 0, { newCap: 0 });
    expect(capped.queue).toEqual(['r']); // 몫이 찬 날 — 오늘 복습만 선다(담음 단어는 전처럼 「오늘」로 끼지 않는다)
    expect(capped.held).toEqual(['s1', 'n1', 's2']);
  });
});

describe('B. 오늘 새 단어 몫 — 서버 입장 한도가 정본', () => {
  it('입장 모드는 서버의 한도 · 쓴 수 · 남은 수(reviewScopeQuota)', async () => {
    loaded = status();
    expect(await levelNewSlots(actorId)).toEqual({ limit: 15, used: 15, remaining: 0 });
    loaded = status({ used: 4, fsrsUsed: 3, legacyUsed: 1, remaining: 11 });
    expect(await levelNewSlots(actorId)).toEqual({ limit: 15, used: 4, remaining: 11 });
  });
  it('호환(사전 활성) 모드 · 미설치 · 못 읽음 · 손님은 null — 화면이 기기 셈(newStartedToday)으로', async () => {
    loaded = status({ enabled: false, active: false, fsrsEnabled: false, startsAt: null });
    expect(await levelNewSlots(actorId)).toBeNull();
    loaded = status({ installed: false, enabled: false, active: false, fsrsEnabled: false, startsAt: null, limit: null, policyRevision: null,
      used: null, remaining: null, fsrsUsed: null, legacyUsed: null, admittedLegacyCardIds: null });
    expect(await levelNewSlots(actorId)).toBeNull();
    loaded = new Error('learning_admission_unavailable');
    expect(await levelNewSlots(actorId)).toBeNull();
    expect(await levelNewSlots(null)).toBeNull();
  });
  it('계약: 화면은 서버 몫을 import()로 읽어 줄 · 「오늘 새 단어 N개 끝」에 쓰고, 못 읽으면 기기 셈', () => {
    const screen = fs.readFileSync('src/components/levels/word/LevelWordScreen.jsx', 'utf8');
    expect(screen).toContain("import('@/lib/levelDailyLoad').then((m) => m.levelNewSlots(userId))");
    expect(screen).not.toMatch(/^import[^;]*(levelDailyLoad|useLearningAdmission|learningAdmission)/m); // 한도 모듈은 첫 그림 밖
    expect(screen).toContain('const newCap = perDay === null ? Infinity : slots ? slots.remaining : perDay - newStartedToday(index, language, Date.now());');
    expect(screen).toContain('slots ? slots.used : newStartedToday(index, language, clock)');
    expect(screen).toContain("const stillNew = useCallback((k) => ['new', 'saved'].includes(table.get(k)?.status), [table]);");
    // 새 셈을 만들지 않는다 — 남은 수는 배움 칸 · 복습방과 같은 reviewScopeQuota.
    const load = fs.readFileSync('src/lib/levelDailyLoad.js', 'utf8');
    expect(load).toContain('remaining: reviewScopeQuota({ quota, compatibility: false }).remaining');
  });
});

describe('C. 몫 안내 — [한도 늘리기] [연습만 하기]', () => {
  it('한도는 단어장 복습 설정을 펼친 채로 · 연습은 그 단어 하나짜리 문장 연습(일정 없음)', () => {
    const screen = fs.readFileSync('src/components/levels/word/LevelWordScreen.jsx', 'utf8');
    expect(screen).toContain("href: '/vocab#review-settings', action: '한도 늘리기', also: entry ? { action: '연습만 하기', onAction: () => practiceOnlyRef.current?.(entry) } : null");
    expect(screen).toContain("practiceOnlyRef.current = (entry) => { startPractice('sentence', [entry.key]); switchView('sentence'); };");
    expect(screen).toContain('<button type="button" onClick={act(notice.also.onAction)}>{notice.also.action}</button>');
    // #review-settings로 오면 복습 설정(하루 새 표현 한도)을 펼친다 — 내 정보 시트와 같은 길.
    expect(fs.readFileSync('src/views/VocabPage.jsx', 'utf8')).toContain("window.location.hash !== '#review-settings'");
  });
  it('담음 칸은 토큰 색만 쓴다(단어 페이지 · 뷰어)', () => {
    expect(fs.readFileSync('src/components/levels/word/level-word.css', 'utf8'))
      .toContain('.lw-status--saved{color:var(--lw-rose)}.lw-status--saved::before{border-color:var(--lw-today-line)}');
    expect(fs.readFileSync('src/components/viewer/reader-controls.css', 'utf8')).toContain('.reader-sentence .lw-status--saved {color:var(--reader-rose);}');
  });
});
