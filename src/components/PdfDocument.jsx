'use client';

import { embedSrcWithPage } from '../lib/pdfRangeBridge';

export default function PdfDocument({ pdfUrl, page }) {
  return (
    <embed
      // 쪽 지정은 브라우저 내장 뷰어에게 조각(#page=N)으로 부탁한다 — 이 경로는
      // 우리가 렌더를 쥐고 있지 않아 그 방법뿐이다(v2-H R2).
      src={embedSrcWithPage(pdfUrl, page)}
      type="application/pdf"
      style={{ width: '100%', flex: 1, border: 'none', borderRadius: 4, minHeight: 0 }}
    />
  );
}
