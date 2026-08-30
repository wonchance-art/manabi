import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import { haveWordSet, vocabCoverage } from '../goalVocab.js';

/**
 * 계약: v2-D R3 어휘 축 합류 (#1077 설계 §3·§4).
 * 계획표는 처음부터 "어휘는 제외"였다. 정본은 레벨마다 어휘를 갖고 있고 사용자는 이미
 * 단어를 담고 '이미 앎'을 찍고 있었는데 그 둘이 목표와 만나지 않았다.
 * 새로 적재하는 기록은 0 — 이미 있는 것을 대조만 한다.
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
/** 주석 제거 후 대조 — 설명 문구가 계약에 잡히지 않게(v2-L 자기함정 클래스). */
const codeOf = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** 정본 인덱스 모양만 흉내 낸 Map — 콘텐츠가 늘어도 순수 계약이 흔들리지 않게. */
const INDEX = new Map([
  ['一', { level: 'H1' }],
  ['二', { level: 'H1' }],
  ['三', { level: 'H2' }],
  ['四', { level: 'H2' }],
  ['五', { level: 'H6' }],       // 목표 밖 레벨
  ['생활', { level: 'LIFE' }],   // 목표 밖 레벨
]);

describe('§3 확보 — 무엇을 "다시 배우지 않아도 되는 말"로 치는가', () => {
  it('담은 말과 이미 안다고 찍은 말이 한 셈에 들어간다', () => {
    const have = haveWordSet({
      vocabRows: [{ word_text: '一', language: 'Chinese' }],
      knownRows: [{ word_text: '二' }],
      language: 'Chinese',
    });
    expect([...have].sort()).toEqual(['一', '二']);
  });

  it('남의 언어 단어장 행은 빼되, language가 빈 옛 행은 살린다', () => {
    const have = haveWordSet({
      vocabRows: [
        { word_text: '一', language: 'Chinese' },
        { word_text: 'ねこ', language: 'Japanese' },
        { word_text: '二' },                       // 컬럼이 생기기 전에 담은 행
      ],
      language: 'Chinese',
    });
    // 옛 행을 빼면 "0% 확보"라는 거짓말이 된다. 어차피 정본과 교집합을 내므로 무해하다.
    expect(have.has('二')).toBe(true);
    expect(have.has('ねこ')).toBe(false);
  });

  it('공백·빈 값은 조용히 버린다', () => {
    const have = haveWordSet({
      vocabRows: [{ word_text: '  一  ' }, { word_text: '' }, { word_text: null }, {}],
      knownRows: [{ word_text: null }],
    });
    expect([...have]).toEqual(['一']);
    expect(haveWordSet().size).toBe(0);
  });
});

describe('§3 커버리지 — 목표 레벨까지의 정본 어휘 중 내 몫', () => {
  it('목표 밖 레벨은 세지 않는다 — H5가 목표인데 H6까지 세면 분모가 거짓말이 된다', () => {
    const c = vocabCoverage(INDEX, ['H1', 'H2'], new Set(['一', '五']));
    expect(c.total).toBe(4);            // H1 2 + H2 2 (H6·LIFE 제외)
    expect(c.have).toBe(1);             // 五는 목표 밖이라 분자에도 안 든다
    expect(c.pct).toBe(25);
  });

  it('레벨 순서는 계획이 정한다 — 인덱스 순회 순서면 화면에서 레벨이 뒤섞인다', () => {
    expect(vocabCoverage(INDEX, ['H2', 'H1'], new Set()).byLevel.map(b => b.level))
      .toEqual(['H2', 'H1']);
  });

  it('레벨별로도 쪼개 준다 — 어디가 비었는지 보여야 다음 할 일이 정해진다', () => {
    const c = vocabCoverage(INDEX, ['H1', 'H2'], new Set(['一', '二', '三']));
    expect(c.byLevel).toEqual([
      { level: 'H1', total: 2, have: 2 },
      { level: 'H2', total: 2, have: 1 },
    ]);
  });

  it('어휘가 0인 레벨은 줄에서 뺀다 — "OT 0/0"은 아무것도 말하지 않는다', () => {
    const c = vocabCoverage(INDEX, ['OT', 'H1'], new Set());
    expect(c.byLevel.map(b => b.level)).toEqual(['H1']);
  });

  it('셀 것이 없으면 null — 화면은 그 줄을 그리지 않는다', () => {
    expect(vocabCoverage(INDEX, ['OT'], new Set())).toBeNull();
    expect(vocabCoverage(INDEX, [], new Set())).toBeNull();
    expect(vocabCoverage(null, ['H1'], new Set())).toBeNull();
    expect(vocabCoverage({}, ['H1'], new Set())).toBeNull();
  });

  it('아무것도 확보하지 않았어도 0%로 답한다 — 0 나눗셈은 분모에서만 난다', () => {
    const c = vocabCoverage(INDEX, ['H1'], null);
    expect(c).toMatchObject({ total: 2, have: 0, pct: 0 });
  });
});

describe('§5 이음새 신설 0 — 대조만 하고 아무것도 적재하지 않는다', () => {
  it('순수 모듈이 서버를 모른다', () => {
    const src = codeOf(read('src/lib/goalVocab.js'));
    for (const banned of ['supabase', 'insert(', 'upsert(', 'fetch(']) {
      expect(src, `어휘 계산이 ${banned}를 알면 안 된다`).not.toContain(banned);
    }
  });

  it('궤도 카드가 읽는 테이블은 이미 있는 둘뿐 — 어휘 축에 새 저장소가 없다', () => {
    // "미래에 마이그레이션이 하나도 없다"로 세면 다음 축의 정당한 스키마 변경에 깨진다.
    // 지키려는 건 R3이 **읽기만 한다**는 것이므로 읽는 대상을 고정한다.
    const card = read('src/views/ProfileStats.jsx');
    const tables = new Set([...card.matchAll(/\.from\('(\w+)'\)/g)].map(m => m[1]));
    expect(tables.has('user_vocabulary')).toBe(true);
    for (const banned of ['goal_vocab', 'user_goal_vocab', 'vocab_coverage']) {
      expect(tables.has(banned), `${banned} 같은 새 테이블을 만들지 않는다`).toBe(false);
    }
    // 어휘 재료는 기존 두 경로에서만 온다
    expect(read('src/lib/knownWords.js')).toContain("from('user_known_words')");
    expect(read('src/lib/goalRows.js')).toContain("from('user_ref_progress')");
  });
});

describe('배선 — 무거운 정본은 상세를 열 때만', () => {
  const stats = read('src/views/ProfileStats.jsx');
  const card = codeOf(sliceBetween(stats, 'function GoalTrackCard(', '\n}'));

  it('어휘 정본 인덱스는 모달을 열어야 로드된다 — 홈 첫 화면이 1.9MB를 치르면 안 된다', () => {
    // 정본 어휘는 언어당 수천 단어(뜻·병음·예문 포함)라 홈에 상주시킬 물건이 아니다.
    const effect = sliceBetween(card, 'useEffect(() => {', '}, [open, goalLang]);');
    expect(effect).toContain('if (!open || !goalLang) return undefined;');
    expect(effect).toContain('loadRefVocabIndex(goalLang)');
  });

  it("'이미 앎' 조회도 열었을 때만 — 안 여는 사람에게 쿼리를 태우지 않는다", () => {
    const q = sliceBetween(card, "queryKey: ['goal-known'", '});');
    expect(q).toContain('enabled: open && !!user?.id && !!knownWordsLang(goalLang),');
    expect(q).toContain('fetchKnownWords(user.id, knownWordsLang(goalLang))');
    // 실패·미적용은 조용히 — 어휘 줄만 덜 정확해진다
    expect(q).toMatch(/catch \{ return \[\]; \}/);
  });

  it('확보 계산은 순수 함수 둘이 한다 — 화면이 교집합을 다시 짜지 않는다', () => {
    expect(card).toContain('haveWordSet({ vocabRows: vocab, knownRows, language: goalLang })');
    expect(card).toContain('vocabCoverage(vocabIndex, plan.levels.map(lv => lv.key), have)');
  });

  it('단어장 행의 language가 조회에 있다 — 없으면 남의 언어 단어가 확보로 샌다', () => {
    const selects = [...stats.matchAll(/\.select\('([^']+)'\)/g)].map(m => m[1]);
    const deck = selects.find(f => f.includes('next_review_at'));
    expect(deck.split(',').map(f => f.trim())).toContain('language');
  });

  it('어휘 정본이 없는 언어에서는 줄 자체가 없다 — 빈 칸이 남으면 고장으로 읽힌다', () => {
    expect(card).toContain('{knownWordsLang(goalLang) && (');
  });
});
