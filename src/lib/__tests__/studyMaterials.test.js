import { describe, it, expect, vi } from 'vitest';

// studyMaterials.js는 @/ 별칭으로 뷰·콘텐츠 모듈을 끌어온다(vitest엔 별칭·DOM 없음).
// deriveVocabRungs가 실제로 쓰는 건 skillRung.computeRung 뿐이라, 그것만 실물로 두고 나머진 목.
vi.mock('@/lib/skillRung', async () => await vi.importActual('../skillRung'));
vi.mock('@/content/refLangs', () => ({ getRefLang: () => ({}) }));
vi.mock('@/views/refShared', () => ({ refMain: () => '', refPron: () => '' }));
vi.mock('@/lib/refQuiz', () => ({ buildChapterQuiz: () => ({}) }));
vi.mock('@/lib/studySession', () => ({ composeSession: () => ({}), buildWarmupItems: () => [] }));
vi.mock('@/lib/writingPrompts', () => ({ levelBand: () => null }));
vi.mock('@/lib/studyParagraph', () => ({ THEMES: [] }));

const { deriveVocabRungs, gateNewMaterialsByDial, pickTheme, deriveColdStart, deriveArc, INTEREST_GROUPS } = await import('../studyMaterials');

// review_events 행 헬퍼 (시간 오름차순으로 넘긴다)
const ev = (source, item_key, correct, qtype = 'choice') => ({
  source, item_key, correct, detail: { qtype },
});

describe('deriveVocabRungs', () => {
  it('vocab 소스 이벤트만으로 rung을 유도한다 (choice 2연속 → 2)', () => {
    const eventsAsc = [
      ev('vocab', '猫', true),
      ev('vocab', '猫', true),
    ];
    const rungs = deriveVocabRungs(eventsAsc, [{ word_text: '猫' }]);
    expect(rungs['猫']).toBe(2);
  });

  it('같은 item_key라도 타 소스(grammar/reading) 이벤트는 rung에 섞이지 않는다', () => {
    // vocab 정답 2연속으로 rung 2를 만든 뒤, 같은 item_key의 grammar 오답 2건을 덧붙인다.
    // source 필터가 없으면 강등되어 1이 되지만, 필터가 있으면 2로 유지되어야 한다.
    const eventsAsc = [
      ev('vocab', '猫', true),
      ev('vocab', '猫', true),
      ev('grammar', '猫', false),
      ev('reading', '猫', false),
    ];
    const rungs = deriveVocabRungs(eventsAsc, [{ word_text: '猫' }]);
    expect(rungs['猫']).toBe(2);
  });

  it('이벤트가 없으면 rung 0', () => {
    const rungs = deriveVocabRungs([], [{ word_text: '犬' }]);
    expect(rungs['犬']).toBe(0);
  });

  it('빈/누락 입력에 방어적', () => {
    expect(deriveVocabRungs(undefined, undefined)).toEqual({});
    expect(deriveVocabRungs([ev('vocab', '猫', true)], [])).toEqual({});
  });
});

describe('gateNewMaterialsByDial', () => {
  const newPattern = { pattern: '～ます', patternKo: '~합니다' };
  const newWords = [{ word: '猫', meaning: '고양이', pron: 'ねこ' }];

  it("dial 'easy'면 신규 패턴·단어를 비운다 (과부하 방어)", () => {
    expect(gateNewMaterialsByDial('easy', newPattern, newWords)).toEqual({ newPattern: null, newWords: [] });
  });

  it("dial 'normal'/'hard'면 신규 재료를 그대로 통과시킨다", () => {
    expect(gateNewMaterialsByDial('normal', newPattern, newWords)).toEqual({ newPattern, newWords });
    expect(gateNewMaterialsByDial('hard', newPattern, newWords)).toEqual({ newPattern, newWords });
  });
});

describe('INTEREST_GROUPS 매핑', () => {
  const THEMES = ['일상', '학교', '여행', '음식', '쇼핑', '날씨와 계절', '가족과 친구', '취미', '감정', '계획'];

  it('4개 그룹이고 그룹 키가 예상대로다', () => {
    expect(Object.keys(INTEREST_GROUPS)).toEqual(['daily', 'travel', 'food', 'work']);
  });

  it('그룹 테마 합집합이 THEMES 전체를 정확히 덮는다(중복·누락 없음)', () => {
    const mapped = Object.values(INTEREST_GROUPS).flatMap(g => g.themes);
    expect(mapped.slice().sort()).toEqual(THEMES.slice().sort());
    expect(new Set(mapped).size).toBe(THEMES.length); // 중복 없음
  });

  it('모든 그룹 테마가 실제 THEMES 안에 있다', () => {
    for (const g of Object.values(INTEREST_GROUPS)) {
      for (const t of g.themes) expect(THEMES).toContain(t);
    }
  });
});

describe('pickTheme', () => {
  const THEMES = ['일상', '학교', '여행', '음식', '쇼핑', '날씨와 계절', '가족과 친구', '취미', '감정', '계획'];

  it('관심사 없으면 최근 회피 후 전체에서 고른다(기존 로테이션)', () => {
    // rnd=()=>0 → 회피 후 풀의 첫 항목
    const t = pickTheme(THEMES, ['일상'], null, () => 0);
    expect(t).toBe('학교');           // '일상' 회피 → 남은 풀 첫 항목
    expect(t).not.toBe('일상');
  });

  it('관심사가 있고 난수 < 0.7이면 그 그룹 테마에서 고른다(70% 가중)', () => {
    // rnd=()=>0.1 (<0.7) → 그룹 경로, index=floor(0.1*len)=0 → travel 그룹 첫 항목
    const t = pickTheme(THEMES, [], 'travel', () => 0.1);
    expect(INTEREST_GROUPS.travel.themes).toContain(t);
    expect(t).toBe('여행');
  });

  it('관심사가 있어도 난수 >= 0.7이면 전체 로테이션에서 고른다(나머지 30%)', () => {
    // rnd=()=>0.95 (>=0.7) → 일반 경로, index=floor(0.95*10)=9 → 전체 마지막
    const t = pickTheme(THEMES, [], 'travel', () => 0.95);
    expect(t).toBe('계획');
  });

  it('그룹 테마가 전부 최근 회피면 그룹 전체로 폴백해 여전히 그룹 안에서 고른다', () => {
    const t = pickTheme(THEMES, INTEREST_GROUPS.travel.themes, 'travel', () => 0.1);
    expect(INTEREST_GROUPS.travel.themes).toContain(t);
  });

  it('미매핑 그룹키는 무시하고 일반 로테이션', () => {
    const t = pickTheme(THEMES, [], 'unknown', () => 0);
    expect(t).toBe('일상');
  });

  it('빈 입력에 방어적(null)', () => {
    expect(pickTheme([], [], 'daily', () => 0)).toBe(null);
    expect(pickTheme(undefined, undefined, null, () => 0)).toBe(null);
  });
});

describe('deriveArc', () => {
  const NOW = Date.UTC(2026, 6, 3, 0, 0, 0);
  const row = (arcSummary, episode, agoMs = 0) => ({
    paragraph: arcSummary === undefined ? {} : { arcSummary },
    materials: episode === undefined ? {} : { episode },
    used_at: new Date(NOW - agoMs).toISOString(),
  });

  it('arcSummary 있고 7일 이내·10화 미만이면 다음 화로 이어간다', () => {
    const arc = deriveArc(row('유나가 카페에서 하루토를 만났다.', 2, 2 * 86400000), { now: NOW });
    expect(arc).toEqual({ prevArc: '유나가 카페에서 하루토를 만났다.', episode: 3 });
  });

  it('episode 부재(첫 화)는 1화로 간주 → 다음은 2화', () => {
    const arc = deriveArc(row('유나가 산책을 나섰다.', undefined, 0), { now: NOW });
    expect(arc).toEqual({ prevArc: '유나가 산책을 나섰다.', episode: 2 });
  });

  it('arcSummary가 없으면 null(독립 문단)', () => {
    expect(deriveArc(row(undefined, 3, 0), { now: NOW })).toBeNull();
    expect(deriveArc(row('   ', 3, 0), { now: NOW })).toBeNull();
  });

  it('10화 완결이면 null(새 이야기)', () => {
    expect(deriveArc(row('완결된 이야기.', 10, 0), { now: NOW })).toBeNull();
    expect(deriveArc(row('9화까지 이어짐.', 9, 0), { now: NOW })).toEqual({ prevArc: '9화까지 이어짐.', episode: 10 });
  });

  it('7일을 초과하면 null(오래된 이야기)', () => {
    expect(deriveArc(row('오래된 이야기.', 2, 8 * 86400000), { now: NOW })).toBeNull();
    expect(deriveArc(row('막차.', 2, 7 * 86400000 - 1000), { now: NOW })).not.toBeNull();
  });

  it('약점 모드(weekly)면 무조건 null(연재 제외)', () => {
    expect(deriveArc(row('약점 세션은 제외.', 2, 0), { now: NOW, weekly: true })).toBeNull();
  });

  it('행이 없으면 null', () => {
    expect(deriveArc(null, { now: NOW })).toBeNull();
    expect(deriveArc(undefined, {})).toBeNull();
  });

  it('used_at 부재 시 created_at으로 신선도를 판정한다', () => {
    const r = { paragraph: { arcSummary: '생성만 된 문단.' }, materials: { episode: 2 }, created_at: new Date(NOW - 86400000).toISOString() };
    expect(deriveArc(r, { now: NOW })).toEqual({ prevArc: '생성만 된 문단.', episode: 3 });
  });
});

describe('deriveColdStart', () => {
  const slugs = ['ja-01', 'ja-02', 'ja-03'];

  it('진행·어휘·이벤트가 전부 비면 콜드스타트', () => {
    expect(deriveColdStart([], [], [], slugs)).toBe(true);
  });

  it('레지스트리 챕터 slug 진행이 하나라도 있으면 아니다', () => {
    expect(deriveColdStart([{ slug: 'ja-01' }], [], [], slugs)).toBe(false);
  });

  it('레지스트리 밖 slug 진행 행은 콜드스타트를 깨지 않는다', () => {
    // 다른 언어·구버전 slug만 있으면 이 언어 이력으로 치지 않는다
    expect(deriveColdStart([{ slug: 'zzz-legacy' }], [], [], slugs)).toBe(true);
  });

  it('어휘가 있으면 아니다', () => {
    expect(deriveColdStart([], [{ meaning: '고양이' }], [], slugs)).toBe(false);
  });

  it('리뷰 이벤트 3개 이상이면 아니다', () => {
    expect(deriveColdStart([], [], [{}, {}, {}], slugs)).toBe(false);
  });

  it('리뷰 이벤트 2개까지는 이력으로 치지 않는다', () => {
    expect(deriveColdStart([], [], [{}, {}], slugs)).toBe(true);
  });

  it('Set으로 넘겨도 동작한다', () => {
    expect(deriveColdStart([{ slug: 'ja-02' }], [], [], new Set(slugs))).toBe(false);
  });
});
