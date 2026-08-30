import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeAnswer, normalizeRecall } from '../answerNormalize.js';
import { gradeDictation, normalizeDictation } from '../dictation.js';
import { gradeTyping } from '../studySession.js';

/**
 * 계약: v2-M 입력 관용성 (#1077 설계, 오너 확정 2026-08-30 — L 다음 순번).
 * 설계 §3의 4계약을 그대로 심는다: ① 일본어 파괴 방지 ② 인출 폴딩 ③ 받아쓰기
 * 폴딩 미적용 ④ 정규화 정본 1본(경로별 재구현 금지 — 3종 → 1종 수렴).
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

describe('① 일본어 파괴 방지 — 탁점·반탁점은 별개 음소', () => {
  it('が≠か, ぱ≠は — 인출 모드 폴딩이 가나 결합 부호를 건드리지 않는다', () => {
    expect(normalizeRecall('が')).not.toBe(normalizeRecall('か'));
    expect(normalizeRecall('ぱ')).not.toBe(normalizeRecall('は'));
    // NFD 분해 입력이 와도 NFC로 재합성될 뿐 탁점이 사라지지 않는다
    expect(normalizeRecall('が')).toBe('が');
  });
});

describe('② 인출 폴딩 — 악상·성조 없이 쳐도 정답', () => {
  it('prefere = préfère, hanyu = hànyǔ (설계 §0의 실증 사례)', () => {
    expect(normalizeRecall('prefere')).toBe(normalizeRecall('préfère'));
    expect(normalizeRecall('hanyu')).toBe(normalizeRecall('hànyǔ'));
  });

  it('병음 공백·다중 결합 부호(ǚ)·대문자도 관용 — canjia = cān jiā, nu = nǚ', () => {
    expect(normalizeRecall('canjia')).toBe(normalizeRecall('cān jiā'));
    expect(normalizeRecall('nu')).toBe(normalizeRecall('nǚ'));
    expect(normalizeRecall('PREFERE!')).toBe(normalizeRecall('préfère'));
  });

  it('어휘 타이핑(gradeTyping)이 폴딩을 탄다 — 성조 없는 병음·악상 없는 불어 정답 처리', () => {
    expect(gradeTyping('hanyu', { word_text: '汉语', furigana: 'hàn yǔ' })).toBe(true);
    expect(gradeTyping('prefere', { word_text: 'préfère' })).toBe(true);
  });

  it('관용은 부호·공백까지 — 다른 낱말은 여전히 오답', () => {
    expect(normalizeRecall('ecole')).not.toBe(normalizeRecall('écoles'));
    expect(gradeTyping('hanyui', { word_text: '汉语', furigana: 'hàn yǔ' })).toBe(false);
  });
});

describe('③ 받아쓰기 — 철자 모드, 폴딩 미적용', () => {
  it('normalizeDictation은 악상·성조를 보존한다', () => {
    expect(normalizeDictation('préfère', 'French')).toBe('préfère');
    expect(normalizeDictation('hànyǔ', 'Chinese')).toBe('hànyǔ');
  });

  it('부호만 다른 오답은 correct:false + accentOnly:true — 관용 대신 짚어 준다', () => {
    const r = gradeDictation('Je préfère le thé.', 'je prefere le the', 'French');
    expect(r.correct).toBe(false);
    expect(r.accentOnly).toBe(true);
  });

  it('진짜 오답(낱말 상이·누락)은 accentOnly:false', () => {
    expect(gradeDictation('Je préfère le thé.', 'je prefere le cafe', 'French').accentOnly).toBe(false);
    expect(gradeDictation('雨が降る', '雨か降る', 'Japanese').accentOnly).toBe(false); // が≠か는 받아쓰기에서도 오답
  });
});

describe('④ 정본 1본 — 경로별 재구현 금지(3종 → 1종 수렴)', () => {
  it('세 소비처가 전부 정본을 물고, 옛 재구현 흔적이 없다', () => {
    const study = read('src/lib/studySession.js');
    expect(study).toContain("import { normalizeRecall } from './answerNormalize'");
    expect(study).toContain('return normalizeRecall(s);');

    const dict = read('src/lib/dictation.js');
    expect(dict).toContain("import { normalizeAnswer } from './answerNormalize'");
    expect(dict).not.toMatch(/PUNCT_RE/); // 옛 로컬 구두점 셋 소멸 — 정본이 진다

    const engine = read('src/components/ExerciseEnginePrototype.jsx');
    expect(engine).toContain("import { normalizeRecall } from '../lib/answerNormalize'");

    const drills = read('src/components/ChapterDrills.jsx');
    expect(drills).toContain("import { normalizeRecall } from '../lib/answerNormalize'");
    expect(drills).not.toMatch(/dictNormalize/); // loose 재구현 소멸
  });

  it('채점 라인이 정본 인출 모드를 쓴다 — identity용 normalizeExerciseAnswer로의 회귀 금지', () => {
    const engine = read('src/components/ExerciseEnginePrototype.jsx');
    expect(engine).toMatch(/const normalized = normalizeRecall\(response\);/);
    expect(engine).toMatch(/\.some\(\(candidate\) => normalizeRecall\(candidate\) === normalized\)/);
  });
});
