import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { applyDueum, readHanjaKo, hanjaHunEum, listHanjaHunEum, hunsCoverWord, toJaForm } from '../hanjaKo.js';

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

describe('hanjaHunEum·listHanjaHunEum — 훈음 병기(①)', () => {
  const ko = { 老: '로', 师: '사', 先: '선', 生: '생' };
  const hun = { 老: '늙을', 师: '스승', 先: '먼저' };

  it("옥편 표제 관례 — 두음 변형이 있으면 괄호 병기: '늙을 로(노)'", () => {
    expect(hanjaHunEum('老', ko, hun)).toBe('늙을 로(노)');
  });

  it('두음 변형이 없으면 그대로: 스승 사', () => {
    expect(hanjaHunEum('师', ko, hun)).toBe('스승 사');
  });

  it('훈 또는 음 미등재면 null', () => {
    expect(hanjaHunEum('生', ko, hun)).toBeNull(); // 훈 없음
    expect(hanjaHunEum('老', null, hun)).toBeNull();
    expect(hanjaHunEum('老', ko, null)).toBeNull();
  });

  it('단어 나열은 훈 있는 글자만 담고, 전무하면 null', () => {
    expect(listHanjaHunEum('老师', ko, hun)).toEqual([
      { ch: '老', label: '늙을 로(노)' },
      { ch: '师', label: '스승 사' },
    ]);
    expect(listHanjaHunEum('先生', ko, hun)).toEqual([
      { ch: '先', label: '먼저 선' },
    ]);
    expect(listHanjaHunEum('生', ko, hun)).toBeNull();
    expect(listHanjaHunEum('', ko, hun)).toBeNull();
  });

  it('전 글자 커버 판정 — 커버 시 한자음 단독 표기는 중복(오너 확정), 부분 커버는 유지', () => {
    expect(hunsCoverWord('老师', listHanjaHunEum('老师', ko, hun))).toBe(true);
    expect(hunsCoverWord('先生', listHanjaHunEum('先生', ko, hun))).toBe(false); // 生 훈 없음
    expect(hunsCoverWord('生', null)).toBe(false);
    expect(hunsCoverWord('', null)).toBe(false);
  });

  it('toJaForm — 일본식 자형 변환(미등재·무테이블은 그대로)', () => {
    const jaT = { 师: '師', 图: '図' };
    expect(toJaForm('老师', jaT)).toBe('老師');
    expect(toJaForm('图', jaT)).toBe('図');
    expect(toJaForm('学生', jaT)).toBe('学生');
    expect(toJaForm('老师', null)).toBe('老师');
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

// 훈 오버레이 생성 데이터(①) — libhangul 훈음 + kTraditionalVariant 간체 상속.
describe('hanjaHun.json 생성 데이터', () => {
  const hun = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/lib/data/hanjaHun.json'), 'utf8'));

  it('정체 직접 수록 + 간체 상속 표본', () => {
    expect(hun['老']).toBe('늙을');   // 두음형(노) 행 우선 규칙 — '늙은이'가 아니라 '늙을'
    expect(hun['師']).toBe('스승');   // 정체 직접
    expect(hun['师']).toBe('스승');   // 간체 ← 師 상속
    expect(hun['學']).toBe('배울');
    expect(hun['学']).toBe('배울');   // 간체 ← 學 상속
    expect(hun['让']).toBe('사양할'); // 간체 ← 讓 상속
  });

  it('훈은 hanjaKo.json 등재 글자에만 붙는 오버레이고, 8천 자 이상이다', () => {
    const ko = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/lib/data/hanjaKo.json'), 'utf8'));
    const keys = Object.keys(hun);
    expect(keys.length).toBeGreaterThan(8000);
    expect(keys.every((ch) => ko[ch])).toBe(true);
  });
});

// 일본식 자형 오버레이(오너 확정) — 간체→정체(kTV)→신자체(OpenCC 402쌍), 자형 상이만 수록.
describe('hanjaJa.json 생성 데이터', () => {
  const ja = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/lib/data/hanjaJa.json'), 'utf8'));

  it('신자체·정체 폴백 표본', () => {
    expect(ja['师']).toBe('師');   // 일본은 정체형 유지
    expect(ja['图']).toBe('図');   // 간체→정체→신자체
    expect(ja['让']).toBe('譲');
    expect(ja['广']).toBe('広');
    expect(ja['单']).toBe('単');
    expect(ja['译']).toBe('訳');
    expect(ja['发']).toBe('発');
    expect(ja['們'] ?? ja['们']).toBe('們'); // 일본 비상용은 정체 폴백
    expect(ja['學']).toBe('学');   // 본문이 구자체로 온 경우
  });

  it('동형 글자는 미수록(diff-only) — 신자체=간체(学)·왕복 동형(台)·공통 자형(老)', () => {
    expect(ja['学']).toBeUndefined();
    expect(ja['台']).toBeUndefined();
    expect(ja['老']).toBeUndefined();
    expect(Object.entries(ja).every(([k, v]) => k !== v)).toBe(true);
  });

  it('hanjaKo 등재 글자에만 붙는 오버레이고 2,500자 이상이다', () => {
    const ko = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/lib/data/hanjaKo.json'), 'utf8'));
    const keys = Object.keys(ja);
    expect(keys.length).toBeGreaterThan(2500);
    expect(keys.every((ch) => ko[ch])).toBe(true);
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

  it('훈음(①)도 같은 토글 아래 지연 로드되어 단어 카드에 병기된다(팝업은 ②로 카드 단일화)', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/views/ViewerPage.jsx'), 'utf8');
    expect(src).toContain("import('../lib/data/hanjaHun.json')");
    expect(src).toContain('listHanjaHunEum');
    expect(src).toMatch(/hanjaHunOf\(selectedToken\.text\)/);
    // 팝업 부활 금지 — 리스트 단어도 같은 카드 한 벌을 쓴다(오너 승인 ②)
    expect(src).not.toContain('popupWord');
  });

  it('훈음이 전 글자를 커버하면 한자음 단독 줄을 생략한다(오너 확정)', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/views/ViewerPage.jsx'), 'utf8');
    expect(src).toMatch(/hunsCoverWord\(selectedToken\.text, huns\) \? null : hanjaKoOf\(selectedToken\.text\)/);
  });

  it('일본식 자형 표기(오너 확정) — 훈음 글자는 신자체 단독, 日 어형은 나열과 같으면 요미만, ⚠는 日 줄 통합', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/views/ViewerPage.jsx'), 'utf8');
    expect(src).toContain("import('../lib/data/hanjaJa.json')");
    expect(src).toMatch(/jaFormOf\(ch\)/);
    expect(src).toMatch(/formatJaRef\(ja, selectedToken\.text, jaFormOf\(selectedToken\.text\)\)/);
    expect(src).toMatch(/⚠ \{jaFormOf\(selectedToken\.text\)\}는 일본어로/);
  });

  it('배치 개선 — 대조 블록은 헤더가 아니라 뜻 아래에 있다', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/views/ViewerPage.jsx'), 'utf8');
    const meaningAt = src.indexOf("refMeaning || selectedToken.meaning || '(뜻 없음)'");
    const blockAt = src.indexOf('한자 대조 블록(배치 개선');
    expect(meaningAt).toBeGreaterThan(-1);
    expect(blockAt).toBeGreaterThan(meaningAt);
  });
});
