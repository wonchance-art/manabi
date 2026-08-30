'use client';

/**
 * PDF → 자료 다리 — 범위 계산 (v2-H R1, #1077 설계 §1).
 *
 * ── 왜 다리인가
 *
 * 같은 앱인데 PDF로 읽으면 뷰어 기능이 0이다(집중 모드·단어 카드·상태 하이라이트·
 * 받아쓰기·재분석 전부). 그런데 **기능이 없는 게 진짜 문제가 아니다** — PDF를 자료로
 * 만들면 그 기능들이 전부 따라온다. 온전한 경험이 이미 있는데 PDF 뷰어에 **그리로
 * 건너갈 길이 없을 뿐**이다(툴바 링크는 `← 자료실`뿐).
 *
 * 그래서 12기능을 PDF 뷰어에 복사하지 않는다 — 이중 구현이라는 기존 부채가 깊어진다.
 * 역할을 나누고 다리만 놓는다: PDF 뷰어는 원본 열람·범위 고르기, 읽기·학습은 자료 뷰어.
 *
 * 추출→생성→분석→이동은 `usePdfRangeMutation`이 이미 전부 하고 있었다(뷰어의 '다음 범위').
 * 이 파일은 그 입구를 하나 더 열 때 필요한 **범위 계산만** 맡는다 — 경계와 상한이
 * 두 입구에서 갈리면 한쪽에서만 폭주가 난다.
 */

/**
 * 한 번에 가져올 수 있는 최대 쪽수(설계 §2 "범위 상한으로 분석 폭주 방지").
 * 넘겨 잡으면 분석 요청이 쪽수에 비례해 늘고 분당 제한에 걸린다.
 */
export const BRIDGE_MAX_PAGES = 10;

/**
 * 실제로 가져올 범위. 시작이 없거나 문서 밖이면 null(호출자가 거절한다).
 * @param {{startPage:number, chunkSize:number, pageCount:number}} p
 * @returns {{start:number, end:number}|null}
 */
export function resolveRange({ startPage, chunkSize = 5, pageCount } = {}) {
  if (!Number.isFinite(pageCount) || pageCount < 1) return null;
  if (!Number.isFinite(startPage)) return null;
  const start = Math.floor(startPage);
  if (start < 1 || start > pageCount) return null;
  const size = Math.min(BRIDGE_MAX_PAGES, Math.max(1, Math.floor(chunkSize) || 1));
  return { start, end: Math.min(pageCount, start + size - 1) };
}

/**
 * PDF 뷰어에서 '이 부분부터 읽기'를 눌렀을 때의 시작 쪽.
 * pdf.js 경로는 지금 보고 있는 쪽을 알지만, 기본 경로(<embed>)는 모른다 — 그때는
 * `last_page_read`로 떨어진다. 자료 추가 화면이 이미 쓰는 기본값이라 관례가 하나로 남는다.
 */
export function bridgeStartPage({ livePage, lastPageRead, pageCount } = {}) {
  const candidates = [livePage, lastPageRead, 1];
  for (const c of candidates) {
    if (!Number.isFinite(c) || c < 1) continue;
    if (Number.isFinite(pageCount) && pageCount >= 1) return Math.min(Math.floor(c), pageCount);
    return Math.floor(c);
  }
  return 1;
}

/* ── 역방향: 자료 → 원본 PDF (v2-H R2, 설계 §1) ──────────────────────────
   다리를 한 방향으로만 놓으면 "이 대목 원문이 어떻게 생겼더라"에서 다시 막힌다.
   재료는 이미 완비돼 있다 — 자료 행의 source_pdf_id·page_start가 돌아갈 자리를 안다. */

/** 원본 PDF의 그 쪽으로 가는 주소. 쪽을 모르면 첫 쪽(=파라미터 없음). */
export function pdfViewerHref(pdfId, page) {
  if (!pdfId) return null;
  const base = `/pdf/${pdfId}`;
  return Number.isFinite(page) && page >= 1 ? `${base}?page=${Math.floor(page)}` : base;
}

/**
 * 기본 경로(<embed>)에서 쪽을 여는 방법 — PDF Open Parameters의 `#page=N`.
 * pdf.js 경로처럼 우리가 렌더를 쥐고 있지 않으므로 브라우저 내장 뷰어에게 조각으로 부탁한다.
 */
export function embedSrcWithPage(pdfUrl, page) {
  if (!pdfUrl) return '';
  const base = `${pdfUrl}#toolbar=1&navpanes=0`;
  return Number.isFinite(page) && page >= 1 ? `${base}&page=${Math.floor(page)}` : base;
}
