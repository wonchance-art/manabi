import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import {
  JA_LOW_SIGNAL_KERNELS, PATTERN_LANGS, buildKernelIndex, hasSlotMarker,
  isUsableKernel, kernelsOf, kernelsOfJa, scanTokens, supportsPatterns,
} from '../patternIndex.js';
import { REF_GRAMMAR_MANIFEST } from '../../content/refGrammarManifest.js';
import n5 from '../../content/japanese/bunkei/n5.js';
import n4 from '../../content/japanese/bunkei/n4.js';
import n3 from '../../content/japanese/bunkei/n3.js';
import n2 from '../../content/japanese/bunkei/n2.js';
import n1 from '../../content/japanese/bunkei/n1.js';

/**
 * 계약: v2-G R3 일본어 확장 (#1077 설계 §4).
 *
 * R1이 중국어만 연 이유가 여기 있었다. 중국어 표기는 슬롯이 한글·로마자라 **한자만
 * 남기면** 표지가 떨어지는데, 일본어는 고정 형태소가 대부분 **가나**다 — 같은 규칙을
 * 쓰면 커널이 하나도 안 나온다. 규칙은 실측이 정했다(아래 밀도 계약).
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const codeOf = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const JA_SETS = [
  { level: 'N5', mod: n5 }, { level: 'N4', mod: n4 }, { level: 'N3', mod: n3 },
  { level: 'N2', mod: n2 }, { level: 'N1', mod: n1 },
];
const JA_SLUGS = new Set(
  REF_GRAMMAR_MANIFEST.languages.Japanese.levels.flatMap((lv) => lv.chapters.map((c) => c.slug)),
);
const T = (...texts) => texts.map((text, i) => ({ id: `t${i}`, text }));

describe('§4 일본어 커널 — 가나가 표지다', () => {
  it('중국어 규칙을 그대로 쓰면 커널이 하나도 안 나온다 — 그래서 R3으로 갈렸다', () => {
    expect(kernelsOf('〜てから')).toEqual([]);            // 한자만 남기는 규칙
    expect(kernelsOf('〜てから', 'Japanese')).toEqual(['てから']);
  });

  it('슬롯 표지·한국어 슬롯말·N/V/A/B는 빠진다', () => {
    expect(kernelsOfJa('〜なければならない')).toEqual(['なければならない']);
    expect(kernelsOfJa('Nのために')).toEqual(['のために']);
    // 슬롯말에 붙은 가나 한 조각(な형용사의 な)이 남을 수 있다 — 길이 규칙이 받아낸다.
    expect(kernelsOfJa('な형용사 + です')).toContain('です');
    for (const k of kernelsOfJa('な형용사 + です')) {
      if (k !== 'です') expect(isUsableKernel(k, 'Japanese'), `${k} 같은 조각이 표지가 되면 안 된다`).toBe(false);
    }
  });

  it('`・`·`/`는 이형태 나열이라 각각 뽑는다', () => {
    expect(kernelsOfJa('〜たら・〜なら').sort()).toEqual(['たら', 'なら']);
    expect(kernelsOfJa('この/その/あの + 명사').sort()).toEqual(['あの', 'この', 'その']);
  });

  it('`()`는 선택 요소라 있는 형태와 없는 형태 둘 다 만든다', () => {
    // 〜あげく로도 〜あげくに로도 쓰이므로 한쪽만 만들면 나머지를 놓친다.
    expect(kernelsOfJa('〜あげく(に)').sort()).toEqual(['あげく', 'あげくに']);
    expect(kernelsOfJa('〜(さ)せる').sort()).toEqual(['させる', 'せる']);
  });

  it('공백은 붙인다 — 표기의 띄어쓰기는 읽기 편하라고 넣은 것이지 토큰 경계가 아니다', () => {
    expect(kernelsOfJa('〜では ありません').sort()).toEqual(['ありません', 'では']);
  });
});

describe('§6 오탐 방지 — 일본어는 가나가 배경이다', () => {
  it('한 글자·두 글자 가나는 표지가 아니다 — は·の·を·です·から는 글 전체에 깔린다', () => {
    for (const k of ['は', 'の', 'を', 'に', 'が', 'か', 'です', 'から', 'ない', 'ても']) {
      expect(isUsableKernel(k, 'Japanese'), `${k}는 배경이다`).toBe(false);
    }
  });

  it('가나 세 글자부터 표지로 친다', () => {
    for (const k of ['てから', 'ながら', 'まえに', 'いけません']) {
      expect(isUsableKernel(k, 'Japanese'), `${k}는 표지다`).toBe(true);
    }
  });

  it('한자가 섞이면 두 글자부터 — 한자가 이미 뜻을 좁혀 준다', () => {
    expect(isUsableKernel('上に', 'Japanese')).toBe(true);
    expect(isUsableKernel('中で', 'Japanese')).toBe(true);
    // 한자 한 글자는 조수사·명사라 배경이다(枚·冊·時·際)
    expect(isUsableKernel('枚', 'Japanese')).toBe(false);
  });

  it('정중형 활용은 일본어의 的·了·是다 — 과거 정중형마다 밑줄이 붙으면 배경이 된다', () => {
    // 실측: 제외 전 최다 적중이 ました 177회로 압도적 1위였다.
    for (const k of ['ました', 'ています', 'あります', 'ありません', 'でした', 'ません']) {
      expect(JA_LOW_SIGNAL_KERNELS.has(k), `${k}는 정중형 활용이다`).toBe(true);
      expect(isUsableKernel(k, 'Japanese')).toBe(false);
    }
  });

  it('슬롯 없는 표기는 문형이 아니라 어휘 항목이다 — 임의 목록이 아니라 구조로 거른다', () => {
    // とても·たくさん·すこし는 문형 사전에 있지만 구문을 말하지 않는다.
    for (const p of ['とても', 'たくさん', 'すこし・ちょっと', 'それから']) {
      expect(hasSlotMarker(p), `${p}는 슬롯이 없다`).toBe(false);
    }
    for (const p of ['〜てから', 'Nのために', 'な형용사 + です', '〜(の 中で) 〜が いちばん']) {
      expect(hasSlotMarker(p), `${p}는 슬롯이 있다`).toBe(true);
    }
  });

  it('중국어 규칙은 그대로다 — 한 글자 허용 목록이 일본어 규칙에 오염되지 않는다', () => {
    expect(isUsableKernel('把')).toBe(true);              // 중국어 허용 목록
    expect(isUsableKernel('把', 'Japanese')).toBe(false); // 일본어에선 한자 1자 = 배경
    expect(isUsableKernel('的')).toBe(false);
  });
});

describe('§4 인덱스 — 정본에서 유도하고, 두 번 돌려도 같다', () => {
  const build = () => buildKernelIndex(JA_SETS, { base: '/japanese', validSlugs: JA_SLUGS, lang: 'Japanese' });
  const ix = build();

  it('결정성 — 같은 입력에 같은 산출', () => {
    const a = [...build().entries()].map(([k, v]) => [k, v.map((p) => p.id)]);
    const b = [...build().entries()].map(([k, v]) => [k, v.map((p) => p.id)]);
    expect(a).toEqual(b);
  });

  it('정본 문형이 실제로 들어온다', () => {
    for (const k of ['てから', 'ながら', 'なければ']) {
      expect(ix.get(k)?.length, `${k}가 인덱스에 있어야 한다`).toBeGreaterThan(0);
    }
  });

  it('lang을 안 주면 가나 표지가 통째로 빠진다 — 호출자가 언어를 반드시 넘겨야 한다', () => {
    // 중국어 규칙은 한자만 남기므로 일본어 정본에서도 한자 조각 몇 개는 나온다.
    // 지키려는 건 "조용히 빈다"가 아니라 **표지가 없다**는 것이다.
    const noLang = buildKernelIndex(JA_SETS, { base: '/japanese' });
    for (const k of ['てから', 'ながら', 'なければ']) {
      expect(noLang.has(k), `lang 없이 ${k}가 나오면 안 된다`).toBe(false);
    }
    expect(noLang.size).toBeLessThan(ix.size / 5);
  });

  it('§6 환각 차단 — 챕터 링크는 정본 slug일 때만', () => {
    for (const list of ix.values()) {
      for (const p of list) {
        if (p.href) expect(JA_SLUGS.has(p.ch), `${p.ch}는 정본 slug가 아니다`).toBe(true);
        if (p.href) expect(p.href).toBe(`/japanese/grammar/${p.ch}`);
      }
    }
  });
});

describe('§6 밀도 — 규칙을 정한 것은 실측이다', () => {
  const ix = buildKernelIndex(JA_SETS, { base: '/japanese', lang: 'Japanese' });

  /** 본문 코퍼스 — 실제 독해 트랙의 일본어 문장(한국어 해설 제외). */
  const corpus = (() => {
    const out = [];
    for (const f of fs.readdirSync(path.join(process.cwd(), 'src/content/japanese/reading'))) {
      const s = read(`src/content/japanese/reading/${f}`);
      for (const m of s.matchAll(/["`]([^"`]{15,})["`]/g)) {
        if (/[ぁ-んァ-ヶ]/.test(m[1]) && !/[가-힣]/.test(m[1])) out.push(m[1]);
      }
    }
    return out;
  })();

  it('본문 코퍼스가 실재한다 — 코퍼스가 비면 아래 밀도 계약이 공허 통과한다(v2-L)', () => {
    expect(corpus.length).toBeGreaterThan(200);
  });

  it('밑줄 밀도가 상한을 넘지 않는다 — 넘으면 표지가 아니라 배경이 된다', () => {
    // 형태소 분석기(kuromoji)는 서버 전용이라 여기서는 **글자 단위**로 근사한다.
    // 글자 토큰은 실제 토큰보다 잘게 쪼개져 결합 기회가 많으므로 이 값은 **상한**이다.
    let total = 0;
    let marked = 0;
    for (const line of corpus) {
      const tokens = [...line].map((c, i) => ({ id: `t${i}`, text: c }));
      total += tokens.filter((t) => /[぀-ヿ一-鿿]/.test(t.text)).length;
      marked += scanTokens(tokens, ix).byToken.size;
    }
    expect(total).toBeGreaterThan(1000);
    const pct = (marked / total) * 100;
    expect(pct, `밀도 ${pct.toFixed(1)}% — 18% 상한(R1 실측 기준)을 넘었다`).toBeLessThan(18);
  });

  it('그래도 충분히 잡는다 — 아무것도 안 잡히면 기능이 없는 것과 같다', () => {
    const hit = corpus.filter((l) => scanTokens([...l].map((c, i) => ({ id: `t${i}`, text: c })), ix).hits.length > 0);
    expect(hit.length / corpus.length).toBeGreaterThan(0.1);
  });

  it('정본 문형의 절반 이상이 커널을 갖는다 — 못 가리키는 문형은 카드에 못 뜬다', () => {
    const covered = new Set();
    let all = 0;
    for (const { mod } of JA_SETS) {
      for (const theme of (mod.default || mod).themes || []) {
        for (const item of theme.items || []) {
          if (!item?.pattern) continue;
          all += 1;
          if (kernelsOfJa(item.pattern).some((k) => ix.has(k))) covered.add(item.pattern);
        }
      }
    }
    expect(all).toBeGreaterThan(800);
    expect(covered.size / all).toBeGreaterThan(0.5);
  });
});

describe('§6 토큰 경계 — 가나를 받아도 중국어가 흔들리지 않는다', () => {
  const ja = buildKernelIndex(JA_SETS, { base: '/japanese', lang: 'Japanese' });

  it('여러 토큰에 걸친 표지를 이어 붙여 잡는다 — 형태소 분석기는 て와 から를 끊는다', () => {
    const hits = scanTokens(T('食べ', 'て', 'から'), ja).hits;
    expect(hits.map((h) => h.kernel)).toContain('てから');
  });

  it('가나 토큰이 표지에 들어간다 — 한자만 받으면 일본어 표지가 전멸한다', () => {
    // isScannable을 한자 전용으로 되돌리면 이 계약이 깨진다(R3의 존재 이유).
    expect(scanTokens(T('な', 'がら'), ja).hits.length).toBeGreaterThan(0);
  });

  it('가나를 받아도 중국어 커널에 붙지 않는다 — 문자 종류가 이미 갈라 준다', () => {
    const zhLike = new Map([['把书', [{ id: 'x', pattern: '把', level: 'H3' }]]]);
    expect(scanTokens(T('把', 'の', '书'), zhLike).hits).toEqual([]);
  });
});

describe('배선 — 언어가 바뀌면 인덱스도 갈아야 한다', () => {
  const viewer = codeOf(read('src/views/ViewerPage.jsx'));

  it('지원 언어는 한 곳이 정한다 — 화면이 언어 이름을 흩뿌리면 한 곳만 고쳐지는 자리가 생긴다', () => {
    expect(PATTERN_LANGS).toEqual(new Set(['Chinese', 'Japanese']));
    expect(supportsPatterns('Japanese')).toBe(true);
    expect(supportsPatterns('French')).toBe(false);
    expect(viewer, "화면이 'Chinese'로 문법 표시를 직접 가르면 안 된다")
      .not.toMatch(/materialLang === 'Chinese' && showPatterns/);
  });

  it('일본어 정본도 토글을 켰을 때만 로드된다', () => {
    const load = sliceBetween(read('src/lib/patternIndex.js'), 'export function loadPatternIndex(', '\n}');
    expect(load).toContain("import('../content/japanese/bunkei/n5')");
    expect(load).toContain('jaSetsPromise ||=');
    // 언어별로 따로 캐시 — 한 언어를 읽는 사람이 다른 언어의 정본을 지지 않는다
    expect(load).toContain("import('../content/chinese/bunkei/h1')");
  });

  it('자료 언어가 바뀌면 인덱스를 다시 만든다 — 안 갈면 중국어 커널로 일본어를 훑는다', () => {
    const effect = sliceBetween(viewer, 'const [patternIndex, setPatternIndex]', '}, [showPatterns, materialLang, patternIndexLang]);');
    expect(effect).toContain('patternIndexLang === materialLang) return undefined;');
    expect(effect).toContain('setPatternIndexLang(materialLang)');
  });

  it('언어가 바뀌는 순간의 옛 인덱스로 스캔하지 않는다 — 남의 언어 밑줄이 깜빡인다', () => {
    const memo = sliceBetween(viewer, 'const patternScan = useMemo(', '}, [showPatterns, patternIndex,');
    expect(memo).toContain('patternIndexLang !== materialLang');
  });
});
