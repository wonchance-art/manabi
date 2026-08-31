import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import {
  PATTERN_FILTERS, dueChapterSet, filterNote, filterScan, hitIsMarked, orderPatternsByMark,
} from '../patternIndex.js';
import { weakChapterSet } from '../weaknessProfile.js';

/**
 * 계약: v2-G R2 문법 표시 필터 (#1077 설계 §4).
 *
 * R1은 정본 484문형을 전부 후보로 잡는다 — "본문에서 문법을 만난다"는 되지만
 * **무엇부터 볼지**는 여전히 독자 몫이었다. 복습이 다가온 문법을 본문에서 다시
 * 만나면 그 자체가 복습이 되므로, 이미 쌓이고 있는 grammar_review 큐를 읽기만 한다.
 * 새 테이블·새 이벤트·마이그레이션 0.
 *
 * 설계 §4의 '약한 것'은 v2-A R1이 끝난 뒤 합류했다 — 정본은 여전히 v2-A 소유이고
 * 이 층은 챕터 집합만 받아 쓴다(아래 마지막 describe가 그 경계를 지킨다).
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
/** 주석 제거 후 대조 — 설명 문구가 계약에 잡히지 않게(v2-L 자기함정 클래스). */
const codeOf = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const NOW = Date.parse('2026-08-31T12:00:00+09:00');
const AGO = new Date(NOW - 86400000).toISOString();
const SOON = new Date(NOW + 86400000).toISOString();

/** scanTokens 산출 흉내 — 표지 하나가 문형 여럿을 가리키는 구조 그대로. */
const hit = (kernel, tokenIds, chs) => ({
  kernel,
  tokenIds,
  patterns: chs.map((ch, i) => ({ id: `${kernel}-${i}`, level: 'H3', pattern: kernel, ch })),
});
const scanOf = (...hits) => ({
  hits,
  byToken: new Map(hits.flatMap((h) => h.tokenIds.map((id) => [id, h]))),
});

describe('§4 due 판정 — 이미 쌓이고 있는 큐를 그대로 읽는다', () => {
  it('예정 시각이 지난 챕터만 든다 — 미래 예정을 넣으면 "복습할 것"이 전체와 같아진다', () => {
    const due = dueChapterSet([
      { slug: 'ba-sentence', next_review_at: AGO },
      { slug: 'bei-passive', next_review_at: SOON },
    ], { now: NOW });
    expect([...due]).toEqual(['ba-sentence']);
  });

  it('예정 시각이 없는 행은 지금으로 친다 — 큐에 갓 들어온 것을 숨기면 영영 안 나온다', () => {
    expect(dueChapterSet([{ slug: 'a', next_review_at: null }], { now: NOW }).has('a')).toBe(true);
  });

  it('망가진 시각은 뺀다 — 파싱 실패를 due로 치면 전체가 복습 대상이 된다', () => {
    expect(dueChapterSet([{ slug: 'a', next_review_at: '어제쯤' }], { now: NOW }).size).toBe(0);
  });

  it('slug 없는 행·빈 입력은 조용히 버린다', () => {
    expect(dueChapterSet([{ next_review_at: AGO }, null], { now: NOW }).size).toBe(0);
    expect(dueChapterSet(null).size).toBe(0);
    expect(dueChapterSet(undefined).size).toBe(0);
  });

  it('rt:·drill: 같은 남의 큐 행은 챕터 slug와 안 맞아 저절로 떨어진다', () => {
    // grammar_review는 독해 글(rt:)·드릴(drill:)도 같은 테이블에 담는다. 걸러 낼 특별
    // 규칙을 두지 않는 게 맞다 — 문형의 ch와 대조하는 순간 알아서 안 맞는다.
    const due = dueChapterSet([{ slug: 'rt:asakusa', next_review_at: AGO }], { now: NOW });
    expect(hitIsMarked(hit('把', ['t0'], ['ba-sentence']), due)).toBe(false);
  });
});

describe('§4 표지 판정 — 문형 하나라도 표식이 붙으면 그 표지를 본다', () => {
  it('여러 문형 중 하나만 예정이어도 잡는다 — 把는 14문형이고 그중 하나가 오늘이다', () => {
    expect(hitIsMarked(hit('把', ['t0'], ['x', 'ba-sentence']), new Set(['ba-sentence']))).toBe(true);
  });

  it('예정이 하나도 없으면 안 잡는다', () => {
    expect(hitIsMarked(hit('把', ['t0'], ['x', 'y']), new Set(['ba-sentence']))).toBe(false);
  });

  it('정본에 없어 ch가 지워진 문형은 세지 않는다 — 링크도 없는 자리를 복습이라 할 수 없다', () => {
    // R1 계약: 정본 slug가 아니면 ch·href가 null이 되고 문형 자체는 남는다.
    expect(hitIsMarked(hit('把', ['t0'], [null]), new Set(['ba-sentence']))).toBe(false);
  });

  it('큐가 비면 아무것도 due가 아니다 — 빈 집합이 전체 통과로 뒤집히면 필터가 거짓말한다', () => {
    expect(hitIsMarked(hit('把', ['t0'], ['ba-sentence']), new Set())).toBe(false);
    expect(hitIsMarked(hit('把', ['t0'], ['ba-sentence']), null)).toBe(false);
  });
});

describe('§4 필터 — 산출을 거른다(인덱스는 자료 사이에서 공유된다)', () => {
  const scan = scanOf(hit('把', ['t0'], ['ba-sentence']), hit('被', ['t1', 't2'], ['bei-passive']));
  const due = new Set(['bei-passive']);

  it("'전체'는 원본을 그대로 돌려준다 — 기본 경로에 복사 비용을 얹지 않는다", () => {
    expect(filterScan(scan, { mode: 'all', dueSlugs: due })).toBe(scan);
    expect(filterScan(scan)).toBe(scan);
  });

  it("'복습할 것'은 예정인 표지만 남긴다", () => {
    const out = filterScan(scan, { mode: 'due', dueSlugs: due });
    expect(out.hits.map((h) => h.kernel)).toEqual(['被']);
  });

  it('byToken도 함께 좁아진다 — 밑줄과 카드가 어긋나면 탭했을 때 아무 일도 안 일어난다', () => {
    const out = filterScan(scan, { mode: 'due', dueSlugs: due });
    expect(out.byToken.has('t0')).toBe(false);
    expect(out.byToken.get('t1')?.kernel).toBe('被');
    expect(out.byToken.get('t2')?.kernel).toBe('被');
  });

  it('원본 스캔은 그대로다 — 필터를 껐다 켜면 전체가 돌아와야 한다', () => {
    filterScan(scan, { mode: 'due', dueSlugs: due });
    expect(scan.hits).toHaveLength(2);
    expect(scan.byToken.size).toBe(3);
  });

  it("'약한 것'은 약점 집합으로 좁힌다 — due 집합을 대신 쓰면 두 필터가 같은 걸 보여 준다", () => {
    const weak = new Set(['ba-sentence']);
    const out = filterScan(scan, { mode: 'weak', dueSlugs: due, weakSlugs: weak });
    expect(out.hits.map((h) => h.kernel)).toEqual(['把']);   // due(被)가 아니라 weak(把)
    expect(out.byToken.has('t0')).toBe(true);
    expect(out.byToken.has('t1')).toBe(false);
  });

  it("'약한 것'인데 집합이 없으면 아무것도 안 보인다 — 조용히 전체로 새면 필터가 거짓말이다", () => {
    expect(filterScan(scan, { mode: 'weak', dueSlugs: due }).hits).toEqual([]);
    expect(filterScan(scan, { mode: 'weak', weakSlugs: new Set() }).hits).toEqual([]);
  });

  it('모르는 모드는 전체로 수렴한다 — 저장된 옛 값이 화면을 비우면 안 된다(v2-M 결)', () => {
    expect(filterScan(scan, { mode: 'zzz', dueSlugs: due })).toBe(scan);
  });

  it('스캔이 없으면 빈 결과 — 렌더가 옵셔널 체이닝 없이도 안 깨진다', () => {
    const out = filterScan(null, { mode: 'due', dueSlugs: due });
    expect(out.hits).toEqual([]);
    expect(out.byToken.size).toBe(0);
  });
});

describe('§4 카드 정렬 — 잘리는 자리가 3개뿐이라 순서가 곧 노출이다', () => {
  const patterns = [
    { id: 'a', ch: 'x' }, { id: 'b', ch: 'ba-sentence' }, { id: 'c', ch: 'y' },
    { id: 'd', ch: 'bei-passive' },
  ];

  it('복습 예정이 앞으로 온다 — 把 14문형 중 7번째가 오늘이면 카드에서 안 보인다', () => {
    const out = orderPatternsByMark(patterns, new Set(['ba-sentence', 'bei-passive']));
    expect(out.map((p) => p.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('덩이 안에서는 정본 순서(레벨→등장)를 보존한다', () => {
    expect(orderPatternsByMark(patterns, new Set(['x'])).map((p) => p.id))
      .toEqual(['a', 'b', 'c', 'd']);
  });

  it('큐가 없으면 정본 순서 그대로 — 비로그인·전체 모드에서 순서가 흔들리면 안 된다', () => {
    expect(orderPatternsByMark(patterns, null).map((p) => p.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(orderPatternsByMark(patterns, new Set()).map((p) => p.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('언제나 새 배열을 돌려준다 — hit.patterns는 인덱스가 자료마다 재사용하는 통이다', () => {
    // 카드가 받은 배열을 잘라 쓰므로, 정렬할 게 없다고 원본을 그대로 돌려주면
    // 언젠가 그 통을 건드리는 호출자가 인덱스를 오염시킨다.
    expect(orderPatternsByMark(patterns, null)).not.toBe(patterns);
    expect(orderPatternsByMark(patterns, new Set())).not.toBe(patterns);
    const src = [...patterns];
    orderPatternsByMark(patterns, new Set(['bei-passive']));
    expect(patterns).toEqual(src);
    expect(orderPatternsByMark(null, new Set())).toEqual([]);
  });
});

describe('§4 빈 상태 — 밑줄 없는 화면은 "고장"으로 읽힌다(v2-K)', () => {
  const note = (o) => filterNote({ mode: 'due', ...o });

  it('비로그인은 큐가 없어서라고 말한다 — 로그인이 조건이라는 걸 화면이 알려야 한다', () => {
    expect(note({ signedIn: false })).toMatch(/로그인/);
  });

  it('읽는 중과 "없음"을 구별한다 — 로딩을 "없음"으로 말하면 즉시 전체로 되돌린다', () => {
    expect(note({ signedIn: true, loading: true })).toMatch(/읽는 중/);
  });

  it('큐가 빈 것과 이 자료에 안 나오는 것을 구별한다 — 다음 행동이 다르다', () => {
    const empty = note({ signedIn: true, markedCount: 0, hitCount: 0 });
    const noHit = note({ signedIn: true, markedCount: 3, hitCount: 0 });
    expect(empty).not.toBe(noHit);
    expect(empty).toMatch(/전체/);        // 되돌아갈 길을 준다
    expect(noHit).toMatch(/이 자료/);
  });

  it('그릴 게 있으면 아무 말도 안 한다 — 할 말 없을 때 하는 말이 화면을 어지럽힌다', () => {
    expect(note({ signedIn: true, markedCount: 3, hitCount: 2 })).toBeNull();
    expect(filterNote({ mode: 'all', signedIn: true })).toBeNull();
  });

  it("'약한 것'의 빈 사유는 '복습할 것'과 다르다 — 기록이 없는 것과 큐가 빈 것은 다른 일이다", () => {
    const weak = filterNote({ mode: 'weak', signedIn: true, markedCount: 0, hitCount: 0 });
    const due = filterNote({ mode: 'due', signedIn: true, markedCount: 0, hitCount: 0 });
    expect(weak).not.toBe(due);
    // "약점이 없다"고 말하면 거짓말이다 — 오답이 쌓여야 약점이 선다.
    expect(weak).toMatch(/기록이 없어요/);
    expect(weak).toMatch(/전체/);
    expect(filterNote({ mode: 'weak', signedIn: false })).toMatch(/자주 틀린/);
  });
});

describe('§5 이음새 신설 0 — 읽기만 하고, 좁힐 때만 읽는다', () => {
  it('순수 모듈이 서버를 모른다 — 필터도 R1과 같은 층에 있다', () => {
    const src = codeOf(read('src/lib/patternIndex.js'));
    for (const banned of ['supabase', 'insert(', 'upsert(', 'fetch(']) {
      expect(src, `표지 필터가 ${banned}를 알면 안 된다`).not.toContain(banned);
    }
  });

  it('조회는 이미 있는 복습 큐 하나만 읽는다 — 쓰기도 새 테이블도 없다', () => {
    const rows = codeOf(read('src/lib/patternRows.js'));
    expect(rows).toContain("from('grammar_review')");
    expect(rows).toContain("select('slug, next_review_at')");
    for (const banned of ['insert(', 'upsert(', 'update(', 'delete(']) {
      expect(rows, `필터 재료 조회가 ${banned}를 하면 안 된다`).not.toContain(banned);
    }
    // 실패는 빈 배열 — 필터가 아무것도 못 고를 뿐 본문 읽기는 그대로 돈다
    expect(rows).toMatch(/catch \{\s*return \[\];\s*\}/);
  });

  it("'전체'로 보는 사람에게는 두 조회 다 안 태운다", () => {
    const viewer = codeOf(read('src/views/ViewerPage.jsx'));
    const on = sliceBetween(viewer, 'const patternOn =', ';');
    expect(on).toContain('showPatterns');
    expect(on).toContain('supportsPatterns(materialLang)');
    expect(sliceBetween(viewer, 'const patternDueOn =', ';')).toContain("patternFilter === 'due'");
    expect(sliceBetween(viewer, 'const patternWeakOn =', ';')).toContain("patternFilter === 'weak'");
    const due = sliceBetween(viewer, "queryKey: ['pattern-due'", '});');
    expect(due).toContain('enabled: !!user && patternDueOn,');
    expect(due).toContain('fetchDuePatternRows(user.id, materialLang)');
    const weak = sliceBetween(viewer, "queryKey: ['pattern-weak'", '});');
    expect(weak).toContain('enabled: !!user && patternWeakOn,');
    // 약점 재료 조회는 v2-A 것을 그대로 쓴다 — 같은 재료에 조회를 두 벌 파지 않는다.
    expect(weak).toContain('fetchWeaknessRows(user.id)');
  });

  it('조회가 자른 시각을 순수 함수가 다시 자른다 — 뷰어는 오래 열려 있다', () => {
    const viewer = codeOf(read('src/views/ViewerPage.jsx'));
    expect(viewer).toContain('dueChapterSet(dueRows || [])');
  });
});

describe('배선 — 필터를 우회할 길이 없다', () => {
  const viewer = codeOf(read('src/views/ViewerPage.jsx'));

  it('렌더가 읽는 산출은 필터를 통과한 것 하나뿐 — 원본을 직접 그리면 필터가 무의미하다', () => {
    expect(viewer).toContain('filterScan(patternScan, { mode: patternFilter, dueSlugs, weakSlugs })');
    // 원본 스캔의 조회면(byToken)에는 아무도 손대지 않는다 — 렌더는 visibleScan만 본다.
    expect(viewer).not.toContain('patternScan?.byToken');
    expect(viewer).not.toContain('patternScan.byToken');
  });

  it('기본은 전체 — 없던 필터가 켜진 채로 나타나면 밑줄이 사라진 것처럼 보인다', () => {
    const s = read('src/lib/useViewerSettings.js');
    expect(s).toContain("readPref('patternFilter', 'all')");
    // 모르는 값이 저장돼 있어도 전체로 수렴한다(v2-M 입력 관용성 결)
    expect(s).toContain("return PATTERN_FILTERS.includes(v) ? v : 'all';");
  });

  it('세그먼트는 문법 표시를 켠 지원 언어에서만 — 끄면 고를 것이 없다', () => {
    // R3에서 지원 언어가 둘(중국어·일본어)로 늘었다 — 게이트는 한 곳(supportsPatterns)이 정한다.
    expect(viewer).toContain('{supportsPatterns(materialLang) && showPatterns && (');
    expect(viewer).toContain('aria-label="문법 표시 범위"');
    expect(viewer).toContain("onClick={() => setPatternFilter('all')}>전체<");
    expect(viewer).toContain("onClick={() => setPatternFilter('due')}>복습할 것<");
  });

  it('카드의 두 표식은 그 집합을 읽었을 때만 — 전체 모드·비로그인에는 아무 표시도 없다', () => {
    const pc = read('src/components/PatternCard.jsx');
    expect(pc).toContain('dueSlugs?.has(p.ch)');
    expect(pc).toContain('weakSlugs?.has(p.ch)');
    expect(viewer).toContain('dueSlugs = useMemo(() => (patternDueOn ? dueChapterSet');
    expect(viewer).toContain('weakSlugs = useMemo(');
    expect(viewer).toContain('patternWeakOn ? weakChapterSet(weakRows || []) : null');
  });

  it('정렬은 두 축을 합쳐서 민다 — 한 축만 밀면 다른 축이 3개 뒤로 잘려 나간다', () => {
    const pc = read('src/components/PatternCard.jsx');
    expect(pc).toContain('orderPatternsByMark(hit?.patterns, marked)');
    expect(pc).toContain('new Set([...(dueSlugs || []), ...(weakSlugs || [])])');
  });

  it("복습 표식의 색 어휘가 단어 복습 알약과 같다 — 같은 뜻에 다른 색이면 두 번 배운다", () => {
    const css = read('src/index.css');
    const pill = sliceBetween(css, '.pattern-card__due {', '}');
    const vocab = sliceBetween(css, '.vocab-row__due {', '}');
    expect(pill).toContain('color: var(--warning);');
    expect(vocab).toContain('color: var(--warning);');
    expect(pill).toContain('color-mix(in srgb, var(--warning-bright) 16%, transparent)');
  });
});

describe("§4 '약한 것' 합류 — 정본은 v2-A가 갖고 이 층은 집합만 받는다", () => {
  it('설계의 3분할이 다 찼다', () => {
    expect(PATTERN_FILTERS).toEqual(['all', 'due', 'weak']);
  });

  it('스캔 층은 여전히 약점을 계산하지 않는다 — 흉내 내면 두 축의 정본이 갈린다', () => {
    // G R2가 걸어 둔 경계를 합류 뒤에도 지킨다. 달라진 건 하나뿐: 이 층이 이제
    // **집합을 받는다**. 오답 이벤트·점수식·집계 창은 여전히 v2-A 소유다.
    for (const f of ['src/lib/patternIndex.js', 'src/lib/patternRows.js']) {
      const src = codeOf(read(f));
      for (const banned of ['weaknessProfile', 'errorTag', 'review_events', 'computeWeakness', 'correct']) {
        expect(src, `${f}가 ${banned}를 알면 v2-A와 정본이 갈린다`).not.toContain(banned);
      }
    }
  });

  it('약점 집합은 v2-A 모듈이 낸다 — 뷰어가 태그를 직접 파싱하지 않는다', () => {
    const viewer = codeOf(read('src/views/ViewerPage.jsx'));
    expect(viewer).toContain("import { weakChapterSet } from '../lib/weaknessProfile'");
    expect(viewer, '화면이 태그 문자열을 뜯으면 태그 규약이 두 곳에 생긴다')
      .not.toContain("'pattern:'");
  });

  it('약점 집합은 문법 축만 담는다 — 회상 방식 축이 챕터 slug 자리에 새면 안 된다', () => {
    const now = Date.parse('2026-08-31T12:00:00+09:00');
    const e = (src, key, correct) => ({
      source: src, item_key: key, correct,
      created_at: new Date(now - 86400000).toISOString(), detail: { qtype: 'typing' },
    });
    const weak = weakChapterSet([
      e('grammar', 'ba-sentence', false), e('grammar', 'ba-sentence', false),
      e('vocab', '书', false), e('vocab', '书', false),
    ], { now });
    expect([...weak]).toEqual(['ba-sentence']);
    // retrieval:typing은 둘 다에 붙지만 챕터가 아니므로 들어오면 안 된다
    expect(weak.has('typing')).toBe(false);
    expect(weak.has('retrieval:typing')).toBe(false);
    expect(weak.has('书')).toBe(false);
  });

  it('상한이 없다 — "상위 8개"로 자르면 9번째 약점이 눈앞에 있어도 밑줄이 안 붙는다', () => {
    const src = codeOf(read('src/lib/weaknessProfile.js'));
    expect(sliceBetween(src, 'export function weakChapterSet(', '\n}')).toContain('cap: 0');
  });
});
