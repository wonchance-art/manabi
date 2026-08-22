import { describe, expect, it } from 'vitest';
import { NPC_SCRIPTS } from '../npcScripts.js';
import { scriptEncounterRefs, stepEncounterRefs } from '../vocabEncounters.js';
import { JAPANESE_VOCAB_REF } from '../../../lib/japaneseVocabRegistry.js';

// 🈁 만남 주석 계약(rfc-vocab-encounter §4.1) — 전 스크립트 전수 검사.
//   계약 1(실재): refs·answerRefs·assumedRefs의 모든 표기는 정본 레지스트리에 존재해야 한다
//     (문법 챕터 slug 목록 대조와 같은 환각 차단 패턴).
//   계약 2(배운 표현 그대로 — 마스터플랜 A-1의 계약화): ask의 answerRefs는
//     같은 스크립트의 '앞선' 스텝 refs이거나 기반 챕터 전제(assumedRefs)여야 한다.
//   R1 범위: 정본 대조가 가능한 lang='ja'만 refs를 가질 수 있다(fr/zh는 트랙 정본 연결 후 완화).

function scriptsWithRefs() {
  return Object.entries(NPC_SCRIPTS).filter(([, s]) => (
    (Array.isArray(s.assumedRefs) && s.assumedRefs.length > 0)
    || (s.steps || []).some((st) => stepEncounterRefs(st).length > 0)
  ));
}

describe('만남 주석 구조', () => {
  it('refs를 가진 스크립트는 lang을 선언해야 하고, R1에서는 ja만 허용한다', () => {
    for (const [key, s] of scriptsWithRefs()) {
      expect(s.lang, `${key}: refs가 있으면 lang 필수`).toBe('ja');
    }
  });

  it('refs·answerRefs·assumedRefs는 비어 있지 않은 문자열 배열이다', () => {
    for (const [key, s] of Object.entries(NPC_SCRIPTS)) {
      const lists = [['assumedRefs', s.assumedRefs]];
      (s.steps || []).forEach((st, i) => {
        lists.push([`steps[${i}].refs`, st.refs], [`steps[${i}].answerRefs`, st.answerRefs]);
      });
      for (const [label, list] of lists) {
        if (list === undefined) continue;
        expect(Array.isArray(list), `${key} ${label}: 배열이어야 한다`).toBe(true);
        for (const w of list) {
          expect(typeof w === 'string' && w.length > 0, `${key} ${label}: 빈 문자열 금지`).toBe(true);
        }
      }
    }
  });

  it('answerRefs는 ask 스텝에만 저작한다', () => {
    for (const [key, s] of Object.entries(NPC_SCRIPTS)) {
      (s.steps || []).forEach((st, i) => {
        if (st.answerRefs !== undefined) {
          expect(st.t, `${key} steps[${i}]: answerRefs는 ask 전용`).toBe('ask');
        }
      });
    }
  });
});

describe('계약 1 — 모든 표기는 정본 사전에 실재한다', () => {
  it('refs·answerRefs·assumedRefs 전수', () => {
    for (const [key, s] of scriptsWithRefs()) {
      const all = new Set(s.assumedRefs || []);
      for (const st of s.steps || []) for (const w of stepEncounterRefs(st)) all.add(w);
      for (const w of all) {
        expect(JAPANESE_VOCAB_REF.findWord(w), `${key}: 「${w}」가 정본 레지스트리에 없다`).toBeTruthy();
      }
    }
  });
});

describe('계약 2 — 정답 발화는 배운 표현 그대로', () => {
  it('answerRefs ⊆ 앞선 스텝 refs ∪ assumedRefs', () => {
    for (const [key, s] of scriptsWithRefs()) {
      const learned = new Set(s.assumedRefs || []);
      (s.steps || []).forEach((st, i) => {
        for (const w of st.answerRefs || []) {
          expect(
            learned.has(w),
            `${key} steps[${i}]: 정답 표현 「${w}」는 앞선 스텝 refs나 assumedRefs에 있어야 한다`,
          ).toBe(true);
        }
        for (const w of stepEncounterRefs(st)) learned.add(w); // 이 스텝의 노출은 다음 스텝부터 '배운 것'
      });
    }
  });
});

describe('R1 저작 실측 고정 — 라멘·신사', () => {
  it('라멘: 食券·券売機·替え玉·お願いします·ごちそうさま를 만난다', () => {
    const refs = scriptEncounterRefs(NPC_SCRIPTS.ramen);
    for (const w of ['食券', '券売機', '替え玉', 'お願いします', 'ごちそうさま']) {
      expect(refs, `라멘 스크립트에 「${w}」 노출`).toContain(w);
    }
  });

  it('신사: 鳥居·賽銭·おみくじ·ください·縁을 만난다', () => {
    const refs = scriptEncounterRefs(NPC_SCRIPTS.shrine);
    for (const w of ['鳥居', '賽銭', 'おみくじ', 'ください', '縁']) {
      expect(refs, `신사 스크립트에 「${w}」 노출`).toContain(w);
    }
  });

  it('신규 정본 5어(食券·券売機·替え玉·おみくじ·賽銭)는 요미·뜻·품사·예문을 갖춘다', () => {
    for (const w of ['食券', '券売機', '替え玉', 'おみくじ', '賽銭']) {
      const hit = JAPANESE_VOCAB_REF.findWord(w);
      expect(hit, `${w} 정본 존재`).toBeTruthy();
      expect(hit.level, `${w}는 N5 병합(culture_core)`).toBe('N5');
      expect(hit.word.yomi, `${w} 요미`).toBeTruthy();
      expect(hit.word.ko, `${w} 뜻`).toBeTruthy();
      expect(hit.word.pos, `${w} 품사`).toBeTruthy();
      expect(hit.word.ex?.ja && hit.word.ex?.yomi && hit.word.ex?.ko, `${w} 예문 3요소`).toBeTruthy();
    }
  });
});
