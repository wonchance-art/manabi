'use client';

/**
 * PDF → 자료 다리 (v2-H R1, #1077 설계 §1).
 *
 * PDF 뷰어에서 보고 있는 자리를 그대로 자료로 만들어 자료 뷰어로 건너간다. 지금까지는
 * 자료 추가 화면으로 되돌아가 PDF를 다시 고르고 범위를 다시 잡아야 했다 — 그 왕복이
 * "PDF로 읽으면 뷰어 기능이 0"의 실제 원인이었다(기능은 자료 쪽에 이미 다 있다).
 *
 * 추출·생성·분석·이동은 `usePdfRangeMutation`이 통째로 맡는다. 여기는 **범위를 고르는
 * 화면**일 뿐이라 강제 private·last_page_read 동기화 같은 규칙이 이쪽으로 새지 않는다.
 */
import { useState } from 'react';
import Button from './Button';
import { BRIDGE_MAX_PAGES, bridgeStartPage, resolveRange } from '../lib/pdfRangeBridge';

export default function PdfReadBridge({ pdfInfo, livePage, mutation, user }) {
  const [open, setOpen] = useState(false);
  const [end, setEnd] = useState(null);

  const pageCount = pdfInfo?.page_count;
  // 게스트는 자료를 만들 수 없다(owner_id가 필요). 쪽수를 모르는 PDF도 범위를 못 잡는다.
  if (!user || !Number.isFinite(pageCount) || pageCount < 1) return null;

  const start = bridgeStartPage({
    livePage,
    lastPageRead: pdfInfo?.last_page_read,
    pageCount,
  });
  const maxEnd = Math.min(pageCount, start + BRIDGE_MAX_PAGES - 1);
  const suggested = resolveRange({ startPage: start, chunkSize: 5, pageCount });
  const endValue = Math.min(maxEnd, Math.max(start, end ?? suggested?.end ?? start));
  const pages = endValue - start + 1;

  return (
    <div className="pdf-bridge">
      <button
        type="button"
        className="pdf-bridge__open"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        이 부분부터 읽기
      </button>

      {open && (
        <div className="pdf-bridge__panel" role="group" aria-label="읽을 범위">
          <p className="pdf-bridge__lead">
            <b>p.{start}</b>부터{' '}
            <label>
              <input
                type="number"
                min={start}
                max={maxEnd}
                value={endValue}
                aria-label="끝 쪽"
                onChange={(e) => setEnd(parseInt(e.target.value, 10) || start)}
              />
              쪽까지
            </label>
          </p>
          {/* 상한을 미리 알려 준다 — 눌러 본 뒤에 거절당하면 왜 안 되는지 알 수 없다. */}
          <p className="pdf-bridge__hint">
            {pages}쪽 · 한 번에 최대 {BRIDGE_MAX_PAGES}쪽
          </p>
          <Button
            size="sm"
            onClick={() => mutation.mutate({ startPage: start, chunkSize: pages })}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? '가져오는 중...' : '자료로 만들어 읽기'}
          </Button>
        </div>
      )}
    </div>
  );
}
