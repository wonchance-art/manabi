'use client';
import { useMutation } from '@tanstack/react-query';
import { supabase } from './supabase';
import { analyzeText } from './analyzeText';
import { friendlyToastMessage } from './errorMessage';
import { resolveRange } from './pdfRangeBridge';

/**
 * PDF의 한 페이지 범위를 자료로 만들고 뷰어로 보낸다 — 추출·생성·분석·이동 한 벌.
 *
 * 입구가 둘이다(v2-H R1에서 하나 늘었다):
 *   자료 뷰어  '다음 범위' — 시작 쪽을 안 주면 지금 자료의 다음 쪽에서 이어 간다
 *   PDF 뷰어   '이 부분부터 읽기' — 보고 있는 쪽을 startPage로 준다
 * 두 입구가 같은 경로를 쓰는 게 요점이다. PDF 뷰어에 추출·생성을 새로 짜면 강제
 * private·last_page_read 동기화 같은 규칙이 두 곳으로 갈린다(설계 §1 "이식이 아니라 다리").
 *
 * @returns useMutation 결과
 */
export function usePdfRangeMutation({ material, sourcePdf, user, toast }) {
  return useMutation({
    mutationFn: async ({ startPage, chunkSize = 5 } = {}) => {
      if (!sourcePdf) throw new Error('PDF 출처 정보 없음');
      // 명시 시작 쪽이 우선, 없으면 지금 자료의 다음 쪽(기존 '다음 범위' 동작 그대로).
      const from = Number.isFinite(startPage)
        ? startPage
        : (Number.isFinite(material?.page_end) ? material.page_end + 1 : NaN);
      const range = resolveRange({ startPage: from, chunkSize, pageCount: sourcePdf.page_count });
      if (!range) throw new Error('PDF 끝에 도달했습니다.');
      const { start: nextStart, end: nextEnd } = range;

      const { extractPageRange, getPdfMetadata, ocrPageRange } = await import('./pdfExtract');
      const { getCachedPdf, cachePdf } = await import('./pdfCache');

      let buffer = await getCachedPdf(sourcePdf.id);
      if (!buffer) {
        const { data: signed } = await supabase.storage
          .from('user-pdfs')
          .createSignedUrl(sourcePdf.storage_path, 60);
        if (!signed?.signedUrl) throw new Error('PDF 접근 실패');
        const res = await fetch(signed.signedUrl);
        buffer = await res.arrayBuffer();
        cachePdf(sourcePdf.id, buffer).catch(() => {});
      }

      let text = await extractPageRange(buffer, nextStart, nextEnd);

      if (!text || text.length < 30) {
        toast?.('스캔본으로 감지 — OCR로 재시도합니다 (시간이 걸려요)', 'info', 4000);
        const { doc } = await getPdfMetadata(buffer);
        text = await ocrPageRange(doc, nextStart, nextEnd);
      }

      if (!text || text.length < 30) throw new Error('추출된 텍스트가 너무 적습니다.');

      const initJson = {
        sequence: [], dictionary: {}, last_idx: -1, status: 'analyzing',
        metadata: {
          language: sourcePdf.language || 'Japanese',
          level: sourcePdf.level,
          updated_at: new Date().toISOString(),
        },
      };
      const { data: inserted, error } = await supabase
        .from('reading_materials')
        .insert({
          title: `${sourcePdf.title} (p.${nextStart}-${nextEnd})`,
          raw_text: text,
          processed_json: initJson,
          visibility: 'private',
          owner_id: user.id,
          source_pdf_id: sourcePdf.id,
          page_start: nextStart,
          page_end: nextEnd,
        })
        .select()
        .single();
      if (error) throw error;

      supabase.from('uploaded_pdfs').update({ last_page_read: nextEnd }).eq('id', sourcePdf.id).then(() => {});

      // 백그라운드 분석 (fire-and-forget) — 리다이렉트 후에도 계속 실행
      (async () => {
        try {
          const finalJson = await analyzeText(text, new AbortController().signal, {
            metadata: initJson.metadata,
            concurrency: 8,
            onBatch: async ({ currentJson }) => {
              await supabase.from('reading_materials')
                .update({ processed_json: currentJson })
                .eq('id', inserted.id);
            },
          });
          await supabase.from('reading_materials')
            .update({ processed_json: finalJson })
            .eq('id', inserted.id);
        } catch (e) {
          console.error('[next-range analyze]', e?.message);
        }
      })();

      return inserted;
    },
    onSuccess: (inserted) => {
      toast?.('분석 시작 — 뷰어로 이동합니다', 'success');
      window.location.href = `/viewer/${inserted.id}`;
    },
    onError: (err) => toast?.('범위 가져오기 실패 — ' + friendlyToastMessage(err), 'error'),
  });
}
