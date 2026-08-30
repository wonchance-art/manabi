import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import { buildPlan, isChapterDone, markProgress } from '../studyPlan.js';
import { REF_GRAMMAR_MANIFEST } from '../../content/refGrammarManifest.js';

/**
 * 계약: v2-D R1 목표를 데이터로 — 삼중 진실을 하나로 (#1077 설계 §1·§4).
 * 계획은 정본 manifest에서만 유도하고(손복사본 금지), 진도는 서버 `user_ref_progress`
 * 한 곳에서만 읽는다(손 체크 금지). 새 테이블·새 이벤트·마이그레이션은 전부 0.
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
/** 주석 제거 후 대조 — 설명 문구가 계약에 잡히지 않게(v2-L 자기함정 클래스). */
const codeOf = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** 정본 모양만 흉내 낸 최소 manifest — 콘텐츠가 늘어도 순수 로직 계약이 흔들리지 않게. */
const FAKE = {
  languages: {
    Chinese: {
      base: '/chinese', langCode: 'zh', flag: '🇨🇳', name: '중국어',
      levelMeta: [{ key: 'L1', label: 'L1 기초' }, { key: 'L2', label: 'L2 초급' }],
      levels: [
        {
          key: 'L1', vocabCount: 10, bunkeiAvailable: true,
          // 정본의 이 배열은 패턴마다 소속 챕터 slug라 중복이 있다 — 개수가 곧 패턴 수다.
          bunkeiChapterSlugs: ['a', 'a', 'b'],
          chapters: [
            { slug: 'a', order: 1, title: '긴 제목 A', topic: 'A' },
            { slug: 'b', order: 2, title: '긴 제목 B', topic: 'B' },
          ],
        },
        {
          key: 'L2', vocabCount: 0, bunkeiAvailable: false, bunkeiChapterSlugs: [],
          chapters: [{ slug: 'c', order: 1, title: '긴 제목 C', topic: 'C' }],
        },
        // 어휘 전용 레벨(중국어 LIFE) — 챕터가 없다
        { key: 'LIFE', vocabCount: 5, bunkeiAvailable: false, bunkeiChapterSlugs: [], chapters: [] },
      ],
    },
  },
};

describe('§1 계획 유도 — 정본이 곧 계획표', () => {
  it('챕터·제목·순서가 전부 manifest에서 온다', () => {
    const plan = buildPlan(FAKE, 'Chinese');
    expect(plan.levels.map(l => l.key)).toEqual(['L1', 'L2']);
    expect(plan.levels[0].label).toBe('L1 기초');
    expect(plan.levels[0].chapters).toEqual([
      { slug: 'a', seq: 1, order: 1, title: '긴 제목 A', topic: 'A', href: '/chinese/grammar/a' },
      { slug: 'b', seq: 2, order: 2, title: '긴 제목 B', topic: 'B', href: '/chinese/grammar/b' },
    ]);
    expect(plan.totalChapters).toBe(3);
  });

  it('계획 전체를 관통하는 번호가 레벨을 넘어 이어진다 — "다음 #37"이 성립해야 한다', () => {
    const plan = buildPlan(FAKE, 'Chinese');
    expect(plan.levels.flatMap(l => l.chapters).map(c => c.seq)).toEqual([1, 2, 3]);
  });

  it('목표 레벨까지만 계획이다 — HSK5가 목표인데 H6까지 세면 완주율이 거짓말이 된다', () => {
    const upto = buildPlan(FAKE, 'Chinese', { upto: 'L1' });
    expect(upto.levels.map(l => l.key)).toEqual(['L1']);
    expect(upto.totalChapters).toBe(2);
    // 없는 레벨을 주면 전부 — 목표가 어긋나도 화면이 비지 않는다
    expect(buildPlan(FAKE, 'Chinese', { upto: 'ZZ' }).totalChapters).toBe(3);
  });

  it('챕터 없는 레벨은 계획에 서지 않는다 — 진도의 단위가 챕터라 0/0 칸이 된다', () => {
    expect(buildPlan(FAKE, 'Chinese').levels.some(l => l.key === 'LIFE')).toBe(false);
  });

  it('문형·어휘는 레벨 단위 길만 놓는다(개수는 정본에서, 진도는 아직 아니다 — R3)', () => {
    const [l1, l2] = buildPlan(FAKE, 'Chinese').levels;
    expect(l1.bunkeiCount).toBe(3);
    expect(l1.bunkeiHref).toBe('/chinese/bunkei/L1');
    expect(l1.vocabHref).toBe('/chinese/vocab/L1');
    expect(l2.bunkeiHref).toBeNull();   // 문형 없는 레벨에 죽은 링크를 놓지 않는다
    expect(l2.vocabHref).toBeNull();
  });

  it('모르는 언어는 null — 호출자가 그 칸을 비운다', () => {
    expect(buildPlan(FAKE, 'Klingon')).toBeNull();
    expect(buildPlan(null, 'Chinese')).toBeNull();
  });
});

describe('§4-3 진도 정의 — passed ?? read', () => {
  it('통과가 우선, 확인 문제를 안 봤으면 읽음으로', () => {
    expect(isChapterDone({ read: true })).toBe(true);
    expect(isChapterDone({ passed: true, read: false })).toBe(true);
    // 체크에서 떨어진 챕터는 읽었어도 아직 아니다 — 통과가 있으면 통과가 답이다
    expect(isChapterDone({ passed: false, read: true })).toBe(false);
    expect(isChapterDone({ read: false })).toBe(false);
    expect(isChapterDone(undefined)).toBe(false);
  });

  it('행이 없으면 미완 — 계획에 있는데 기록이 없으면 아직 안 한 것', () => {
    const p = markProgress(buildPlan(FAKE, 'Chinese'), []);
    expect(p.done).toBe(0);
    expect(p.pct).toBe(0);
    expect(p.next.slug).toBe('a');
  });
});

describe('진도 겹치기 — 서버 한 곳만 읽는다', () => {
  const plan = buildPlan(FAKE, 'Chinese');

  it('본문 순서대로 첫 미완이 "다음"이다', () => {
    const p = markProgress(plan, [{ lang: 'Chinese', slug: 'a', read: true }]);
    expect(p.done).toBe(1);
    expect(p.pct).toBe(33);
    expect(p.remaining).toBe(2);
    expect(p.next).toMatchObject({ slug: 'b', seq: 2 });
    expect(p.levels[0]).toMatchObject({ done: 1, total: 2 });
  });

  it('독해 트랙(rt:) 행이 섞여도 완주율이 오염되지 않는다 — 같은 테이블을 쓴다', () => {
    const p = markProgress(plan, [
      { lang: 'Chinese', slug: 'rt:zh-001', read: true },
      { lang: 'Chinese', slug: 'a', read: true },
    ]);
    expect(p.done).toBe(1);
  });

  it('남의 언어 진도를 세지 않는다', () => {
    const p = markProgress(plan, [{ lang: 'French', slug: 'a', read: true }]);
    expect(p.done).toBe(0);
  });

  it('전부 하면 다음이 없다 — 완주 문구가 설 자리', () => {
    const rows = ['a', 'b', 'c'].map(slug => ({ lang: 'Chinese', slug, passed: true }));
    const p = markProgress(plan, rows);
    expect(p.done).toBe(3);
    expect(p.pct).toBe(100);
    expect(p.next).toBeNull();
  });

  it('계획이 없으면 null — 렌더가 터지지 않는다', () => {
    expect(markProgress(null, [])).toBeNull();
    expect(markProgress(plan, null).done).toBe(0);
  });
});

describe('slug rename — 옛 이름으로 남은 진도를 잃지 않는다', () => {
  const fr = buildPlan(REF_GRAMMAR_MANIFEST, 'French');

  it('별칭 정본(storageSchema.slugAliases)을 거쳐 대조한다', () => {
    // 'a0-06-gender'는 rename 전 이름이고 정본 챕터는 'a1-11-gender'다
    const p = markProgress(fr, [{ lang: 'French', slug: 'a0-06-gender', read: true }]);
    const ch = p.levels.flatMap(l => l.chapters).find(c => c.slug === 'a1-11-gender');
    expect(ch.done).toBe(true);
    expect(p.done).toBe(1);
  });

  it('옛·새 행이 둘 다 있으면 한 쪽이라도 했으면 했다 — 먼저 온 행이 이기면 안 된다', () => {
    const rows = [
      { lang: 'French', slug: 'a1-11-gender', read: false },
      { lang: 'French', slug: 'a0-06-gender', passed: true },
    ];
    expect(markProgress(fr, rows).done).toBe(1);
    expect(markProgress(fr, [...rows].reverse()).done).toBe(1);
  });
});

describe('§4-1 하드코딩 계획 부활 금지 — 손복사본이 어긋나는 것이 문제였다', () => {
  const panel = codeOf(read('src/views/StudyPlanPanel.jsx'));

  it('계획표가 정본 총계와 같다 — 어긋날 수가 없어야 어긋나지 않는다', () => {
    for (const lang of ['Chinese', 'French']) {
      const L = REF_GRAMMAR_MANIFEST.languages[lang];
      const canon = L.levels.reduce((n, lv) => n + (lv.chapters || []).length, 0);
      expect(buildPlan(REF_GRAMMAR_MANIFEST, lang).totalChapters).toBe(canon);
    }
  });

  it('화면은 목표 레벨 키만 들고 있다 — 챕터 목록을 손으로 적지 않는다', () => {
    expect(panel).toContain('buildPlan(REF_GRAMMAR_MANIFEST');
    // 옛 PLAN 상수의 모양: [1, '한어병음'] — 번호+제목 쌍이 소스에 다시 나타나면 안 된다
    expect(panel).not.toMatch(/\[\s*\d+\s*,\s*['"]/);
    // 목표는 레벨 키 하나씩. 그 키는 정본에 실재해야 한다(정본이 개편되면 여기서 걸린다)
    const goals = sliceBetween(read('src/views/StudyPlanPanel.jsx'), 'const GOALS = [', '];');
    const pairs = [...goals.matchAll(/lang: '(\w+)', upto: '(\w+)'/g)];
    expect(pairs.length, '목표를 못 읽었다면 아래 대조가 통째로 헛돈다').toBe(2);
    for (const [, lang, upto] of pairs) {
      const keys = REF_GRAMMAR_MANIFEST.languages[lang].levels.map(l => l.key);
      expect(keys, `${lang}에 ${upto} 레벨이 없다`).toContain(upto);
    }
  });

  it('번호는 그 챕터로 가는 문이다 — 죽은 칩이 아니라', () => {
    expect(panel).toContain('href={c.href}');
    expect(codeOf(read('src/lib/studyPlan.js'))).toContain('`${L.base}/grammar/${c.slug}`');
  });
});

describe('§4-2 localStorage 진도 부활 금지 — 서버가 단일 진실', () => {
  const panel = codeOf(read('src/views/StudyPlanPanel.jsx'));

  it('손 체크의 흔적이 남아 있지 않다', () => {
    for (const banned of ['localStorage', 'study_plan_progress', 'toggle(']) {
      expect(panel, `${banned}가 화면에 남으면 진도가 다시 갈린다`).not.toContain(banned);
    }
    // 옛 저장 키 `myplan_zh_done` 꼴. BEM 클래스(myplan__head)와 갈리게 한 글자를 본다.
    expect(panel).not.toMatch(/myplan_[a-z]/i);
  });

  it('이미 쌓이는 것을 읽기만 한다 — 새 테이블·새 이벤트 0', () => {
    expect(panel).toContain("from('user_ref_progress')");
    expect(panel).toContain("select('lang, slug, read, passed')");
    for (const banned of ['upsert(', 'insert(', 'delete(', 'update(']) {
      expect(panel, `진도표가 ${banned}를 하면 안 된다`).not.toContain(banned);
    }
  });

  it('조회 실패를 삼키지 않는다 — 계획만 남고 진도는 모른다고 말한다', () => {
    const q = sliceBetween(read('src/views/StudyPlanPanel.jsx'), 'queryKey: [\'study-plan-progress\'', '});');
    expect(q).toContain('if (error) throw error;');
    expect(q).toContain('enabled: !!user?.id,');
    expect(panel).toContain("isError ? 'error'");
    expect(read('src/views/StudyPlanPanel.jsx')).toContain('진도를 불러오지 못했어요');
  });
});
