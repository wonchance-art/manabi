import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

/**
 * 계약: 빠른 분석(목업 ④)은 /api/analyze 무저장 재사용이다 — 서버 변경 0.
 * 캡·언어 집합은 서버와 같은 숫자를 클라이언트가 미러링해야 한다(어긋나면 서버가
 * 조용히 잘라 UI 안내와 실제 분석 범위가 갈라진다).
 */
describe('빠른 분석 ↔ /api/analyze 계약', () => {
  const quick = read('src/views/QuickPage.jsx');
  const route = read('src/app/api/analyze/route.js');

  it('전용 서버 엔드포인트를 만들지 않는다 — /api/analyze 재사용', () => {
    expect(quick).toContain("fetch('/api/analyze'");
    expect(quick).not.toContain('/api/quick');
  });

  it('줄 수·줄 길이 캡이 서버 상수와 같다', () => {
    const serverLines = Number(route.match(/const MAX_LINES = (\d+);/)?.[1]);
    const serverLen = Number(route.match(/const MAX_LINE_LEN = (\d+);/)?.[1]);
    const clientLines = Number(quick.match(/const QUICK_MAX_LINES = (\d+);/)?.[1]);
    const clientLen = Number(quick.match(/const QUICK_MAX_LINE_LEN = (\d+);/)?.[1]);
    expect(clientLines).toBe(serverLines);
    expect(clientLen).toBe(serverLen);
  });

  it('언어 선택지가 서버 화이트리스트와 같은 집합이다(French 없음)', () => {
    const m = route.match(/if \(!\[([^\]]+)\]\.includes\(language\)\)/);
    const serverLangs = ['Japanese', 'English', 'Chinese', 'French'].filter((l) => m?.[1]?.includes(`'${l}'`));
    const clientLangs = ['Japanese', 'English', 'Chinese', 'French'].filter((l) => {
      const langsBlock = quick.match(/const QUICK_LANGS = \[[\s\S]*?\];/)?.[0] || '';
      return langsBlock.includes(`'${l}'`);
    });
    expect(clientLangs).toEqual(serverLangs);
    expect(clientLangs).not.toContain('French');
  });

  it('게스트는 로그인 안내 — 서버 401 정책의 클라 미러', () => {
    expect(quick).toContain('!user ?');
    expect(quick).toContain('/auth');
  });
});

// 계약: 토큰 렌더·탭 사전은 정본 부품 재사용 — 뷰어와 같은 표기(병음·요미)와 사전.
describe('빠른 분석 — 정본 부품 재사용', () => {
  const quick = read('src/views/QuickPage.jsx');

  it('루비 조판은 뷰어 정본(splitRuby·pinyinToneClass·word-token)', () => {
    expect(quick).toContain('splitRuby');
    expect(quick).toContain('pinyinToneClass');
    expect(quick).toContain('word-token');
    expect(quick).toContain('rt-an'); // WebKit 절대배치 수리를 그대로 승계
  });

  it('탭 사전은 PDF 뷰어 팝업 계약(fetchWordDetailText·formatDetail)', () => {
    expect(quick).toContain('fetchWordDetailText');
    expect(quick).toContain('formatDetail');
    expect(quick).toContain('pdf-detail-popup');
  });
});

// 계약: 저장 경로는 하나 — [자료로 저장]은 초안 핸드오프이고, 저장은 추가 화면의 기존 흐름.
describe('빠른 분석 — 자료로 저장 핸드오프', () => {
  it('QuickPage가 초안을 넘기고 MaterialAddPage가 같은 키로 받는다', () => {
    const quick = read('src/views/QuickPage.jsx');
    const add = read('src/views/MaterialAddPage.jsx');
    expect(quick).toContain('manabi_quick_draft');
    expect(quick).toContain('/materials/add?from=quick');
    expect(add).toContain('manabi_quick_draft');
    expect(add).toContain("'quick'");
  });

  it('저장 안 됨 라벨이 결과 화면에 있다 — 무저장 명시', () => {
    expect(read('src/views/QuickPage.jsx')).toContain('저장 안 됨');
  });
});

// 배선: /quick 라우트와 서재 입구.
describe('빠른 분석 — 배선', () => {
  it('앱 라우트가 QuickPage를 감싼다', () => {
    const page = read('src/app/(app)/quick/page.jsx');
    expect(page).toContain("from '@/views/QuickPage'");
  });

  it('서재 헤더에 입구가 있다', () => {
    expect(read('src/views/MaterialsPage.jsx')).toContain('href="/quick"');
  });
});
