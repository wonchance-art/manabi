import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getJaRef, formatJaRef, getJaWarn } from '../jaRef.js';

// 계약: 한자 대조 2단계 — 일본어 대응(ja)은 meanings jsonb 안 관례 필드로 저장되고,
// 표시 형태는 세 가지(표기 다름·표기 같음·대응어 diff)뿐이다. null=대응 없음 판정,
// 키 부재=미판정 레거시 — 이 구분이 백필(needsZhJaBackfill)의 근거다.

describe('getJaRef — 사전 행에서 ja 추출', () => {
  it('아무 뜻 항목의 ja든 첫 발견을 쓴다(승격이 순서를 바꿔도 무관)', () => {
    expect(getJaRef({ meanings: [{ meaning: '일' }, { meaning: '일하다', ja: { form: '仕事', yomi: 'しごと' } }] }))
      .toEqual({ form: '仕事', yomi: 'しごと' });
  });

  it('판정 완료·대응 없음(null)은 null, 미판정은 undefined', () => {
    expect(getJaRef({ meanings: [{ meaning: '~의', ja: null }] })).toBeNull();
    expect(getJaRef({ meanings: [{ meaning: '계획' }] })).toBeUndefined();
    expect(getJaRef(null)).toBeUndefined();
  });
});

describe('formatJaRef — 표시 문자열', () => {
  it('신자체 표기가 다르면 form(yomi)', () => {
    expect(formatJaRef({ form: '図書館', yomi: 'としょかん' }, '图书馆')).toBe('図書館(としょかん)');
  });

  it('표기가 같으면 요미만(반복 제거)', () => {
    expect(formatJaRef({ form: '学校', yomi: 'がっこう' }, '学校')).toBe('がっこう');
  });

  it('어형이 글자별 일본식 나열(jaWordForm)과 같으면 요미만 — 훈음 줄과 중복 제거(배치 개선)', () => {
    const ja = { form: '図書館', yomi: 'としょかん', diff: false };
    expect(formatJaRef(ja, '图书馆', '図書館')).toBe('としょかん');
    expect(formatJaRef(ja, '图书馆')).toBe('図書館(としょかん)'); // 파라미터 없으면 기존 동작
    expect(formatJaRef(ja, '图书馆', '図書舘')).toBe('図書館(としょかん)'); // 불일치는 어형 유지
  });

  it('대응어(diff)는 ≒ 접두', () => {
    expect(formatJaRef({ form: '先生', yomi: 'せんせい', diff: true }, '老师')).toBe('≒先生(せんせい)');
  });

  it('대응 없음·미판정·형식 불량은 null(표시 생략)', () => {
    expect(formatJaRef(null, '的')).toBeNull();
    expect(formatJaRef(undefined, '计划')).toBeNull();
    expect(formatJaRef({ form: '', yomi: 'x' }, 'x')).toBeNull();
    expect(formatJaRef({ form: 'x' }, 'x')).toBeNull();
  });
});

describe('getJaWarn — 동형이의어 경고(3단계)', () => {
  it('warn이 있으면 그 뜻, null·부재·불량은 null', () => {
    expect(getJaWarn({ form: '自動車', yomi: 'じどうしゃ', diff: true, warn: '기차' })).toBe('기차');
    expect(getJaWarn({ form: '図書館', yomi: 'としょかん', warn: null })).toBeNull();
    expect(getJaWarn({ form: '図書館', yomi: 'としょかん' })).toBeNull();
    expect(getJaWarn(null)).toBeNull();
    expect(getJaWarn({ warn: '   ' })).toBeNull();
  });
});

// 배선 계약 — 표시가 같은 옵트인(showHanjaKo) 아래에서만, 백필이 미싱 경로에 연결돼야 한다.
describe('ja 대응 배선 계약', () => {
  it('뷰어가 대조 토글 아래에서 사전 행 조회·표시·경고를 배선한다', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/views/ViewerPage.jsx'), 'utf8');
    expect(src).toContain('getJaRef(editDictEntry)');
    // 팝업 전용 사전 행 조회는 카드 단일화(②)로 소멸 — 리스트 단어도 editDictEntry 경로
    expect(src).not.toContain('popupDictEntry');
    expect(src).toContain('getJaWarn(ja)');
    expect(src).toMatch(/isEditingToken \|\| \(showHanjaKo && materialLang === 'Chinese'\)/);
  });

  it('라우트가 ja 미판정 행을 백필 대상으로 배선한다', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/app/api/analyze/route.js'), 'utf8');
    expect(src).toContain('needsZhJaBackfill(entry)');
  });
});
