// PDF 묶음(v2-P) — 업로드한 PDF 하나와 거기서 뽑은 자료들을 카드 하나로 접는다.
//
// PDF는 개념적으로 **책과 같다**: 하나의 원본에서 여러 범위 자료가 파생되고, 원본에
// `last_page_read`가, 자료에 `source_pdf_id`·`page_start`·`page_end`가 이미 있다
// (H R1·R2가 놓은 다리). 그래서 결과 모양을 `groupByBook`과 맞춘다 — 자료실이 두 묶음을
// **같은 컴포넌트**로 그리기 때문이다(설계 계약 ③ 이중 구현 금지).
//
// 스키마 무변경. 새 쿼리도 없다 — `uploaded_pdfs`는 이미 조회 중이고 자료 쪽은 이미
// 뽑는 행에 컬럼 셋을 더한다.

/**
 * 페이지 순 정렬 키 — `page_start`가 없는 자료(옛 반입)는 뒤로.
 *
 * ⚠ `Number(null)`은 **0**이다(NaN이 아니다). `Number.isFinite`만 보면 값이 없는 자료가
 * 0쪽으로 읽혀 **맨 앞에** 끼어든다 — 실제로 그렇게 짰다가 계약에 잡혔다. 그래서
 * 없음(null·undefined·빈 문자열)을 먼저 걸러낸다.
 */
function pageOrderOf(m) {
  const raw = m?.page_start;
  if (raw === null || raw === undefined || raw === '') return Number.POSITIVE_INFINITY;
  const p = Number(raw);
  return Number.isFinite(p) ? p : Number.POSITIVE_INFINITY;
}

/**
 * 자료 목록을 PDF 그룹과 나머지로 분리.
 *
 * 책 묶음과 겹치지 않게 하려면 **`groupByBook`의 `singles`를 넘긴다** — 우선순위를
 * 규칙으로 적지 않고 호출 순서로 세운다(사람이 손으로 매긴 `metadata.book`이 자동
 * 파생인 `source_pdf_id`를 이긴다).
 *
 * @param {object[]} materials 자료 목록(각 항목에 `source_pdf_id`가 실려 있어야 한다)
 * @param {object[]} pdfs `uploaded_pdfs` 행 목록
 * @returns {{ groups: Array<{key: string, pdf: object, chapters: object[]}>, rest: object[] }}
 *   groups는 `pdfs`가 준 순서 그대로(최신 업로드 순), chapters는 페이지 오름차순.
 */
export function groupByPdf(materials, pdfs) {
  const byPdf = new Map();
  for (const pdf of pdfs || []) {
    if (!pdf?.id) continue;
    // 자료가 0개인 PDF도 **그룹으로 낸다** — 탭을 없애도 잃는 것이 없어야 한다.
    // (아직 아무 범위도 안 뽑은 PDF가 목록에서 사라지면 통합이 아니라 삭제다.)
    byPdf.set(pdf.id, { key: `pdf_${pdf.id}`, pdf, chapters: [] });
  }
  const rest = [];
  for (const m of materials || []) {
    const g = m?.source_pdf_id ? byPdf.get(m.source_pdf_id) : null;
    // 원본을 못 찾은 자료는 **낱개로 남긴다** — PDF가 지워졌거나 목록이 아직 안 왔을 때
    // 자료까지 같이 사라지면 안 된다(묶음은 표현이지 소유가 아니다).
    if (!g) { rest.push(m); continue; }
    g.chapters.push(m);
  }
  for (const g of byPdf.values()) {
    g.chapters.sort((a, b) => pageOrderOf(a) - pageOrderOf(b));
  }
  return { groups: [...byPdf.values()], rest };
}

/** 카드 줄에 쓸 페이지 범위 표기 — `p.13–24`, 한쪽만 있으면 `p.13`, 없으면 null. */
export function pageRangeLabel(material) {
  const s = Number(material?.page_start);
  const e = Number(material?.page_end);
  if (!Number.isFinite(s)) return null;
  return Number.isFinite(e) && e !== s ? `p.${s}–${e}` : `p.${s}`;
}

/**
 * 「N쪽까지 읽음」 표기 여부 — `last_page_read` 기본값이 1이라 1쪽은 **안 읽은 것**과
 * 구분되지 않는다. 진짜 진도일 때만 말한다.
 */
export function readProgressLabel(pdf) {
  const p = Number(pdf?.last_page_read);
  if (!Number.isFinite(p) || p <= 1) return null;
  return `${p}쪽까지 읽음`;
}
