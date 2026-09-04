import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from '../../lib/__tests__/helpers/sliceBetween.js';
import { titleFromBody, TITLE_MAX_CHARS } from '../../lib/materialTitle';

/**
 * 계약: 자료 추가 화면 정돈 R2 (#1077 5547576227 — 오너 「자료 추가하는 부분도 다뤄줘, 복잡하더라」).
 * 입구 4장 → 칩 한 줄 + 아코디언(한 번에 하나) · 본문 먼저 · 제목 자동 채움 · 헤더 설명 삭제.
 * 기존 계약(입구 소스 순서·문장 목록 필드·비공개 고정·노트 흐름·딥링크)은 각자의 테스트가 지킨다 —
 * 여기는 **정돈이 되돌아가지 않는 것**만 심는다.
 */
const ROOT = process.cwd();
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

const page = read('src/views/MaterialAddPage.jsx');
const SECTIONS = {
  pdf: 'src/views/MaterialAddPdfSection.jsx',
  epub: 'src/components/MaterialAddEpubSection.jsx',
  sentences: 'src/components/MaterialAddSentenceSection.jsx',
  link: 'src/components/MaterialAddLinkSection.jsx',
};

describe('입구 — 칩 한 줄 + 아코디언', () => {
  it('헤더 설명 문장이 없고 화면은 .add-page 스코프다', () => {
    expect(page).not.toContain('page-header__subtitle');
    expect(page).toContain('className="page-container add-page"');
  });

  it('칩 순서 = 렌더 순서 = 기존 소스 순서 계약(PDF→EPUB→문장 목록→링크→본문)', () => {
    const entries = sliceBetween(page, 'const ENTRIES = [', '];');
    const keys = [...entries.matchAll(/\['(\w+)'/g)].map((m) => m[1]);
    expect(keys).toEqual(['pdf', 'epub', 'sentences', 'link']);
    const at = (s) => { const i = page.indexOf(s); expect(i, `${s} 없음`).toBeGreaterThan(-1); return i; };
    const chips = at('className="add-entries__chips" role="tablist"');
    const order = [chips, at('<MaterialAddPdfSection'), at('<MaterialAddEpubSection'),
      at('<MaterialAddSentenceSection'), at('<MaterialAddLinkSection'), at('className="form-textarea"')];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('펼침 상태는 페이지 하나(문자열) — 한 번에 하나만, 같은 칩을 다시 누르면 접힌다', () => {
    expect(page).toContain("const [openEntry, setOpenEntry] = useState('');");
    expect(page).toContain("onClick={() => setOpenEntry((cur) => (cur === key ? '' : key))}");
    for (const key of Object.keys(SECTIONS)) {
      expect(page, `${key} 입구가 open을 페이지에서 받지 않는다`).toContain(`open={openEntry === '${key}'}`);
    }
    // 입구가 스스로 열어 달라고 할 때(딥링크·본문 폼 넘김)만 위로 알린다 — 자기 키로만
    expect(page).toContain("onOpenChange={entryOpenChange('sentences')}");
    expect(page).toContain("onOpenChange={entryOpenChange('link')}");
    expect(page).toContain("const entryOpenChange = (key) => (v) => setOpenEntry((cur) => (v ? key : (cur === key ? '' : cur)));");
  });

  it('입구 넷 모두 접히면 안 그린다(설명문은 펼쳤을 때만) — 자기 카드·자기 open 상태 없음', () => {
    for (const [key, f] of Object.entries(SECTIONS)) {
      const src = stripComments(read(f));
      const guard = src.indexOf('if (!open) return null;');
      const render = src.indexOf('\n  return (');
      expect(guard, `${key}: 접힘 가드 없음`).toBeGreaterThan(-1);
      expect(guard, `${key}: 가드가 렌더 앞에 있어야 한다`).toBeLessThan(render);
      // 설명문·본문은 가드 뒤에만 — 접힌 채로 두꺼운 설명이 남으면 정돈 전으로 돌아간다
      expect(src.indexOf('add-entry__desc'), `${key}: 설명문이 가드 앞`).toBeGreaterThan(guard);
      expect(src, `${key}: 입구가 자기 카드를 그린다`).not.toContain('className="card add-form"');
      expect(src, `${key}: 입구가 open 상태를 스스로 쥔다`).not.toMatch(/const \[open, setOpen\]/);
      expect(src.slice(render), `${key}: 렌더 안에 setOpen 호출`).not.toContain('setOpen(');
    }
  });

  it('내용을 넘겨준 뒤엔 입구를 접는다 — 시선을 폼으로', () => {
    for (const h of ['handlePdfRangeReady', 'handleEpubBookReady', 'handleSentenceBookReady', 'handleLinkReady', 'handleEpubReady']) {
      expect(sliceBetween(page, `const ${h} =`, '\n  };'), `${h}가 입구를 안 접는다`).toContain("setOpenEntry('')");
    }
  });

  it('PDF 칩은 접힌 채로도 권수를 안다 — 책장 조회는 접혀도 산다', () => {
    expect(page).toContain('onCountChange={setPdfCount}');
    expect(page).toContain("{key === 'pdf' && pdfCount > 0 ? ` · ${pdfCount}권` : ''}");
    const pdf = read(SECTIONS.pdf);
    expect(pdf).toContain('onCountChange?.(pdfs.length)');
    expect(pdf.indexOf('onCountChange?.(pdfs.length)')).toBeLessThan(pdf.indexOf('if (!open) return null;'));
  });

  it('딥링크 배선은 그대로 — ?book=·추천 영상 주소·/quick 초안', () => {
    expect(page).toContain('initialBookKey={appendBookKey}');
    expect(page).toContain('initialUrl={linkAutoUrl}');
    expect(page).toContain("'quick'");
    // 입구가 열어 달라고 하는 자리 — 딥링크 효과 안
    const sent = read(SECTIONS.sentences);
    expect(sliceBetween(sent, 'if (!initialBookKey', '}, [initialBookKey, books]);')).toContain('onOpenChange?.(true)');
    expect(sliceBetween(sent, 'if (!seedText) return;', '}, [seedText]);')).toContain('onOpenChange?.(true)');
    expect(sliceBetween(read(SECTIONS.link), 'if (!initialUrl) return;', '}, [initialUrl]);')).toContain('onOpenChange?.(true)');
  });
});

describe('폼 — 본문 먼저, 나머지는 아래 두 줄', () => {
  it('본문 → 제목 → [언어|난이도] → [공개|종류] 순서', () => {
    const form = sliceBetween(page, '<div className="card add-form">\n', '{/* Progress */}');
    const at = (s) => { const i = form.indexOf(s); expect(i, `${s} 없음`).toBeGreaterThan(-1); return i; };
    const order = [
      at('className="form-textarea"'),
      at('<label className="form-label">제목</label>'),
      at('<label className="form-label">학습 언어</label>'),
      at('<label className="form-label">권장 학습 난이도</label>'),
      at('공개 범위'),
      at('<label className="form-label">자료 종류</label>'),
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // 두 줄 = form-row 둘(언어|난이도, 공개|종류)
    expect(form.match(/className="form-row"/g)).toHaveLength(2);
  });

  it('제목이 비면 본문 첫 줄 — 입력한 제목은 덮지 않는다(trim 뒤 있으면 그대로)', () => {
    expect(page).toContain("import { titleFromBody } from '../lib/materialTitle';");
    expect(page).toContain('const autoTitle = titleFromBody(rawText);');
    expect(page).toContain('title: title.trim() || titleFromBody(rawText) || "제목 없음",');
    expect(page).toContain("title: title.trim() || titleFromBody(rawText) || '제목 없는 책'");
    // placeholder가 채워질 값을 미리 보여 준다 — 사용자가 고칠 수 있다
    expect(page).toContain("placeholder={autoTitle ? `${autoTitle} (본문 첫 줄)` : '비우면 본문 첫 줄로 채워요'}");
  });
});

describe('titleFromBody — 본문 첫 줄 제목', () => {
  it('첫 내용 줄만 — 앞의 빈 줄·공백 줄은 건너뛴다', () => {
    expect(titleFromBody('')).toBe('');
    expect(titleFromBody(null)).toBe('');
    expect(titleFromBody('\n  \n吾輩は猫である。\n名前はまだ無い。')).toBe('吾輩は猫である。');
  });

  it('줄 안 공백은 하나로 — 탭·연속 공백을 제목에 싣지 않는다', () => {
    expect(titleFromBody('  The   quick\tbrown  fox  ')).toBe('The quick brown fox');
  });

  it(`${TITLE_MAX_CHARS}자에서 자르고 …을 붙인다 — 딱 ${TITLE_MAX_CHARS}자면 그대로`, () => {
    expect(TITLE_MAX_CHARS).toBe(40);
    const exact = 'あ'.repeat(40);
    expect(titleFromBody(exact)).toBe(exact);
    expect(titleFromBody('あ'.repeat(41))).toBe(`${'あ'.repeat(40)}…`);
    // 잘린 끝의 공백은 떨군다
    expect(titleFromBody(`${'a'.repeat(39)} bcd`)).toBe(`${'a'.repeat(39)}…`);
    expect(titleFromBody('x'.repeat(100), 10)).toBe(`${'x'.repeat(10)}…`);
  });

  it('첫 줄만 읽는다 — 50k 본문을 통째로 쪼개지 않는다(indexOf 순회)', () => {
    const src = read('src/lib/materialTitle.js');
    expect(src).not.toMatch(/\.split\(/);
    expect(src).toContain("s.indexOf('\\n', start)");
  });
});

describe('CSS — .add-page 스코프·토큰만·터치 하한', () => {
  const css = read('src/index.css');
  const block = sliceBetween(css, '/* ========= 자료 추가 정돈(미니멀', '/* ========= /자료 추가 정돈 ========= */');

  it('두 칸 줄은 스코프 안에서만 auto-fit — 전역 .form-row·.chip·.page-header는 그대로', () => {
    expect(block).toContain('.add-page .form-row { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }');
    expect(block).toContain('.add-page .page-header { margin-bottom: 16px; }');
    expect(sliceBetween(css, '\n.form-row {', '}')).toContain('grid-template-columns: 1fr 1fr;');
    expect(sliceBetween(css, '\n.page-header {', '}')).toContain('margin-bottom: 40px;');
    expect(block, '새 브레이크포인트 금지 — 규약 §2').not.toContain('@media');
  });

  it('입구 칩 44px + focus-visible, 색은 토큰만', () => {
    const chip = sliceBetween(block, '.add-entries__chips .chip {', '}');
    expect(chip).toContain('min-height: 44px;');
    expect(block).toContain('.add-entries__chips .chip:focus-visible');
    expect(stripComments(block)).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });
});
