import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { groupByPdf, pageRangeLabel, readProgressLabel } from '../pdfGroups.js';
import { groupByBook } from '../bookMeta.js';
import { sliceBetween } from './helpers/sliceBetween.js';

/**
 * 계약: v2-P 자료실 통합 (#1077 설계 5486259288, 오너 발안).
 *
 * ── 같은 책이 두 탭에 흩어져 있었다
 *
 * PDF 원본은 `PDF` 탭, 그 PDF에서 뽑은 자료는 `내 자료` 탭. 게다가 PDF 카드는 제목·
 * 페이지 수·날짜뿐이라 자료 카드가 주는 진도·복습·커버리지가 **전무**했고, 언어·레벨
 * 필터는 `tab !== 'pdf'` 가드로 PDF 탭에서만 숨었다.
 *
 * PDF는 개념적으로 **책과 같다** — 하나의 원본에서 여러 범위 자료가 파생되고, H R1·R2가
 * `source_pdf_id`·`page_start`·`page_end`·`last_page_read`로 다리를 이미 놓았다.
 * 그래서 탭을 없애고 `groupByBook`과 **같은 모양**의 묶음으로 흡수한다.
 *
 * ── 스키마가 이 통합을 이미 강제하고 있었다 (실측)
 *
 * `20260414000400_uploaded_pdfs.sql`에 `CHECK (source_pdf_id IS NULL OR visibility =
 * 'private')`가 있다. **PDF 파생 자료는 구조적으로 항상 비공개**라 `내 자료` 밖에
 * 있을 수 없다 — PDF 묶음이 공용 탭에 나타날 경우의 수 자체가 없다.
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const PAGE = 'src/views/MaterialsPage.jsx';

const mat = (id, pdfId, start, end) => ({
  id,
  title: `자료 ${id}`,
  source_pdf_id: pdfId,
  page_start: start,
  page_end: end,
  processed_json: { status: 'completed' },
});
const pdf = (id, extra = {}) => ({ id, title: `PDF ${id}`, page_count: 100, ...extra });

describe('① PDF 묶음 — 원본 하나에 파생 자료를 접는다', () => {
  it('자료를 원본별로 모으고 페이지 오름차순으로 세운다', () => {
    const { groups, rest } = groupByPdf(
      [mat('c', 'p1', 25, 36), mat('a', 'p1', 1, 12), mat('b', 'p1', 13, 24)],
      [pdf('p1')],
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].chapters.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(rest).toEqual([]);
  });

  it('`page_start`가 없는 옛 자료는 뒤로 — 0으로 읽어 맨 앞에 끼우지 않는다', () => {
    const { groups } = groupByPdf(
      [mat('old', 'p1', null, null), mat('first', 'p1', 1, 4)],
      [pdf('p1')],
    );
    expect(groups[0].chapters.map((c) => c.id)).toEqual(['first', 'old']);
  });

  it('자료 0개 PDF도 카드로 남는다 — 탭을 없애면서 잃는 것이 있으면 통합이 아니라 삭제다', () => {
    const { groups } = groupByPdf([], [pdf('p1'), pdf('p2')]);
    expect(groups).toHaveLength(2);
    expect(groups[0].chapters).toEqual([]);
  });

  it('원본을 못 찾은 자료는 낱개로 남는다 — 묶음은 표현이지 소유가 아니다', () => {
    // PDF가 지워졌거나 목록이 아직 안 왔을 때 자료까지 같이 사라지면 안 된다.
    const { groups, rest } = groupByPdf([mat('orphan', 'gone', 1, 2)], [pdf('p1')]);
    expect(groups[0].chapters).toEqual([]);
    expect(rest.map((m) => m.id)).toEqual(['orphan']);
  });

  it('`source_pdf_id`가 없는 자료는 손대지 않는다', () => {
    const { rest } = groupByPdf([mat('plain', null, null, null)], [pdf('p1')]);
    expect(rest.map((m) => m.id)).toEqual(['plain']);
  });

  it('책 묶음이 PDF 묶음을 이긴다 — 손으로 매긴 메타가 자동 파생을 이긴다', () => {
    // 우선순위를 규칙으로 적지 않고 **호출 순서**로 세운다: groupByBook 먼저,
    // 그 singles만 groupByPdf로. 두 묶음에 같은 자료가 동시에 뜨는 일이 구조적으로 없다.
    const booked = { ...mat('ch1', 'p1', 1, 12), processed_json: { status: 'completed', metadata: { book: { key: 'bk1', title: '책', order: 1 } } } };
    const loose = mat('r1', 'p1', 13, 24);
    const { books, singles } = groupByBook([booked, loose]);
    const { groups } = groupByPdf(singles, [pdf('p1')]);
    expect(books[0].chapters.map((c) => c.id)).toEqual(['ch1']);
    expect(groups[0].chapters.map((c) => c.id)).toEqual(['r1']);
  });
});

describe('② 표기 — 페이지 범위와 읽던 자리', () => {
  it('범위는 `p.13–24`, 한 쪽짜리는 `p.13`, 없으면 무표기', () => {
    expect(pageRangeLabel({ page_start: 13, page_end: 24 })).toBe('p.13–24');
    expect(pageRangeLabel({ page_start: 13, page_end: 13 })).toBe('p.13');
    expect(pageRangeLabel({ page_start: 13 })).toBe('p.13');
    expect(pageRangeLabel({})).toBeNull();
  });

  it('1쪽은 진도가 아니다 — `last_page_read` 기본값이 1이라 안 읽은 것과 구분되지 않는다', () => {
    expect(readProgressLabel({ last_page_read: 42 })).toBe('42쪽까지 읽음');
    expect(readProgressLabel({ last_page_read: 1 })).toBeNull();
    expect(readProgressLabel({})).toBeNull();
  });
});

describe('③ 자료실 배선 — 탭 폐지와 진입 순서', () => {
  it('PDF 탭이 부활하지 않는다(계약 ①)', () => {
    const page = read(PAGE);
    expect(page, "탭 값 'pdf'가 되살아났다").not.toMatch(/tab === 'pdf'|setTab\('pdf'\)/);
    // 필터를 PDF 탭에서만 숨기던 가드도 함께 사라져야 한다(계약 ④ 동일 적용)
    expect(page, '필터 가드가 남아 있다').not.toContain("tab !== 'pdf'");
  });

  it('탭은 내 자료가 먼저다(오너 지시) — 알약 순서도 그렇다', () => {
    const pills = sliceBetween(read(PAGE), '<div className="tab-pills">', '</div>');
    const mine = pills.indexOf('내 자료');
    const pub = pills.indexOf('공용');
    expect(mine, '내 자료 알약이 없다').toBeGreaterThan(-1);
    expect(pub, '공용 알약이 없다').toBeGreaterThan(-1);
    expect(mine, '공용이 내 자료보다 앞이다').toBeLessThan(pub);
  });

  it('기본 탭 = 로그인 private / 비로그인 public — 게스트 빈 화면 금지(계약 ⑤)', () => {
    const page = read(PAGE);
    expect(page).toContain("(user ? 'private' : 'public')");
    // 게스트 분기가 필수인 이유가 코드에 그대로 있다 — 내 자료 쿼리는 게스트에게 빈 배열
    expect(page).toContain('if (!userId) return []');
  });

  it('auth 확정 전에는 목록을 쏘지 않는다 — 탭이 뒤집히며 쿼리가 두 번 나던 자리', () => {
    const page = read(PAGE);
    expect(page).toContain('authLoading');
    const q = sliceBetween(page, "queryKey: ['materials', tab", '  });');
    expect(q, '자료 쿼리에 가드가 없다').toContain('enabled: !!tab');
  });

  it('PDF 조회가 내 자료 탭에서 돈다 — 탭이 없어졌으니 도는 시점이 옮겨간다', () => {
    const q = sliceBetween(read(PAGE), "queryKey: ['my-pdfs'", '  });');
    expect(q).toContain("enabled: !!user && tab === 'private'");
    expect(q, '읽던 자리를 안 가져오면 「N쪽까지 읽음」을 말할 수 없다').toContain('last_page_read');
  });

  it('자료가 하나도 없어도 PDF 묶음은 그려진다 — 빈 화면 분기에 먹히지 않게', () => {
    // 묶음 카드는 `filtered.length > 0` 분기 **안**에 있었다. 자료 0개 + PDF 1개인
    // 사용자는 그 조건에서 빈 화면으로 떨어져 계약 ②가 무증상으로 깨진다.
    expect(read(PAGE)).toContain('(filtered.length > 0 || visiblePdfs.length > 0)');
  });
});

describe('④ 같은 컴포넌트 — 이중 구현 금지(계약 ③)', () => {
  it('책 묶음과 PDF 묶음이 같은 컴포넌트를 쓴다', () => {
    const page = read(PAGE);
    expect(page).toContain("import MaterialGroupCard from '../components/MaterialGroupCard'");
    // 두 곳 다 이 컴포넌트로 그린다 — 카드 마크업이 두 벌이 되면 한쪽만 낡는다
    expect(page.match(/<MaterialGroupCard/g), '묶음 카드가 두 곳에서 쓰이지 않는다').toHaveLength(2);
    // 카드 마크업은 컴포넌트 쪽에만 있다
    expect(page, '카드 마크업이 페이지에 남아 있다').not.toContain('<details key=');
  });

  it('묶음 카드에는 분기가 없다 — 들어오는 순간 다시 두 벌이 된다', () => {
    // 주석은 두 묶음을 설명해야 하므로 **코드만** 본다(주석까지 걸면 설명을 못 적는다).
    const code = read('src/components/MaterialGroupCard.jsx')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
    expect(code, '컴포넌트가 묶음 종류를 알고 있다').not.toMatch(/\bpdf\b|\bbook(?!-card)\b/i);
  });

  it('커버리지 판정은 한 자리 — 헬퍼 밖에 복제되지 않는다', () => {
    const page = read(PAGE);
    expect(page.match(/bf\.total >= FIT_MIN_TYPES/g)).toHaveLength(1);
  });

  it('묶음 카드 색은 토큰으로 — K R1 계약 정합(하드코딩 0)', () => {
    const css = read('src/index.css');
    const block = sliceBetween(css, '.group-card {', '.group-card__footer');
    expect(block, '토큰 아닌 색이 들어왔다').not.toMatch(/#[0-9a-fA-F]{3,8}|rgba?\(/);
    expect(read('src/components/MaterialGroupCard.jsx'), '컴포넌트에 인라인 style이 있다').not.toContain('style={{');
  });
});

describe('⑤ 필터 — 두 묶음에 같이 적용(계약 ④)', () => {
  it('조건이 걸리면 자료가 남은 PDF만, 조건이 없을 때만 전부', () => {
    // 언어·레벨은 **자료**에 붙는 조건이라 자료 0개 PDF에는 대응물이 없다. 「일본어」로
    // 좁혔는데 언어를 모르는 PDF가 남아 있으면 그게 필터 위반이다. 두 계약(② 누락 금지 /
    // ④ 동일 적용)이 부딪히는 유일한 자리라 규칙을 코드에 박고 여기서 고정한다.
    const page = read(PAGE);
    const rule = sliceBetween(page, 'const visiblePdfs = useMemo(', '}, [tab');
    expect(rule).toContain('if (!anyFilter) return pdfs;');
    expect(rule).toContain('live.has(x.id)');
    expect(page).toContain("const anyFilter = !!searchQuery || langFilter !== 'all' || levelFilter !== 'all' || unreadOnly || pinnedOnly;");
  });

  it('공용 탭에는 PDF 묶음이 없다 — 스키마가 이미 그렇게 강제한다', () => {
    const rule = sliceBetween(read(PAGE), 'const visiblePdfs = useMemo(', '}, [tab');
    expect(rule).toContain("if (tab !== 'private') return [];");
    // 근거: PDF 파생 자료는 CHECK 제약으로 항상 비공개다
    const mig = read('supabase/migrations/20260414000400_uploaded_pdfs.sql');
    expect(mig).toContain("CHECK (source_pdf_id IS NULL OR visibility = 'private')");
  });
});
