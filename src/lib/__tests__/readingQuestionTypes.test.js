import { describe, it, expect } from 'vitest';

// ReadingTextView 는 readingProgress → supabase.js 를 끌어와 모듈 로드 시 env 를 요구한다.
// 순수 헬퍼(채점·정규화·정규화 매핑)만 검증하므로 env 를 스텁한 뒤 동적 import.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';

const {
  arraysEqual,
  gradeOrder,
  seededShuffle,
  shuffleOrderTiles,
  normalizeFill,
  checkFill,
  splitFill,
  FILL_BLANK,
  normalizeQuestion,
} = await import('../../views/ReadingTextView');
const { buildReadingEvents } = await import('../readingProgress');

// ── order 채점 ──────────────────────────────────────────────────────────────
describe('gradeOrder — 조립 배열이 정답 순서와 완전히 일치할 때만 정답', () => {
  const answer = ['わたし', 'が', 'ミンジュン', 'です'];
  it('정답 순서 그대로면 정답', () => {
    expect(gradeOrder(['わたし', 'が', 'ミンジュン', 'です'], answer)).toBe(true);
  });
  it('순서가 다르면 오답', () => {
    expect(gradeOrder(['が', 'わたし', 'ミンジュン', 'です'], answer)).toBe(false);
  });
  it('길이가 다르면 오답', () => {
    expect(gradeOrder(['わたし', 'が', 'ミンジュン'], answer)).toBe(false);
  });
  it('arraysEqual 방어 — 비배열 입력', () => {
    expect(arraysEqual(null, answer)).toBe(false);
    expect(arraysEqual(answer, undefined)).toBe(false);
  });
  it('중복 원소도 위치까지 비교', () => {
    expect(gradeOrder(['の', 'の'], ['の', 'の'])).toBe(true);
  });
  it('fail-closed(P2-4): answer가 빈 배열이면 조립도 빈 배열이어도 무조건 오답', () => {
    // arraysEqual([], [])===true 를 그대로 두면 스키마 불충족(tiles/answer 누락)이 []/[]로
    // 정규화된 문항이 "0개 조립"만으로 자동 통과해버린다(Codex P2-4) — 이 경로를 봉쇄한다.
    expect(gradeOrder([], [])).toBe(false);
    expect(gradeOrder(['x'], [])).toBe(false);
    expect(gradeOrder(undefined, [])).toBe(false);
  });
});

// ── 결정적 셔플 · 정답 순서로 시작 금지 ──────────────────────────────────────
describe('shuffleOrderTiles — 시드 결정적 + 정답 순서로 시작 금지', () => {
  const tiles = ['わたし', 'が', 'ミンジュン', 'です'];
  const answer = tiles; // 콘텐츠 계약: tiles 는 정답 순서로 주어짐

  it('같은 시드는 항상 같은 배치(하이드레이션 불일치·재셔플 튐 방지)', () => {
    const a = shuffleOrderTiles(tiles, answer, 'n5-tokyo-01-q7');
    const b = shuffleOrderTiles(tiles, answer, 'n5-tokyo-01-q7');
    expect(a).toEqual(b);
  });

  it('셔플 결과는 정답 순서와 다르다(어느 시드든)', () => {
    for (const seed of ['q1', 'q2', 'q3', 'seed-x', 'n5-tokyo-01-q7', 'abc', 'zzz']) {
      const out = shuffleOrderTiles(tiles, answer, seed);
      expect(out).toHaveLength(tiles.length);
      expect([...out].sort()).toEqual([...tiles].sort()); // 같은 타일 집합
      expect(arraysEqual(out, answer)).toBe(false);         // 정답 순서로 시작 금지
    }
  });

  it('타일 0·1개는 섞을 여지가 없어 그대로', () => {
    expect(shuffleOrderTiles([], [], 's')).toEqual([]);
    expect(shuffleOrderTiles(['です'], ['です'], 's')).toEqual(['です']);
  });

  it('모든 타일이 같아 어긋낼 수 없으면 원본 유지(무한루프 없음)', () => {
    const same = ['の', 'の'];
    expect(shuffleOrderTiles(same, same, 's')).toEqual(['の', 'の']);
  });

  it('seededShuffle 는 원본을 변형하지 않는다', () => {
    const src = ['a', 'b', 'c'];
    seededShuffle(src, 's');
    expect(src).toEqual(['a', 'b', 'c']);
  });
});

// ── fill 정규화 · 채점 ───────────────────────────────────────────────────────
describe('normalizeFill / checkFill — 전각·공백 관용 비교', () => {
  it('앞뒤·중간 공백(半角·全角)을 무시', () => {
    expect(normalizeFill('  の ')).toBe('の');
    expect(normalizeFill('　の　')).toBe('の');
  });
  it('전각 영숫자·기호는 NFKC 로 반각 통일', () => {
    expect(normalizeFill('Ｎ５')).toBe('N5');
  });
  it('answer 와 정규화 일치면 정답', () => {
    expect(checkFill('の', 'の')).toBe(true);
    expect(checkFill(' の ', 'の')).toBe(true);
    expect(checkFill('　の', 'の')).toBe(true);
  });
  it('accept 대안 중 하나와 맞으면 정답', () => {
    expect(checkFill('なに', '何', ['何', 'なに', 'なん'])).toBe(true);
    expect(checkFill('なん', '何', ['何', 'なに', 'なん'])).toBe(true);
  });
  it('틀린 입력·빈 입력은 오답', () => {
    expect(checkFill('は', 'の')).toBe(false);
    expect(checkFill('', 'の')).toBe(false);
    expect(checkFill('   ', 'の')).toBe(false);
  });
});

describe('splitFill — 빈칸 마커 기준 앞/뒤 분리', () => {
  it('전각 대괄호 마커를 앞·뒤로 가른다', () => {
    expect(splitFill(`かぞく${FILL_BLANK}旅行です。`)).toEqual({ before: 'かぞく', after: '旅行です。' });
  });
  it('마커가 없으면 통째로 before', () => {
    expect(splitFill('旅行です。')).toEqual({ before: '旅行です。', after: '' });
  });
});

// ── normalizeQuestion — 신유형·기존 하위호환 매핑 ────────────────────────────
describe('normalizeQuestion — 유형별 gating·itemKey 매핑', () => {
  it('order: gating true · itemKey=문형 · tiles/answerTiles/ko 실림', () => {
    const n = normalizeQuestion(
      { id: 'q1', type: 'order', pattern: '〜が', q: '문장을 만드세요', tiles: ['わたし', 'が', 'です'], answer: ['わたし', 'が', 'です'], ko: '제가 ~입니다', why: 'W' },
      'k1'
    );
    expect(n.qtype).toBe('order');
    expect(n.gating).toBe(true);
    expect(n.itemKey).toBe('〜が');
    expect(n.answerTiles).toEqual(['わたし', 'が', 'です']);
    expect(n.ko).toBe('제가 ~입니다');
  });

  it('fill: gating true · itemKey=문형 · fillAnswer/accept 실림', () => {
    const n = normalizeQuestion(
      { id: 'q2', type: 'fill', pattern: '〜の', q: '빈칸', ja: `かぞく${FILL_BLANK}旅行です。`, answer: 'の', accept: ['の'], why: 'W' },
      'k2'
    );
    expect(n.qtype).toBe('fill');
    expect(n.gating).toBe(true);
    expect(n.itemKey).toBe('〜の');
    expect(n.fillAnswer).toBe('の');
    expect(n.accept).toEqual(['の']);
  });

  it('produce: 비게이트 · itemKey null · model/guide 실림', () => {
    const n = normalizeQuestion(
      { id: 'q3', type: 'produce', prompt: '자기소개를 해보세요', model: ['わたしは ミンジュンです。'], guide: '이름을 넣어요' },
      'k3'
    );
    expect(n.qtype).toBe('produce');
    expect(n.gating).toBe(false);
    expect(n.itemKey).toBeNull();
    expect(n.model).toEqual(['わたしは ミンジュンです。']);
    expect(n.guide).toBe('이름을 넣어요');
  });

  it('pattern: gating true · itemKey=문형 · answerText 는 choices[answer]', () => {
    const n = normalizeQuestion(
      { id: 'q4', type: 'pattern', pattern: '〜です', q: 'Q', choices: ['A', 'B'], answer: 1, why: 'W' },
      'k4'
    );
    expect(n.qtype).toBe('pattern');
    expect(n.gating).toBe(true);
    expect(n.itemKey).toBe('〜です');
    expect(n.answerText).toBe('B');
  });

  it('content(기본): 비게이트 · itemKey content', () => {
    const n = normalizeQuestion({ id: 'q5', type: 'content', q: 'Q', choices: ['A', 'B'], answer: 0 }, 'k5');
    expect(n.qtype).toBe('content');
    expect(n.gating).toBe(false);
    expect(n.itemKey).toBe('content');
    expect(n.answerText).toBe('A');
  });

  // ── fail-closed(P2-4): 스키마 불충족 order/fill을 []/[]로 조용히 통과시키지 않고
  // qtype:'error'로 갈라낸다 — gating:true인 채 채점 경로가 없어 게이트를 영구히 막는다.
  describe('스키마 불충족 order/fill → qtype:error (fail-closed, P2-4)', () => {
    it('order: tiles 누락', () => {
      const n = normalizeQuestion({ id: 'q6', type: 'order', pattern: '〜が', q: 'Q', answer: ['a'] }, 'k6');
      expect(n.qtype).toBe('error');
      expect(n.gating).toBe(true);
    });
    it('order: tiles 빈 배열', () => {
      const n = normalizeQuestion({ id: 'q7', type: 'order', pattern: '〜が', q: 'Q', tiles: [], answer: [] }, 'k7');
      expect(n.qtype).toBe('error');
      expect(n.gating).toBe(true);
    });
    it('order: tiles/answer에 비문자열 원소', () => {
      const n = normalizeQuestion(
        { id: 'q8', type: 'order', pattern: '〜が', q: 'Q', tiles: ['a', {}], answer: ['a', {}] },
        'k8'
      );
      expect(n.qtype).toBe('error');
    });
    it('order: tiles/answer에 빈 문자열 원소', () => {
      const n = normalizeQuestion(
        { id: 'q9', type: 'order', pattern: '〜が', q: 'Q', tiles: ['a', ''], answer: ['a', ''] },
        'k9'
      );
      expect(n.qtype).toBe('error');
    });
    it('fill: 빈칸 마커 없음', () => {
      const n = normalizeQuestion({ id: 'q10', type: 'fill', pattern: '〜の', q: 'Q', ja: '文です。', answer: 'の' }, 'k10');
      expect(n.qtype).toBe('error');
      expect(n.gating).toBe(true);
    });
    it('fill: answer 비어있음', () => {
      const n = normalizeQuestion(
        { id: 'q11', type: 'fill', pattern: '〜の', q: 'Q', ja: `文${FILL_BLANK}です。`, answer: '' },
        'k11'
      );
      expect(n.qtype).toBe('error');
    });

    // ── P2-8: fill accept 원소 런타임 검증(빌드 게이트와 대칭) ──
    // accept:[{}] 처럼 비문자열 원소가 섞이면 이전엔 fill 로 그대로 정규화됐고, checkFill 이
    // normalizeFill({}) → "[object Object]" 문자열과 사용자 입력을 비교해 그 문자열을 그대로
    // 입력하면 정답 처리되는 경로가 열려 있었다(Codex 재현). 이제 qtype:'error'로 갈라져 그
    // 경로(accept·fillAnswer 필드·checkFill 호출) 자체에 도달하지 않는다.
    it('fill: accept에 비문자열 원소({}) — [object Object] 입력이 정답 처리되던 경로 봉쇄', () => {
      const badQ = { id: 'q12', type: 'fill', pattern: '〜の', q: 'Q', ja: `文${FILL_BLANK}です。`, answer: 'の', accept: [{}] };
      const n = normalizeQuestion(badQ, 'k12');
      expect(n.qtype).toBe('error');
      expect(n.gating).toBe(true);
      // 봉쇄 확인: error 문항은 accept/fillAnswer 필드 자체가 없어 checkFill 채점 경로에 도달하지 않는다.
      expect(n.accept).toBeUndefined();
      expect(n.fillAnswer).toBeUndefined();
    });
    it('fill: accept에 빈 문자열 원소', () => {
      const n = normalizeQuestion(
        { id: 'q13', type: 'fill', pattern: '〜の', q: 'Q', ja: `文${FILL_BLANK}です。`, answer: 'の', accept: ['の', ''] },
        'k13'
      );
      expect(n.qtype).toBe('error');
    });
    it('fill: accept가 배열이 아님(단일 값)', () => {
      const n = normalizeQuestion(
        { id: 'q14', type: 'fill', pattern: '〜の', q: 'Q', ja: `文${FILL_BLANK}です。`, answer: 'の', accept: 'の' },
        'k14'
      );
      expect(n.qtype).toBe('error');
    });
    it('fill: accept 원소가 전부 유효한 문자열이면 정상 fill로 정규화(회귀 방지)', () => {
      const n = normalizeQuestion(
        { id: 'q15', type: 'fill', pattern: '〜の', q: 'Q', ja: `文${FILL_BLANK}です。`, answer: 'の', accept: ['の', 'ノ'] },
        'k15'
      );
      expect(n.qtype).toBe('fill');
      expect(n.accept).toEqual(['の', 'ノ']);
    });
  });
});

// ── 이벤트 계약 — 신유형 qtype 수용(order·fill 발행, produce 미발행) ──────────
describe('buildReadingEvents — order·fill 은 문형 키로 발행, produce 는 미발행', () => {
  it('order·fill 은 item_key=문형 · detail.qtype 로 유형 구분(pattern 과 같은 키 규약)', () => {
    const events = buildReadingEvents('n5-tokyo-01', [
      { itemKey: '〜が', qtype: 'order', firstOk: false, tries: 2, index: 0 },
      { itemKey: '〜の', qtype: 'fill', firstOk: true, tries: 1, index: 1 },
    ]);
    expect(events.map((e) => e.item_key)).toEqual(['〜が', '〜の']);
    expect(events.map((e) => e.detail.qtype)).toEqual(['order', 'fill']);
    expect(events[0].correct).toBe(false); // 최초 시도 오답 보존
    expect(events[1].correct).toBe(true);
    expect(events.every((e) => e.detail.text_id === 'n5-tokyo-01')).toBe(true);
  });

  it('produce 는 응답(tries>0)이 실려도 이벤트를 내지 않는다(비게이트)', () => {
    const events = buildReadingEvents('n5-tokyo-01', [
      { itemKey: null, qtype: 'produce', firstOk: false, tries: 1, index: 0 },
      { itemKey: '〜が', qtype: 'order', firstOk: true, tries: 1, index: 1 },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].detail.qtype).toBe('order');
    // produce 는 correct:null 로도 남지 않는다 — 아예 미발행
    expect(events.some((e) => e.detail.qtype === 'produce')).toBe(false);
  });

  it('같은 문형이면 order·fill·pattern 이 한 키로 합류(약점 신호 통합)', () => {
    const events = buildReadingEvents('n5-tokyo-01', [
      { itemKey: '〜が', qtype: 'pattern', firstOk: true, tries: 1, index: 0 },
      { itemKey: '〜が', qtype: 'order', firstOk: false, tries: 2, index: 1 },
      { itemKey: '〜が', qtype: 'fill', firstOk: true, tries: 1, index: 2 },
    ]);
    expect(events.map((e) => e.item_key)).toEqual(['〜が', '〜が', '〜が']);
  });
});
