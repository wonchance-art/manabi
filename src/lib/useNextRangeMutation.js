'use client';
import { useMutation } from '@tanstack/react-query';
import { supabase } from './supabase';
import { analyzeText } from './analyzeText';
import { friendlyToastMessage } from './errorMessage';

/**
 * PDF 출처 자료에서 다음 페이지 범위로 새 material 생성 + 백그라운드 분석.
 * @returns useMutation 결과
 */
export function useNextRangeMutation({ material, sourcePdf, user, toast }) {
  return useMutation({
    mutationFn: async ({ chunkSize = 5 } = {}) => {
      if (!sourcePdf || !material?.page_end) throw new Error('PDF 출처 정보 없음');
      const nextStart = material.page_end + 1;
      if (nextStart > sourcePdf.page_count) throw new Error('PDF 끝에 도달했습니다.');
      const nextEnd = Math.min(nextStart + chunkSize - 1, sourcePdf.page_count);

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
        toast?.('📷 스캔본으로 감지 — OCR로 재시도합니다 (시간이 걸려요)', 'info', 4000);
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
      toast?.('📖 다음 범위 분석 시작! 뷰어로 이동합니다', 'success');
      window.location.href = `/viewer/${inserted.id}`;
    },
    onError: (err) => toast?.('다음 범위 생성 실패 — ' + friendlyToastMessage(err), 'error'),
  });
}
