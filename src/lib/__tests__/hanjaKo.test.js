import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { applyDueum, readHanjaKo } from '../hanjaKo.js';

// 계약: 한자 대조(옵트인) 1단계 — 한국 한자음은 발음 앵커이지 뜻이 아니다(오너 확정).
// 어두 두음법칙 적용(노사·여자), 미등재 글자가 섞이면 표시 생략(null).

describe('applyDueum — 어두 두음법칙', () => {
  it('ㄹ+단모음 → ㄴ (로→노, 래→내, 루→누)', () => {
    expect(applyDueum('로')).toBe('노');
    expect(applyDueum('래')).toBe('내');
    expect(applyDueum('루')).toBe('누');
  });

  it('ㄹ+이중·전설 모음 → ㅇ (려→여, 료→요, 류→유, 리→이, 례→예)', () => {
    expect(applyDueum('려')).toBe('여');
    expect(applyDueum('료')).toBe('요');
    expect(applyDueum('류')).toBe('유');
    expect(applyDueum('리')).toBe('이');
    expect(applyDueum('례')).toBe('예');
  });

  it('ㄴ+이중·전설 모음 → ㅇ (녀→여, 뉴→유, 니→이)', () => {
    expect(applyDueum('녀')).toBe('여');
    expect(applyDueum('뉴')).toBe('유');
    expect(applyDueum('니')).toBe('이');
  });

  it('그 외 음절과 비한글은 그대로', () => {
    expect(applyDueum('노')).toBe('노');
    expect(applyDueum('사')).toBe('사');
    expect(applyDueum('가')).toBe('가');
    expect(applyDueum('a')).toBe('a');
  });

  it('받침을 보존한다 (림→임, 락→낙)', () => {
    expect(applyDueum('림')).toBe('임');
    expect(applyDueum('락')).toBe('낙');
  });
});

describe('readHanjaKo — 단어 한자음 합성', () => {
  const table = { 老: '로', 师: '사', 女: '녀', 子: '자', 旅: '려', 行: '행', 道: '도', 路: '로', 料: '료', 理: '리' };

  it('어두에만 두음법칙 — 老师→노사, 女子→여자, 旅行→여행', () => {
    expect(readHanjaKo('老师', table)).toBe('노사');
    expect(readHanjaKo('女子', table)).toBe('여자');
    expect(readHanjaKo('旅行', table)).toBe('여행');
    expect(readHanjaKo('料理', table)).toBe('요리');
  });

  it('비어두 ㄹ은 유지 — 道路→도로', () => {
    expect(readHanjaKo('道路', table)).toBe('도로');
  });

  it('미등재 글자가 섞이면 null(부분 표기는 앵커로 해롭다)', () => {
    expect(readHanjaKo('老X', table)).toBeNull();
    expect(readHanjaKo('', table)).toBeNull();
    expect(readHanjaKo('老师', null)).toBeNull();
  });
});

// 생성 데이터 상시 검증 — 재생성이 표를 깨뜨리면 여기서 잡힌다.
describe('hanjaKo.json 생성 데이터', () => {
  const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/lib/data/hanjaKo.json'), 'utf8'));

  it('간체·정체 표본이 올바른 한자음을 갖는다', () => {
    expect(data['老']).toBe('로');
    expect(data['师']).toBe('사');   // 간체 직접 수록
    expect(data['師']).toBe('사');   // 정체
    expect(data['图']).toBe('도');
    expect(data['学']).toBe('학');
    expect(data['汉']).toBe('한');
  });

  it('메인 블록 커버리지가 2만 자 이상이다', () => {
    expect(Object.keys(data).length).toBeGreaterThan(20000);
  });
});

// 배선 계약: 옵트인 전제 — 기본 꺼짐, 중국어 뷰어에서만 토글 노출.
describe('한자 대조 배선 계약', () => {
  it('설정 기본값이 꺼짐(false)이다', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/lib/useViewerSettings.js'), 'utf8');
    expect(src).toContain("readPref('showHanjaKo', false)");
  });

  it('뷰어가 중국어에서만 토글을 노출하고 시트에 한자음을 표시한다', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/views/ViewerPage.jsx'), 'utf8');
    expect(src).toMatch(/materialLang === 'Chinese' && \(\s*<button\s*onClick=\{\(\) => setShowHanjaKo/);
    expect(src).toContain("import('../lib/data/hanjaKo.json')");
    expect(src).toContain('한자음');
  });
});
