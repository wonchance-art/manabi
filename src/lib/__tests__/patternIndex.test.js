import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import {
  LOW_SIGNAL_KERNELS, MAX_SPAN, STRONG_SINGLE_KERNELS,
  buildKernelIndex, isUsableKernel, kernelsOf, scanTokens,
} from '../patternIndex.js';
import { REF_GRAMMAR_MANIFEST } from '../../content/refGrammarManifest.js';
import bunkeiH1 from '../../content/chinese/bunkei/h1.js';
import bunkeiH2 from '../../content/chinese/bunkei/h2.js';
import bunkeiH3 from '../../content/chinese/bunkei/h3.js';
import bunkeiH4 from '../../content/chinese/bunkei/h4.js';
import bunkeiH5 from '../../content/chinese/bunkei/h5.js';
import bunkeiH6 from '../../content/chinese/bunkei/h6.js';

/**
 * 계약: v2-G R1 문법 패턴 본문 하이라이트 (#1077 설계 §2·§6).
 * 아키 문서가 부채로 적어 둔 이음새(챕터 → 자료 역방향)를 여는 축.
 * 스캔은 LLM 0회·O(n)이고, 오탐은 두 겹(한 글자 허용 목록 · 토큰 경계)으로 막는다.
 * 새 테이블·새 이벤트·마이그레이션 0.
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
/** 주석 제거 후 대조 — 설명 문구가 계약에 잡히지 않게(v2-L 자기함정 클래스). */
const codeOf = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const ZH_SETS = [
  { level: 'H1', mod: bunkeiH1 }, { level: 'H2', mod: bunkeiH2 }, { level: 'H3', mod: bunkeiH3 },
  { level: 'H4', mod: bunkeiH4 }, { level: 'H5', mod: bunkeiH5 }, { level: 'H6', mod: bunkeiH6 },
];
const ZH_SLUGS = new Set(
  REF_GRAMMAR_MANIFEST.languages.Chinese.levels.flatMap((lv) => lv.chapters.map((c) => c.slug)),
);
/** 토큰 흉내 — 분석기가 낱말로 끊어 준 결과. */
const T = (...texts) => texts.map((text, i) => ({ id: `t${i}`, text }));

describe('§2 커널 — 슬롯을 버리고 고정 형태소만', () => {
  it('표기에서 한자만 남는다 — A/B·주어·형용사는 슬롯이라 저절로 빠진다', () => {
    expect(kernelsOf('A 是 B')).toEqual(['是']);
    expect(kernelsOf('주어 + 很 + 형용사')).toEqual(['很']);
    expect(kernelsOf('주어 + 是…的')).toEqual(['是', '的']);
    expect(kernelsOf('주어 + 동사 + 목적어')).toEqual([]);   // 고정 형태소가 없는 표기
    expect(kernelsOf(null)).toEqual([]);
  });
});

describe('§6 오탐 방지 ① — 한 글자는 허용 목록만', () => {
  it('的·了·是·在은 표지가 아니라 배경이다 — 밑줄이 글 전체에 깔린다', () => {
    for (const k of ['的', '了', '是', '在', '不', '很', '有']) {
      expect(isUsableKernel(k), `${k}는 한 글자 표지로 쓰면 안 된다`).toBe(false);
    }
  });

  it('한 글자로도 구문을 특정하는 것만 되살린다', () => {
    for (const k of ['把', '被', '越', '连', '除', '比']) {
      expect(STRONG_SINGLE_KERNELS.has(k), `${k}는 허용 목록에 있어야 한다`).toBe(true);
      expect(isUsableKernel(k)).toBe(true);
    }
  });

  it('허용 목록이 비면 한 글자 표지가 전멸한다 — 목록 자체가 계약이다', () => {
    expect(STRONG_SINGLE_KERNELS.size).toBeGreaterThan(10);
    expect(LOW_SIGNAL_KERNELS.size).toBeGreaterThan(0);
  });

  it('두 글자 이상은 통과하되, 흔한 낱말은 제외 목록으로 뺀다', () => {
    expect(isUsableKernel('越来越')).toBe(true);
    expect(isUsableKernel('除了')).toBe(true);
    expect(isUsableKernel('没有')).toBe(false);   // 문형의 표지이기 전에 그냥 흔한 낱말
    expect(isUsableKernel('')).toBe(false);
    // 시간 명사·인사는 '언제·상투'를 가리키지 그 문장의 구조를 가리키지 않는다
    // (렌더 실측에서 "今天我在图书馆…"의 今天이 밑줄을 받아 잡혔다)
    for (const k of ['今天', '明天', '现在', '晚上', '谢谢', '再见']) {
      expect(isUsableKernel(k), `${k}는 문법 표지가 아니다`).toBe(false);
    }
  });
});

describe('§2 인덱스 — 정본에서 유도하고, 두 번 돌려도 같다', () => {
  const index = buildKernelIndex(ZH_SETS, { base: '/chinese', validSlugs: ZH_SLUGS });

  it('결정성 — 같은 입력에 같은 산출(커널 순서·패턴 순서·id까지)', () => {
    const again = buildKernelIndex(ZH_SETS, { base: '/chinese', validSlugs: ZH_SLUGS });
    expect([...again.keys()]).toEqual([...index.keys()]);
    expect(again.get('把').map((p) => p.id)).toEqual(index.get('把').map((p) => p.id));
  });

  it('정본 문형이 실제로 들어온다 — 把·被·越来越는 표지로 잡혀야 한다', () => {
    expect(index.size).toBeGreaterThan(200);
    for (const k of ['把', '被', '越来越']) {
      expect(index.get(k)?.length, `${k} 표지가 비었다`).toBeGreaterThan(0);
    }
  });

  it('§6 환각 차단 — 챕터 링크는 정본 slug일 때만 생긴다', () => {
    const all = [...index.values()].flat();
    for (const p of all) {
      if (!p.href) continue;
      expect(p.ch, '링크가 있는데 slug가 없다').toBeTruthy();
      expect(ZH_SLUGS.has(p.ch), `${p.ch}는 정본 챕터가 아니다`).toBe(true);
      expect(p.href).toBe(`/chinese/grammar/${p.ch}`);
    }
    // 정본 데이터 자체도 지금은 전부 유효하다 — 어긋나면 여기서 먼저 걸린다
    expect(all.filter((p) => p.ch).length).toBeGreaterThan(300);
  });

  it('정본에 없는 slug는 링크만 지운다 — 문형 자체는 남는다', () => {
    const fake = [{ level: 'H1', mod: { level: 'H1', themes: [{ name: 't', items: [
      { pattern: '把 A 동사', ch: '없는-챕터', ko: '처치', conn: 'c', ex: { zh: 'x' } },
    ] }] } }];
    const ix = buildKernelIndex(fake, { base: '/chinese', validSlugs: new Set(['h3-01-ba']) });
    expect(ix.get('把')).toHaveLength(1);
    expect(ix.get('把')[0].href).toBeNull();
    expect(ix.get('把')[0].ko).toBe('처치');
  });
});

describe('§6 오탐 방지 ② — 토큰 경계로만 맞춘다', () => {
  const index = buildKernelIndex([{ level: 'H1', mod: { level: 'H1', themes: [{ name: 't', items: [
    { pattern: '把 A 동사', ch: 'c1', ko: '처치문' },
    { pattern: '越来越 형용사', ch: 'c2', ko: '점층' },
    // 越 단독도 표지다 — 짧은 표지와 긴 표지가 같은 자리에서 겨뤄야 '최장 일치'가 검증된다
    { pattern: '越 A 越 B', ch: 'c4', ko: '~할수록' },
    { pattern: '因为 A 所以 B', ch: 'c3', ko: '인과' },
  ] }] } }], { base: '/chinese' });

  it('분석기가 한 낱말로 끊어 준 자리에서만 표지로 친다', () => {
    // 得가 觉得 안에 있으면 표지가 아니다 — 문자 부분일치면 여기서 잘못 걸린다
    const { byToken } = scanTokens(T('我', '觉得', '好'), index);
    expect(byToken.size).toBe(0);
  });

  it('표지 토큰만 밑줄이 붙는다', () => {
    const { hits, byToken } = scanTokens(T('我', '把', '书', '放'), index);
    expect(hits).toHaveLength(1);
    expect(hits[0].kernel).toBe('把');
    expect(hits[0].patterns[0].ko).toBe('처치문');
    expect([...byToken.keys()]).toEqual(['t1']);
  });

  it('최장 일치 — 越来越를 越 하나로 끊으면 정작 그 구문을 놓친다', () => {
    expect(MAX_SPAN).toBe(4);
    const { hits } = scanTokens(T('天气', '越', '来', '越', '热'), index);
    expect(hits).toHaveLength(1);
    expect(hits[0].kernel).toBe('越来越');
    expect(hits[0].tokenIds).toEqual(['t1', 't2', 't3']);
  });

  it('표지끼리 겹치지 않는다 — 긴 표지에 먹힌 글자는 다시 잡히지 않는다', () => {
    // 越来越를 잡고 나면 그 안의 越이 또 한 번 표지가 되면 안 된다(밑줄이 겹친다).
    const { hits, byToken } = scanTokens(T('越', '来', '越', '把'), index);
    expect(hits.map((h) => h.kernel)).toEqual(['越来越', '把']);
    expect(byToken.get('t2').kernel).toBe('越来越');
    expect(byToken.size).toBe(4);
  });

  it('한 문형의 표지가 여럿이면 각각 잡힌다 — 因为…所以는 두 자리 모두 그 문형이다', () => {
    const { hits } = scanTokens(T('因为', '下雨', '所以', '没去'), index);
    expect(hits.map((h) => h.kernel)).toEqual(['因为', '所以']);
    expect(hits[0].patterns[0].id).toBe(hits[1].patterns[0].id);
  });

  it('문장부호를 사이에 두고 표지가 이어지지 않는다 — 越。来越는 越来越가 아니다', () => {
    const { hits } = scanTokens(T('越', '。', '来', '越'), index);
    expect(hits.map((h) => h.kernel)).toEqual(['越', '越']);
    expect(hits.every((h) => h.tokenIds.length === 1)).toBe(true);
  });

  it('망가진 입력은 조용히 빈 결과 — 진단 도구가 본문을 깨뜨리지 않는다', () => {
    expect(scanTokens(null, index).hits).toEqual([]);
    expect(scanTokens(T('把'), null).hits).toEqual([]);
    expect(scanTokens(T('把'), {}).hits).toEqual([]);
  });
});

describe('§6 스캔은 LLM 0회 — 표지어 대조뿐', () => {
  const src = codeOf(read('src/lib/patternIndex.js'));

  it('순수 모듈이 서버·모델을 모른다', () => {
    for (const banned of ['supabase', 'fetch(', '/api/', 'anthropic', 'prompt']) {
      expect(src, `표지 스캔이 ${banned}를 알면 안 된다`).not.toContain(banned);
    }
  });

  it('지연 로드는 중국어만 — 일본어 활용형은 R3으로 분리(설계 §4)', () => {
    expect(src).toContain("if (language !== 'Chinese') return Promise.resolve(null);");
    expect(src).toContain("import('../content/chinese/bunkei/h1')");
  });
});

describe('배선 — 기본 꺼짐, 켜야 로드', () => {
  const viewer = read('src/views/ViewerPage.jsx');
  const card = codeOf(viewer);

  it('§6 기본 꺼짐 — 옵트인이 전제다', () => {
    expect(read('src/lib/useViewerSettings.js')).toContain("readPref('showPatterns', false)");
  });

  it('정본 인덱스는 토글을 켰을 때만 로드된다 — 안 쓰는 사람에게 304KB를 지우지 않는다', () => {
    const effect = sliceBetween(card, 'const [patternIndex, setPatternIndex]', '}, [showPatterns, materialLang, patternIndex]);');
    expect(effect).toContain("if (!showPatterns || materialLang !== 'Chinese' || patternIndex) return undefined;");
    expect(effect).toContain('loadPatternIndex(materialLang)');
  });

  it('스캔은 자료당 한 번 메모 — 렌더는 Map 조회뿐(설계 §5 성능)', () => {
    const memo = sliceBetween(card, 'const patternScan = useMemo(', '}, [showPatterns, patternIndex, material?.processed_json]);');
    expect(memo).toContain('scanTokens(tokens, patternIndex)');
    expect(memo).toContain('if (!showPatterns || !patternIndex || !json?.sequence) return null;');
  });

  it('밑줄은 스캔이 잡은 토큰에만', () => {
    expect(card).toMatch(/word-token--pattern/);
    expect(card).toContain("patternScan?.byToken.has(tokenId) ? ' word-token--pattern' : ''");
    // 단정하는 면 칠이 아니라 가는 밑줄 — 톤이 CSS에도 남아야 한다
    const css = read('src/index.css');
    const rule = sliceBetween(css, '.word-token--pattern .surface::after {', '}');
    expect(rule).toContain('height: 1.5px;');
    expect(rule).toContain('background: var(--pattern-line);');
  });

  it('카드는 단어 카드 안에 얹는다 — 새 상호작용을 만들면 단어 탭과 경합한다', () => {
    expect(card).toContain('<PatternCard hit={patternScan.byToken.get(selectedToken.id)} />');
    expect(card).toContain('selectedToken?.id && patternScan?.byToken.get(selectedToken.id)');
  });

  it("톤은 '후보' — 단정하는 제목을 쓰지 않는다", () => {
    const pc = read('src/components/PatternCard.jsx');
    expect(pc).toContain('이 표지가 쓰이는 문형');
    expect(pc).toContain('챕터로 →');
    expect(pc).toContain('{p.href && <Link');   // 죽은 화살표를 남기지 않는다
  });
});
