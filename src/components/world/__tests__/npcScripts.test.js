import { describe, it, expect } from 'vitest';
import {
  NPC_SCRIPTS, getNpcScript, normalizeAnswer, judgeType,
  OMIKUJI_RESULTS, drawOmikuji,
} from '../npcScripts.js';

// 🗾 NPC 대화 데이터 + 순수 판정(타이핑·오미쿠지) 검증. React/Phaser 미접촉.

describe('타이핑 판정(judgeType — 순수)', () => {
  it('NFKC 정규화 + 공백 제거 후 accept 중 하나와 일치', () => {
    expect(judgeType('バリカタ', ['バリカタ', 'ばりかた'])).toBe(true);
    expect(judgeType('ばりかた', ['バリカタ', 'ばりかた'])).toBe(true);
    expect(judgeType(' バリカタ ', ['バリカタ'])).toBe(true); // 공백 무시
    expect(judgeType('ください', ['ください', '下さい'])).toBe(true);
    expect(judgeType('下さい', ['ください', '下さい'])).toBe(true);
  });
  it('빈 입력·오답은 false', () => {
    expect(judgeType('', ['バリカタ'])).toBe(false);
    expect(judgeType('やわ', ['バリカタ'])).toBe(false);
    expect(judgeType('x', [])).toBe(false);
  });
  it('normalizeAnswer 는 전각/공백을 접는다', () => {
    expect(normalizeAnswer('　ください　')).toBe('ください');
  });
});

describe('오미쿠지(drawOmikuji — 균등, 서열 단정 없음)', () => {
  it('rnd 주입으로 인덱스별 결과를 결정적으로 고른다(경계 포함)', () => {
    const n = OMIKUJI_RESULTS.length;
    expect(drawOmikuji(() => 0)).toBe(OMIKUJI_RESULTS[0]);          // 大吉
    expect(drawOmikuji(() => 0.999)).toBe(OMIKUJI_RESULTS[n - 1]);  // 凶
  });
  it('凶 결과가 존재하고 묶기 리추얼 플래그(isKyo)를 가진다', () => {
    const kyo = OMIKUJI_RESULTS.find((r) => r.grade === '凶');
    expect(kyo).toBeTruthy();
    expect(kyo.isKyo).toBe(true);
  });
  it('모든 결과는 grade·yomi·ko·line 을 갖고, 서열을 단정하는 문구가 없다', () => {
    for (const r of OMIKUJI_RESULTS) {
      expect(typeof r.grade).toBe('string');
      expect(r.yomi).toMatch(/\(/);   // 요미 병기(P9-1)
      expect(typeof r.ko).toBe('string');
      expect(typeof r.line).toBe('string');
      // "가장 좋은/최고 등급/1등" 같은 서열 단정 금지(광맥 3 — 전국 통일 순서 없음).
      expect(r.line).not.toMatch(/가장 (좋|높)|최고 등급|1등|제일 (좋|높)/);
    }
  });
  it('균등 분포 — 다수 시행에서 6종이 모두 나온다', () => {
    const seen = new Set();
    let s = 12345;
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    for (let i = 0; i < 500; i++) seen.add(drawOmikuji(rnd).grade);
    expect(seen.size).toBe(OMIKUJI_RESULTS.length);
  });
});

describe('대화 스크립트 무결성(라멘·신사·편의점·이자카야)', () => {
  it('네 스크립트가 존재하고 label·steps 를 갖는다', () => {
    for (const key of ['ramen', 'shrine', 'konbini', 'izakaya']) {
      const s = getNpcScript(key);
      expect(s).toBeTruthy();
      expect(typeof s.label).toBe('string');
      expect(Array.isArray(s.steps)).toBe(true);
      expect(s.steps.length).toBeGreaterThanOrEqual(4);
    }
    expect(getNpcScript('nope')).toBeNull();
  });

  it('스텝 t 는 허용된 종류만, ask 는 정답이 정확히 하나(choice) 또는 accept(type)', () => {
    const allowed = new Set(['narr', 'say', 'ask', 'omikuji']);
    for (const s of Object.values(NPC_SCRIPTS)) {
      let askCount = 0;
      for (const st of s.steps) {
        expect(allowed.has(st.t)).toBe(true);
        if (st.t === 'ask') {
          askCount += 1;
          if (st.mode === 'choice') {
            const correct = st.choices.filter((c) => c.correct);
            expect(correct).toHaveLength(1);
          } else {
            expect(st.mode).toBe('type');
            expect(Array.isArray(st.accept)).toBe(true);
            expect(st.accept.length).toBeGreaterThan(0);
          }
        }
      }
      // 문항 2~3개(선택지+타이핑 혼합).
      expect(askCount).toBeGreaterThanOrEqual(2);
      expect(askCount).toBeLessThanOrEqual(3);
    }
  });

  it('라멘 대화는 챕터 ot-10 표현(替え玉·バリカタ)을 그대로 쓴다', () => {
    const flat = JSON.stringify(NPC_SCRIPTS.ramen);
    expect(flat).toContain('替え玉');
    expect(flat).toContain('バリカタ');
    expect(flat).toContain('食券');
  });

  it('라멘 서사는 고정 점포 — 포장마차(屋台) 언급 없음(야타이는 식권기 관행과 모순, Codex P1-2)', () => {
    const flat = JSON.stringify(NPC_SCRIPTS.ramen);
    expect(flat).not.toContain('포장마차');
    expect(flat).not.toContain('屋台');
    expect(flat).not.toContain('야타이');
  });

  it('신사 대화는 챕터 ot-09 표현(二礼二拍手一礼·ご縁·おみくじ)을 쓰고 omikuji 스텝을 포함', () => {
    const flat = JSON.stringify(NPC_SCRIPTS.shrine);
    expect(flat).toContain('二礼二拍手一礼');
    expect(flat).toContain('ご縁');
    expect(flat).toContain('おみくじ');
    expect(NPC_SCRIPTS.shrine.steps.some((s) => s.t === 'omikuji')).toBe(true);
  });

  it('편의점 대화는 챕터 ot-07 표현(お願いします·大丈夫です·肉まん)을 쓴다', () => {
    const s = getNpcScript('konbini');
    expect(s).toBeTruthy();
    expect(s.steps.length).toBeGreaterThanOrEqual(4);
    const flat = JSON.stringify(s);
    expect(flat).toContain('おねがいします');   // 받을 때 만능 대답
    expect(flat).toContain('大丈夫です');        // 사양(type 정답)
    expect(flat).toContain('肉まん');            // 편의점 소재(챕터 정합)
  });

  it('이자카야 대화는 챕터 ot-08 표현(お通し·とりあえず生で·すみません)을 쓴다', () => {
    const s = getNpcScript('izakaya');
    expect(s).toBeTruthy();
    expect(s.steps.length).toBeGreaterThanOrEqual(4);
    const flat = JSON.stringify(s);
    expect(flat).toContain('お通し');            // 유료 기본 안주(정체)
    expect(flat).toContain('とりあえず生で');     // 국민 첫 주문(choice 정답)
    expect(flat).toContain('すみません');        // 점원 부르기(type 정답)
  });

  it('선택지(choice)와 타이핑(type)이 둘 다 등장(입력 2단 병행)', () => {
    for (const s of Object.values(NPC_SCRIPTS)) {
      const modes = s.steps.filter((st) => st.t === 'ask').map((st) => st.mode);
      expect(modes).toContain('choice');
      expect(modes).toContain('type');
    }
  });
});
