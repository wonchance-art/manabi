import {viewerDefaults} from '../viewerPreferences';
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { applyDueum, readHanjaKo, hanjaHunEum, listHanjaHunEum, toJaForm, hanjaReadingsOf, toTraditional, koLookupForms } from '../hanjaKo.js';
import { sliceBetween } from './helpers/sliceBetween.js';

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
  const ko = { 老: '로', 师: '사', 先: '선', 生: '생', 路: '로' };
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

  it('단어 나열 — 훈 있는 글자는 훈음, 훈 없는 글자도 음만으로 편입한다(음 단독 줄 폐지 대체)', () => {
    expect(listHanjaHunEum('老师', ko, hun)).toEqual([
      { ch: '老', label: '늙을 로(노)' },
      { ch: '师', label: '스승 사' },
    ]);
    expect(listHanjaHunEum('先生', ko, hun)).toEqual([
      { ch: '先', label: '먼저 선' },
      { ch: '生', label: '생' }, // 훈 미등재 → 음만이라도 편입
    ]);
    expect(listHanjaHunEum('生', ko, hun)).toEqual([{ ch: '生', label: '생' }]);
  });

  it('음만 라벨도 두음 병기 관례를 따르고, 음까지 미등재면 조용히 생략·전무하면 null', () => {
    expect(listHanjaHunEum('路', ko, hun)).toEqual([{ ch: '路', label: '로(노)' }]);
    expect(listHanjaHunEum('X', ko, hun)).toBeNull();
    expect(listHanjaHunEum('老X', ko, hun)).toEqual([{ ch: '老', label: '늙을 로(노)' }]);
    expect(listHanjaHunEum('', ko, hun)).toBeNull();
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

  it('음 교정(3층 보수) — 간체 동형 충돌은 정체 계보 음으로, 수기 교정 우선', () => {
    expect(data['达']).toBe('달');   // npm 원본 '체'(별자 계보) → 達
    expect(data['关']).toBe('관');   // '소' → 關
    expect(data['灯']).toBe('등');   // '정' → 燈
    expect(data['识']).toBe('식');   // '신' → 識
    expect(data['撕']).toBe('시');   // 수기: 이독 '서' → 옥편 표제 '시'
    expect(data['苧']).toBe('저');   // 수기: ST 오매핑(薴 '녕') 차단 — 모시 저 유지
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

  it('훈 보수(3층) — 한국 정자 이체 경유·전 항목 파서·음 교정 연동·수기 오버레이', () => {
    expect(hun['清']).toBe('맑을');   // 한국 정자 淸 경유(유니코드 분리 이체)
    expect(hun['教']).toBe('가르칠'); // 敎 경유 + 수기 대표 훈
    expect(hun['真']).toBe('참');     // 眞 경유
    expect(hun['床']).toBe('평상');   // "牀의 俗字, 평상 상" — 전 항목 파서가 둘째 항목 채택
    expect(hun['湿']).toBe('젖을');   // ST 어원형(溼) → 濕 이체 경유
    expect(hun['达']).toBe('통달할'); // 음 교정(달)과 연동된 상속
    expect(hun['撕']).toBe('찢을');   // 수기 저작(찢을 시)
    expect(hun['你']).toBe('너');     // 수기 저작(너 니)
    expect(hun['怜']).toBe('가련할'); // 자체 행 오식('연리할')을 수기 대표가 대체
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
    // 예외는 보존 표식뿐(2026-10-07 KST 다대일 오류 수정): 일본 표준 한자 중 번체 경유
    // 사슬이 다른 글자로 닿는 것(面 → 麵 → 麺)만 자기 자신으로 적어 글자 카드 사슬을 멈춘다.
    expect(Object.entries(ja).filter(([k, v]) => k === v).map(([k]) => k).join('')).toBe('庄征据斗系面');
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
    expect(viewerDefaults('Chinese').showHanjaKo).toBe(false);
  });

  it('뷰어가 중국어에서만 토글을 노출하고 시트에 훈음을 표시한다', () => {
    const options=fs.readFileSync(path.join(process.cwd(),'src/components/viewer/ViewerSettings.jsx'),'utf8'); expect(options).toContain("language==='Chinese'&&");expect(options).toContain('label="한자 대조"');expect(options).toContain("set('showHanjaKo',v)");const src=fs.readFileSync(path.join(process.cwd(),'src/views/ViewerPage.jsx'),'utf8');expect(src).toContain("import('../lib/data/hanjaKo.json')");
  });

  it('훈음(①)도 같은 토글 아래 지연 로드되어 단어 카드에 병기된다(팝업은 ②로 카드 단일화)', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/views/ViewerPage.jsx'), 'utf8');
    expect(src).toContain("import('../lib/data/hanjaHun.json')");
    // AE-R1 개정(VIEWER-V2-ROUNDS-001 §2.1 훈음 루비, 설계서 §7.2): 단어창 훈음은 별도 목록(listHanjaHunEum) 대신
    // 루비 셀(hunRubyCells → hanjaReadingsOf, R0+ 단일 조회)
    expect(src).toContain('hunRubyCells');
    expect(src).toMatch(/hanjaHunOf\(headText\)/); // R R2: 훈음은 표제어(기본형) 글자 기준
    // 팝업 부활 금지 — 리스트 단어도 같은 카드 한 벌을 쓴다(오너 승인 ②)
    expect(src).not.toContain('popupWord');
  });

  it("음 단독 줄은 폐지 — 뷰어에 '한자음' 표기·합성 경로가 없다(2026-08-23 오너 확정: 훈음 나열이 대체)", () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/views/ViewerPage.jsx'), 'utf8');
    expect(src).not.toContain('한자음');
    expect(src).not.toMatch(/hanjaKoOf|hunsCoverWord|readHanjaKo/);
  });

  // v2-S(2026-09-01)로 훈음 나열 줄이 폐지되면서 **글자별** `jaFormOf(ch)` 호출처가
  // 사라졌다. 훈음은 이제 표제어 글자(간체) 아래 루비로 붙으므로 나열이 자기 글자를
  // 다시 그릴 일이 없다. 글자별 신자체는 사라진 게 아니라 **글자 카드**로 옮겨 앉았고
  // (char-inspect의 日 칩 — 繁·简·正까지 함께, 탭 이동까지 된다) 단어 수준 대조는 日
  // 줄이 그대로 진다. 그래서 이 계약은 '어디서 신자체를 보는가'를 두 자리로 고정한다.
  // AE-R3 PR② 개정(설계서 §5·§7.1 — 대조 블록 props 단언 제거, 글자 카드 日 칩 단언만): 단어 수준 일본어는 자형 열
  // 日 줄(확인된 표기)과 더 알아보기 「일본어로는」 줄이 진다. 글자별 신자체(toJaForm · hanjaJa)는 글자 카드에만 남는다.
  it('일본식 자형 — 글자 카드 日 칩은 hanjaJa를 그대로 쓰고, 단어창은 글자 변환을 쓰지 않는다', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/views/ViewerPage.jsx'), 'utf8');
    expect(src).toContain("import('../lib/data/hanjaJa.json')");
    // 글자별 신자체 — 글자 카드 헤더의 자형 칩(탭하면 그 자형 카드로)
    expect(src).toMatch(/formChip\('日',/);
    expect(src).toMatch(/jaTable: hanjaJaTable/);
    expect(src).not.toContain('jaTable={hanjaJaTable}');
    expect(src).not.toMatch(/\btoJaForm\s*\(/);
    expect(fs.existsSync(path.join(process.cwd(), 'src/components/viewer/ViewerJapaneseReference.jsx'))).toBe(false);
  });

  it('배치 — 「일본어로는」 줄(더 알아보기)은 헤더가 아니라 뜻 아래에 있다', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/views/ViewerPage.jsx'), 'utf8');
    const meaningAt = src.indexOf("refMeaning || selectedToken.meaning || '(뜻 없음)'");
    const lineAt = src.indexOf('<ViewerJapaneseMore');
    expect(meaningAt).toBeGreaterThan(-1);
    expect(lineAt).toBeGreaterThan(meaningAt);
  });
});

// R0+ — 훈음·한자음을 正 꼴로 찾기(VIEWER-V2-ROUNDS-001 §1, §10 '정체 조회 골든 · 2,474쌍 회귀').
// 간체 글자 그대로 찾으면 간체와 모양이 같은 옛 글자의 훈음이 나온다(技术 → '삽주뿌리 출').
// 중국어 단어는 OpenCC s2t로 바꾼 정체 꼴로 찾고, 한국 다음자 예외만 수기 표로 겹친다.
const readData = (f) => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/lib/data', f), 'utf8'));

describe('R0+ 正 꼴 훈음 조회', () => {
  const ko = readData('hanjaKo.json');
  const hun = readData('hanjaHun.json');
  const trad = readData('hanjaTrad.json');
  const labelsOf = (word) => (listHanjaHunEum(word, ko, hun, trad) || []).map((x) => x.label);

  it('골든 — 간체 동형 옛 글자 대신 정체 꼴의 훈음', () => {
    expect(labelsOf('技术')).toEqual(['재주 기', '재주 술']); // 지금: 삽주뿌리 출(朮)
    expect(labelsOf('价格')).toEqual(['값 가', '이를 격']); // 지금: 착할 개
    expect(labelsOf('广场')).toEqual(['넓을 광', '마당 장']); // 지금: 바윗집 엄
    expect(labelsOf('确实')).toEqual(['굳을 확', '열매 실']); // 지금: 확실할 학
    expect(labelsOf('证明')).toEqual(['증거 증', '밝을 명']); // 지금: 간할 정
    expect(labelsOf('工厂')).toEqual(['장인 공', '공장 창']); // 지금: 엄(훈 없음). 廠 훈은 어문회 대표훈 '공장'(HUN_MANUAL — libhangul '헛간')
  });

  it('골든 — 단어 단위 변환이 다음자를 푼다(음 기준)', () => {
    const eumAt = (word, i) => hanjaReadingsOf(word, { koTable: ko, hunTable: hun, tradTable: trad })[i].eum;
    expect(eumAt('干净', 0)).toBe('건'); // 乾
    expect(eumAt('干部', 0)).toBe('간'); // 幹
    expect(eumAt('一只', 1)).toBe('척'); // 隻 — 수량 구절(분석기가 한 토큰으로 낸다)
    expect(eumAt('只是', 0)).toBe('지'); // 只
    expect(eumAt('台风', 0)).toBe('태'); // 颱
    expect(eumAt('公里', 1)).toBe('리'); // 里(裏 아님)
  });

  it('골든 — 한국 다음자 예외(KO_WORD_FORMS)가 s2t 꼴보다 우선한다', () => {
    expect(labelsOf('音乐')[1]).toBe('풍류 악'); // s2t 音樂 → 樂 기본 음 '락'
    expect(labelsOf('老板')[1]).toBe('널조각 판'); // s2t 老闆 → 闆 '반'
    expect(labelsOf('抽烟')[1]).toBe('연기 연'); // s2t 抽菸 → 菸 '어'
    expect(labelsOf('借口')[0]).toBe('빌 차'); // s2t 藉口 → 藉 '자'
    expect(labelsOf('老板娘')[1]).toBe('널조각 판'); // 더 긴 단어 속에서도 그 자리만 겹친다
    // HSK 표제어 전수 감사에서 찾은 같은 부류(지금 맞는 음이 s2t로 틀어지는 단어)
    expect(labelsOf('乐器')[0]).toBe('풍류 악'); // 악기(樂 기본 음 '락')
    expect(labelsOf('快乐')[1]).toBe('즐길 락(낙)'); // 쾌락 — 예외 밖은 s2t 꼴 그대로
    expect(labelsOf('吸烟')[1]).toBe('연기 연'); // 흡연
    expect(labelsOf('苹果')[0]).toMatch(/ 평$/); // 평과(蘋 '빈' 아님)
  });

  it('toTraditional — OpenCC s2t 문자열 자체(AE-R3 正 줄·AE-R4 재사용), 예외는 조회에만', () => {
    expect(toTraditional('干净', trad)).toBe('乾淨');
    expect(toTraditional('干部', trad)).toBe('幹部');
    expect(toTraditional('一只', trad)).toBe('一隻');
    expect(toTraditional('只是', trad)).toBe('只是');
    expect(toTraditional('台风', trad)).toBe('颱風');
    expect(toTraditional('公里', trad)).toBe('公里');
    expect(toTraditional('技术', trad)).toBe('技術');
    expect(toTraditional('出租车', trad)).toBe('出租車'); // 대만 어휘(計程車)로 바꾸지 않는다 — 글자 꼴만
    expect(toTraditional('老板', trad)).toBe('老闆'); // 한국 예외는 정체 꼴을 바꾸지 않는다
    expect(toTraditional('音乐', trad)).toBe('音樂');
    expect(koLookupForms('老板', trad)).toEqual(['老', '板']);
    expect(toTraditional('技术', null)).toBe('技术'); // 표 미로드 = 원문
  });

  it('정체 표가 없으면(일본어·로딩 전) 지금처럼 글자 그대로 찾는다', () => {
    expect(listHanjaHunEum('台', ko, hun)).toEqual([{ ch: '台', label: hanjaHunEum('台', ko, hun) }]);
    expect(listHanjaHunEum('技术', ko, hun).map((x) => x.label)).toEqual(['재주 기', '삽주뿌리 출']);
    expect(hanjaReadingsOf('学習', { koTable: ko, hunTable: hun }).map((x) => x.label))
      .toEqual(listHanjaHunEum('学習', ko, hun).map((x) => x.label));
  });

  it('생성 데이터 — 출처·라이선스 머리, 구절 사전 전체가 아닌 부분 표, 예외는 수기 표 그대로', async () => {
    const { KO_WORD_FORMS, KR_VARIANTS, HUN_TRAD_UPGRADE } = await import('../../../scripts/hanja-curated.mjs');
    expect(trad._source).toMatch(/OpenCC/);
    expect(trad._source).toMatch(/Apache License 2\.0/);
    expect(Object.keys(trad.chars).length).toBeGreaterThan(2500);
    expect(Object.keys(trad.phrases).length).toBeLessThan(2000); // STPhrases 약 4.9만 행을 싣지 않는다
    expect(Object.entries(trad.chars).every(([k, v]) => k !== v && [...k].length === 1 && [...v].length === 1)).toBe(true);
    expect(Object.entries(trad.phrases).every(([k, v]) => [...k].length === [...v].length)).toBe(true);
    expect(trad.koForms).toEqual(KO_WORD_FORMS);
    expect(trad.krVariants).toEqual(KR_VARIANTS);
    expect(trad.hunUpgrade).toEqual([...HUN_TRAD_UPGRADE].sort());
  });
});

// 회귀 계약 — 우리 사전(src/content/chinese/vocab)의 한자어 표기(hanja 필드) 쌍.
// 쌍 = hanja 필드 첫 '한글(漢字)' 표기 중 한글·한자·중국어 표제어의 글자 수가 모두 같은 것,
// (표제어, 한글, 한자) 중복 제거 = 2,474쌍(2026-10-07 실측, 설계 세션 기준과 같은 수).
// 비교는 첫 음절 두음법칙을 양쪽 다 정규화한다(노판 = 로판 — 두음은 표시 관례이지 음 오류가 아니다).
describe('R0+ 회귀 — 우리 사전 한자어 표기 2,474쌍', () => {
  const ko = readData('hanjaKo.json');
  const hun = readData('hanjaHun.json');
  const trad = readData('hanjaTrad.json');
  const RE = /([가-힣]+)\(([\p{Script=Han}]+)\)/u;
  const same = (eums, want) => {
    if (eums.some((e) => !e)) return false;
    const a = [...eums.join('')];
    const b = [...want];
    if (a.length !== b.length) return false;
    a[0] = applyDueum(a[0]);
    b[0] = applyDueum(b[0]);
    return a.join('') === b.join('');
  };

  it('불일치 ≤ 44(간체 조회 123), 지금 맞는 단어 중 새로 틀리는 것 0', async () => {
    const dir = path.join(process.cwd(), 'src/content/chinese/vocab');
    const pairs = new Map();
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js')).sort()) {
      const mod = await import(`../../content/chinese/vocab/${f.replace(/\.js$/, '')}.js`);
      for (const theme of mod.default?.themes || []) for (const w of theme.words || []) {
        const m = w?.hanja && RE.exec(w.hanja);
        if (!m) continue;
        const [, hangul, hz] = m;
        if ([...hangul].length !== [...hz].length || [...hz].length !== [...w.zh].length) continue;
        pairs.set(`${w.zh}|${hangul}|${hz}`, { zh: w.zh, hangul });
      }
    }
    expect(pairs.size).toBeGreaterThanOrEqual(2474);
    const before = [];
    const after = [];
    const regressed = [];
    for (const { zh, hangul } of pairs.values()) {
      const oldOk = same([...zh].map((c) => ko[c]), hangul);
      const newOk = same(hanjaReadingsOf(zh, { koTable: ko, hunTable: hun, tradTable: trad }).map((x) => x.eum), hangul);
      if (!oldOk) before.push(zh);
      if (!newOk) after.push(zh);
      if (oldOk && !newOk) regressed.push(`${zh}(${hangul})`);
    }
    expect(regressed).toEqual([]);
    expect(after.length).toBeLessThanOrEqual(44);
    expect(before.length).toBeGreaterThan(after.length); // 간체 조회 123 → 正 꼴 44(실측)
  });
});

// 화면 악화 0 계약(R0+ 검수 2026-10-07) — 정체 꼴로 찾아도 음이 지금과 같은 계열이면 지금
// 라벨(간체 글자의 훈음)을 그대로 보인다. 같은 음에서 훈을 바꾸는 것은 검수 허용 쌍(hunUpgrade —
// 정체 훈이 한국어문회 대표훈과 같고 단어 뜻에 맞는 것)뿐이다. 근거: 같은 음에서 훈만 바뀌는 글자
// 전수표(HSK·우리 사전 표제어 95묶음) — 정체 훈을 그대로 쓰면 點 '더러울'·祕 '귀신' 같은 악화가 생긴다.
describe('R0+ 화면 악화 0 — 같은 음 글자는 지금 훈음 유지', () => {
  const ko = readData('hanjaKo.json');
  const hun = readData('hanjaHun.json');
  const trad = readData('hanjaTrad.json');
  const sameFamily = (a, b) => !!a && !!b && (a === b || applyDueum(a) === applyDueum(b));
  const now = (w) => hanjaReadingsOf(w, { koTable: ko, hunTable: hun });
  const next = (w) => hanjaReadingsOf(w, { koTable: ko, hunTable: hun, tradTable: trad });

  // 전수표에서 악화·둘 다 비표준·판정 보류로 남은 묶음(대표 단어 1개씩) — 지금 라벨 그대로여야 한다.
  const KEEP = [
    ['一点儿', 1, '검은 점 점'], // 點 더러울 점 · 둘 다 비표준(대표훈 '점')
    ['分离', 1, '산신 리(이)'], // 離 떼 놓을 리 · 둘 다 비표준
    ['但愿', 1, '정성 원'], // 願 하고자할 원 · 둘 다 비표준
    ['依据', 1, '가질 거'], // 據 의지할 거 · 둘 다 비표준
    ['不准', 1, '승인할 준'], // 準 수준기 준 · 둘 다 비표준
    ['乳制品', 1, '억제할 제'], // 製 만들 제 · 둘 다 비표준
    ['公布', 1, '베 포'], // 佈 펼칠 포 · 둘 다 비표준
    ['侵占', 1, '점칠 점'], // 佔 엿볼 점 · 판정 보류
    ['复习', 0, '돌아올 복'], // 複 겹옷 복 · 둘 다 비표준
    ['冲', 0, '깊을 충'], // 衝 충돌할 충 · 둘 다 비표준
    ['夹心面包', 2, '낯 면'], // 麪 밀가루 면 · 둘 다 비표준
    ['奥秘', 1, '숨길 비'], // 祕 귀신 비 · 악화
    ['喧闹', 1, '시끄러울 뇨(요)'], // 鬧 시끄러울 료(요) · 둘 다 비표준
    ['字迹', 1, '발자국 적'], // 跡 자취 적 · 둘 다 비표준
    ['签名', 0, '제비 첨'], // 簽 농 첨 · 둘 다 비표준
    ['上周', 1, '두루 주'], // 週 돌 주 · 둘 다 비표준
    ['依托', 1, '밀칠 탁'], // 託 맡길 탁 · 둘 다 비표준
    ['古朴', 1, '나무껍질 박'], // 樸 통나무 박 · 둘 다 비표준
    ['宽松', 1, '소나무 송'], // 鬆 터럭 더부룩할 송 · 판정 보류
    ['别致', 1, '이를 치'], // 緻 톡톡할 치 · 둘 다 비표준
    ['包扎', 1, '뺄 찰'], // 紮 감을 찰 · 둘 다 비표준
    ['妨碍', 1, '그칠 애'], // 礙 막을 애 · 둘 다 비표준
    ['宁可', 0, '편안할 녕(영)'], // 寧 편안할 령(영) · 둘 다 비표준
    ['庄严', 0, '장중할 장'], // 莊 엄할 장 · 둘 다 비표준
    ['建筑', 1, '비파 축'], // 築 다질 축 · 둘 다 비표준
    ['一塌糊涂', 3, '길 도'], // 塗 바를 도 · 둘 다 비표준
    ['事迹', 1, '발자국 적'], // 蹟 행적 적 · 둘 다 비표준
    ['反复', 1, '돌아올 복'], // 覆 뒤집힐 복 · 둘 다 비표준
    ['好家伙', 1, '집 가'], // 傢 세간 가 · 판정 보류
    ['栋梁', 1, '푸조나무 량(양)'], // 樑 서늘할 량 · 둘 다 비표준
    ['关系', 1, '이을 계'], // 係 걸릴 계 · 둘 다 비표준
    ['巨额', 0, '클 거'], // 鉅 갈고리 거 · 악화
    ['想象', 1, '코끼리 상'], // 像 형상 상 · 둘 다 비표준
    ['愈合', 0, '나을 유'], // 癒 병 나을 유 · 둘 다 비표준
    ['承诺', 1, '대답할 낙'], // 諾 대답할 락(낙) · 둘 다 비표준
    ['注册', 0, '물댈 주'], // 註 주낼 주 · 둘 다 비표준
    ['烧毁', 1, '헐 훼'], // 燬 불 훼 · 판정 보류
    ['胡子', 0, '턱밑살 호'], // 鬍 수염 호 · 판정 보류
    ['两栖', 1, '깃들일 서'], // 棲 살 서 · 악화
    ['仿佛', 0, '헤멜 방'], // 彷 거닐 방 · 둘 다 비표준
    ['克制', 0, '이길 극'], // 剋 깍일 극 · 악화
    ['别扭', 0, '나눌 별'], // 彆 활 뒤틀릴 별 · 판정 보류
    ['台风', 0, '별 태'], // 颱 몹시 부는 바람 태 · 둘 다 비표준
    ['哄堂大笑', 0, '떠들썩할 홍'], // 鬨 싸울 홍 · 둘 다 비표준
    ['山岭', 1, '산 이름 령(영)'], // 嶺 산고개 령 · 둘 다 비표준
    ['弥漫', 0, '두루 미'], // 瀰 물 넓을 미 · 둘 다 비표준
    ['扣人心弦', 3, '시위 현'], // 絃 줄풍류 현 · 둘 다 비표준
    ['抵触', 0, '밀칠 저'], // 牴 찌를 저 · 판정 보류
    ['挨打', 0, '밀칠 애'], // 捱 막을 애 · 판정 보류
    ['搜集', 0, '찾을 수'], // 蒐 꼭두서니 수 · 둘 다 비표준
    ['朱红', 0, '붉을 주'], // 硃 주사 주 · 판정 보류
    ['杰出', 0, '준걸 걸'], // 傑 호걸 걸 · 둘 다 비표준
    ['熏陶', 0, '연기 낄 훈'], // 薰 향불 훈 · 둘 다 비표준
    ['粮食', 0, '양식 량(양)'], // 糧 곡식 량 · 악화
    ['胡须', 1, '수염 수'], // 鬚 턱수염 수 · 악화
    ['萝卜', 1, '점 복'], // 蔔 무우 복 · 둘 다 비표준
    ['厘米', 0, '티끌 리(이)'], // 釐 다스릴 리 · 대표훈과 같으나 단어 뜻에 안 맞음
    ['家具', 1, '갖출 구'], // 俱 함께 구 · 대표훈과 같으나 단어 뜻에 안 맞음
    ['项链', 1, '쇠사슬 련(연)'], // 鍊 쇠불릴 련 · 대표훈과 같으나 단어 뜻에 안 맞음
    ['合伙', 1, '화'], // 夥 많을 과 — 글자 예외로 지금 음 유지(우리 사전 '동무 화')
  ];

  it('악화·비표준·보류 묶음은 지금 라벨 그대로', () => {
    for (const [word, i, label] of KEEP) {
      expect(now(word)[i].label, `${word} 지금`).toBe(label); // 목록 자체가 낡지 않았는지
      expect(next(word)[i].label, word).toBe(label);
    }
  });

  it('HSK·우리 사전 전 표제어 — 같은 음 칸은 허용 쌍 밖에서 라벨이 그대로', async () => {
    const words = new Set(Object.keys(readData('zhHskLevel.json')));
    const dir = path.join(process.cwd(), 'src/content/chinese/vocab');
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
      const mod = await import(`../../content/chinese/vocab/${f.replace(/\.js$/, '')}.js`);
      for (const theme of mod.default?.themes || []) for (const w of theme.words || []) if (w?.zh) words.add(w.zh);
    }
    const changed = [];
    for (const w of words) {
      const a = now(w);
      next(w).forEach((b, i) => {
        if (a[i].label === b.label || !sameFamily(a[i].eum, b.eum)) return;
        if (!trad.hunUpgrade.includes(a[i].ch + b.from)) changed.push(`${w}:${a[i].label}→${b.label}`);
      });
    }
    expect(changed).toEqual([]);
  });

  it('허용 쌍은 정체 훈으로 — 以后 뒤 후 · 这里 속 리 · 头发 터럭 발', () => {
    expect(next('以后')[1].label).toBe('뒤 후'); // 지금 '임금 후'
    expect(next('这里')[1].label).toBe('속 리(이)'); // 지금 '마을 리'
    expect(next('头发')[1].label).toBe('터럭 발'); // 지금 '쏠 발'
    expect(next('皇后')[1].label).toBe('임금 후'); // s2t가 后를 그대로 두면 그대로
    expect(next('光临')[1].label).toBe('임할 림(임)'); // 지금 '임할 임' — 본음 림(광림)
  });

  it('음이 바로잡히는 정체 글자의 훈은 어문회 대표훈(HUN_MANUAL)', () => {
    expect(hun['臺']).toBe('대');
    expect(next('舞台')[1].label).toBe('대 대'); // libhangul '능 대'
    expect(next('船只')[1].label).toBe('외짝 척'); // '새 한 마리 척'
    expect(next('几乎')[0].label).toBe('몇 기'); // '기미 기'
    expect(next('积极')[1].label).toBe('다할 극'); // '가운데 극'
    expect(next('合适')[1].label).toBe('맞을 적'); // '맞갖을 적'
    expect(next('关于')[1].label).toBe('어조사 어'); // '방향의 어조사 어'
    expect(next('吃饭')[0].label).toBe('먹을 끽'); // '마실 끽'
  });
});

// 소스 계약 — 세 경로(단어창 훈음·글자 카드·교실 판서)가 같은 조회 함수를 쓴다(§1 방향 5).
describe('R0+ 세 경로 단일 조회', () => {
  const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

  it('listHanjaHunEum·charDetail·teachingWordLayout이 모두 hanjaReadingsOf를 거친다', () => {
    const list = sliceBetween(read('src/lib/hanjaKo.js'), 'export function listHanjaHunEum', '\n}');
    expect(list).toContain('hanjaReadingsOf(');
    const detail = sliceBetween(read('src/lib/charInspect.js'), 'export function charDetail', '\n}');
    expect(detail).toContain('hanjaReadingsOf(');
    expect(detail).not.toMatch(/hanjaHunEum\(ch/); // 글자 단독 조회로 돌아가지 않는다
    const layout = read('src/lib/teachingWordLayout.js');
    expect(layout).toContain('hanjaReadingsOf(text');
    expect(layout).toMatch(/tradTable:language==='Chinese'\?trad:null/); // 일본어는 정체 변환 대상 아님
    expect(layout).not.toContain('listHanjaHunEum(text,ko,hun)');
  });

  it('뷰어는 중국어 단어창 훈음과 글자 카드에 같은 정체 표를 넘긴다', () => {
    const src = read('src/views/ViewerPage.jsx');
    expect(src).toContain("import('../lib/data/hanjaTrad.json')");
    // AE-R1 개정(설계서 §7.2): 단어창 훈음은 별도 목록(listHanjaHunEum) 대신 루비 셀 — 같은 정체 표·같은 조회 함수.
    expect(src).toContain('hunRubyCells(text, { koTable: hanjaKoTable, hunTable: hanjaHunTable, tradTable: hanjaTradTable }, HUN_RUBY_CELL)');
    expect(sliceBetween(read('src/lib/viewerHunRuby.js'), 'export function hunRubyCells', '\n}')).toContain('hanjaReadingsOf(');
    expect(src).toMatch(/charDetail\(inspectChar\.ch, \{ koTable: hanjaKoTable, hunTable: hanjaHunTable, jaTable: hanjaJaTable \}, inspectWord\)/);
    expect(src).toMatch(/const inspectWord = materialLang === 'Chinese' && [^\n]*\{ word: headText, tradTable: hanjaTradTable \}/);
  });
});
