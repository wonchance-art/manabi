import { describe, it, expect } from 'vitest';

// refProgress → supabase.js 가 모듈 로드 시 env 를 요구하므로 스텁 후 동적 import
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';
const { chapterRowsByLang, mergeChapterRead } = await import('../refProgress');

// P1-1: pullProgress 의 병합 재료 조립·읽음 병합을 순수 함수로 추출해 검증한다 —
// 챕터 Set 은 chapterRowsByLang 이 만든 Map 에서만 slug 를 받으므로, 여기서 rt: 가
// 걸러지면 병합 루프 어디로도 유입될 수 없다(모킹 없는 구조적 보장).
describe('chapterRowsByLang — rt: 행은 챕터 병합 재료에서 제외(독해 트랙 오염 0)', () => {
  const rows = [
    { lang: 'Japanese', slug: 'n5-04-desu-da', read: true },
    { lang: 'Japanese', slug: 'rt:n5-tokyo-01', read: true },            // 독해 트랙 행 — 제외
    { lang: 'Japanese', slug: 'rt:n5-tokyo-02', read: true, updated_at: '2026-07-01T00:00:00Z' },
    { lang: 'French', slug: 'a1-01', read: true },
  ];

  it('rt: 접두 slug 는 어느 lang 맵에도 오르지 않는다', () => {
    const byLang = chapterRowsByLang(rows);
    expect([...byLang.Japanese.keys()]).toEqual(['n5-04-desu-da']);
    expect([...byLang.French.keys()]).toEqual(['a1-01']);
  });

  it('null·slug 없는 행 방어', () => {
    expect(chapterRowsByLang(null)).toEqual({});
    const byLang = chapterRowsByLang([null, { lang: 'Japanese' }, ...rows]);
    expect(byLang.Japanese.size).toBe(1);
  });
});

describe('pullProgress 읽음 병합 — rt: 행 주입에도 챕터 Set 미유입', () => {
  it('서버에 rt: read 행이 섞여 있어도 챕터 읽음 Set 에는 챕터 slug 만 남는다', () => {
    const remote = chapterRowsByLang([
      { lang: 'Japanese', slug: 'n5-04-desu-da', read: true },
      { lang: 'Japanese', slug: 'rt:n5-tokyo-01', read: true }, // 통과 글 — readingProgress 몫
      { lang: 'Japanese', slug: 'n5-05-kore', read: false },    // read:false 는 합류 안 함
    ]).Japanese;
    const merged = mergeChapterRead(new Set(['n5-01-hajimemashite']), remote);
    expect([...merged].sort()).toEqual(['n5-01-hajimemashite', 'n5-04-desu-da']);
    expect(merged.has('rt:n5-tokyo-01')).toBe(false);
  });

  it('mergeChapterRead 는 입력 Set 을 변형하지 않는다(순수)', () => {
    const local = new Set(['n5-01-hajimemashite']);
    const remote = chapterRowsByLang([{ lang: 'Japanese', slug: 'n5-04-desu-da', read: true }]).Japanese;
    mergeChapterRead(local, remote);
    expect(local.size).toBe(1);
  });

  it('원격이 비어 있으면(그 lang 행 전무) 로컬 그대로', () => {
    const merged = mergeChapterRead(new Set(['n5-01-hajimemashite']), new Map());
    expect([...merged]).toEqual(['n5-01-hajimemashite']);
  });
});
