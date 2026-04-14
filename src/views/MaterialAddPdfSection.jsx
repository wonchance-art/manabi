'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import Button from '../components/Button';
import ConfirmModal from '../components/ConfirmModal';
import { getPdfMetadata, extractPageRange, suggestChunkSize } from '../lib/pdfExtract';

const MAX_PDF_SIZE = 50 * 1024 * 1024; // 50MB

async function fetchMyPdfs(userId) {
  const { data, error } = await supabase
    .from('uploaded_pdfs')
    .select('id, title, filename, page_count, language, level, last_page_read, created_at')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function fetchPdfAnalyzedRanges(pdfId) {
  const { data } = await supabase
    .from('reading_materials')
    .select('id, title, page_start, page_end, processed_json')
    .eq('source_pdf_id', pdfId)
    .order('page_start', { ascending: true });
  return data || [];
}

/**
 * MaterialAddPage 상단에 붙는 PDF 책장 + 업로드 섹션
 * props.onRangeReady({ pdf, pageStart, pageEnd, rawText }) — 텍스트 추출 완료 시 호출
 */
export default function MaterialAddPdfSection({ user, toast, onRangeReady }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [extractingRange, setExtractingRange] = useState(false);
  const [activePdf, setActivePdf] = useState(null); // 범위 선택 중인 PDF
  const [pageStart, setPageStart] = useState(1);
  const [pageEnd, setPageEnd] = useState(5);
  const [expandedPdfId, setExpandedPdfId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [agreedCopyright, setAgreedCopyright] = useState(false);

  const { data: pdfs = [], refetch } = useQuery({
    queryKey: ['my-pdfs', user?.id],
    queryFn: () => fetchMyPdfs(user.id),
    enabled: !!user,
  });

  const { data: expandedRanges = [] } = useQuery({
    queryKey: ['pdf-ranges', expandedPdfId],
    queryFn: () => fetchPdfAnalyzedRanges(expandedPdfId),
    enabled: !!expandedPdfId,
  });

  const deletePdfMutation = useMutation({
    mutationFn: async (pdf) => {
      // Storage에서 먼저 삭제
      const { error: storageErr } = await supabase.storage
        .from('user-pdfs')
        .remove([pdf.storage_path]);
      if (storageErr) console.warn('[pdf delete] storage error:', storageErr.message);

      // DB 삭제 (CASCADE로 연결된 reading_materials도 함께 삭제됨)
      const { error } = await supabase.from('uploaded_pdfs').delete().eq('id', pdf.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast('PDF가 삭제됐어요.', 'info');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['pdf-ranges'] });
    },
    onError: (err) => toast('삭제 실패: ' + err.message, 'error'),
  });

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_PDF_SIZE) {
      toast('50MB 이하의 PDF만 업로드할 수 있어요.', 'warning');
      return;
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast('PDF 파일만 업로드할 수 있어요.', 'warning');
      return;
    }
    if (!agreedCopyright) {
      toast('본인 학습 목적 사용에 동의해주세요.', 'warning');
      return;
    }

    setUploading(true);
    try {
      // 1. 메타데이터 먼저 읽기 (페이지 수, 스캔본 감지)
      const buffer = await file.arrayBuffer();
      const { pageCount, isLikelyScanned } = await getPdfMetadata(buffer);

      if (isLikelyScanned) {
        toast('이 PDF는 이미지 기반으로 보여요. 텍스트가 포함된 PDF를 올려주세요.', 'warning', 6000);
        setUploading(false);
        return;
      }

      // 2. Storage 업로드
      const pdfId = crypto.randomUUID();
      const storagePath = `${user.id}/${pdfId}.pdf`;
      const { error: uploadErr } = await supabase.storage
        .from('user-pdfs')
        .upload(storagePath, file, { contentType: 'application/pdf' });
      if (uploadErr) throw uploadErr;

      // 3. uploaded_pdfs insert
      const title = file.name.replace(/\.pdf$/i, '');
      const { data: inserted, error: insertErr } = await supabase
        .from('uploaded_pdfs')
        .insert({
          id: pdfId,
          owner_id: user.id,
          title,
          filename: file.name,
          storage_path: storagePath,
          file_size_bytes: file.size,
          page_count: pageCount,
        })
        .select()
        .single();
      if (insertErr) throw insertErr;

      toast(`📘 "${title}" 업로드 완료 (${pageCount}페이지)`, 'success');
      refetch();

      // 4. 즉시 범위 선택 UI로 — 추천 크기 자동 적용
      const suggested = suggestChunkSize(pageCount);
      setActivePdf(inserted);
      setPageStart(1);
      setPageEnd(Math.min(suggested, pageCount));
    } catch (err) {
      toast('업로드 실패: ' + err.message, 'error');
    } finally {
      setUploading(false);
      e.target.value = ''; // 같은 파일 재선택 가능하게
    }
  };

  const handleExtractAndAnalyze = async () => {
    if (!activePdf) return;
    setExtractingRange(true);
    try {
      // Storage에서 PDF 다운로드
      const { data: signed } = await supabase.storage
        .from('user-pdfs')
        .createSignedUrl(activePdf.storage_path, 60);
      if (!signed?.signedUrl) throw new Error('PDF 접근 실패');

      const res = await fetch(signed.signedUrl);
      const buffer = await res.arrayBuffer();
      const text = await extractPageRange(buffer, pageStart, pageEnd);

      if (!text || text.length < 30) {
        toast('이 범위에서 추출된 텍스트가 너무 적어요. 다른 페이지를 시도해보세요.', 'warning');
        return;
      }

      if (text.length > 50000) {
        toast('추출된 텍스트가 너무 커요. 페이지 범위를 줄여주세요.', 'warning');
        return;
      }

      onRangeReady?.({
        pdf: activePdf,
        pageStart,
        pageEnd,
        rawText: text,
      });
      setActivePdf(null); // 모달 닫기
    } catch (err) {
      toast('텍스트 추출 실패: ' + err.message, 'error');
    } finally {
      setExtractingRange(false);
    }
  };

  const handleSelectExistingPdf = (pdf) => {
    // 가장 최근 분석 범위의 다음부터 기본값으로
    const lastPage = pdf.last_page_read || 1;
    const suggested = suggestChunkSize(pdf.page_count);
    setActivePdf(pdf);
    setPageStart(lastPage);
    setPageEnd(Math.min(lastPage + suggested - 1, pdf.page_count));
  };

  if (!user) return null;

  return (
    <div className="card add-form" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>📚 내 PDF 책장</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            PDF를 업로드하고 페이지 범위별로 분석할 수 있어요
          </p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <Button
            onClick={() => {
              if (!agreedCopyright) {
                toast('먼저 아래 저작권 동의를 체크해주세요.', 'warning');
                return;
              }
              fileInputRef.current?.click();
            }}
            disabled={uploading}
          >
            {uploading ? '업로드 중...' : '＋ PDF 업로드'}
          </Button>
        </div>
      </div>

      <label style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: '0.78rem', color: 'var(--text-secondary)',
        padding: '8px 12px', background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-md)', marginBottom: 12,
        cursor: 'pointer',
      }}>
        <input
          type="checkbox"
          checked={agreedCopyright}
          onChange={e => setAgreedCopyright(e.target.checked)}
        />
        본인 학습 목적으로만 사용하며, 저작권 자료를 공개 공유하지 않겠습니다.
      </label>

      {pdfs.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          아직 업로드한 PDF가 없어요. 첫 책을 올려보세요!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pdfs.map(pdf => {
            const isExpanded = expandedPdfId === pdf.id;
            return (
              <div key={pdf.id} style={{
                padding: 12, background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      📘 {pdf.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {pdf.page_count}페이지 · {new Date(pdf.created_at).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <Button size="sm" variant="ghost" onClick={() => setExpandedPdfId(isExpanded ? null : pdf.id)}>
                      {isExpanded ? '▲' : '▼'}
                    </Button>
                    <Button size="sm" onClick={() => handleSelectExistingPdf(pdf)}>
                      범위 선택
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmDelete(pdf)}
                      style={{ color: 'var(--danger)' }}
                    >
                      🗑️
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <PdfRangesList pdfId={pdf.id} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 범위 선택 모달 */}
      {activePdf && (
        <div className="modal-overlay" onClick={() => !extractingRange && setActivePdf(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem' }}>📖 {activePdf.title}</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              총 {activePdf.page_count}페이지 · 분석할 범위를 선택하세요
            </p>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <label style={{ fontSize: '0.85rem' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: 4 }}>시작</div>
                <input
                  type="number"
                  min={1}
                  max={activePdf.page_count}
                  value={pageStart}
                  onChange={e => setPageStart(Math.max(1, Math.min(activePdf.page_count, parseInt(e.target.value) || 1)))}
                  className="form-input"
                  style={{ width: 90 }}
                />
              </label>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 20 }}>~</span>
              <label style={{ fontSize: '0.85rem' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: 4 }}>끝</div>
                <input
                  type="number"
                  min={pageStart}
                  max={activePdf.page_count}
                  value={pageEnd}
                  onChange={e => setPageEnd(Math.max(pageStart, Math.min(activePdf.page_count, parseInt(e.target.value) || pageStart)))}
                  className="form-input"
                  style={{ width: 90 }}
                />
              </label>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 20 }}>
                ({pageEnd - pageStart + 1}페이지)
              </span>
            </div>

            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              💡 너무 많은 페이지는 분석에 시간이 오래 걸려요. 5~10페이지가 적절합니다.
            </p>

            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" onClick={() => setActivePdf(null)} disabled={extractingRange} style={{ flex: 1 }}>
                건너뛰기
              </Button>
              <Button onClick={handleExtractAndAnalyze} disabled={extractingRange} style={{ flex: 2 }}>
                {extractingRange ? '텍스트 추출 중...' : `p.${pageStart}-${pageEnd} 가져오기 →`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 */}
      <DeletePdfConfirm
        pdf={confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => {
          deletePdfMutation.mutate(confirmDelete);
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}

/** 특정 PDF의 분석된 범위 목록 */
function PdfRangesList({ pdfId }) {
  const { data: ranges = [], isLoading } = useQuery({
    queryKey: ['pdf-ranges', pdfId],
    queryFn: () => fetchPdfAnalyzedRanges(pdfId),
  });

  if (isLoading) return <div style={{ padding: 10, fontSize: '0.8rem', color: 'var(--text-muted)' }}>로딩 중...</div>;
  if (ranges.length === 0) {
    return (
      <div style={{ padding: '10px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        아직 분석된 범위가 없어요. "범위 선택"으로 시작하세요.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {ranges.map(r => {
        const status = r.processed_json?.status || 'idle';
        const statusLabel = {
          completed: '✅ 완료', analyzing: '🔄 분석 중', partial: '⚠️ 일부 실패',
          idle: '⏳ 대기', failed: '❌ 실패',
        }[status] || status;
        return (
          <a
            key={r.id}
            href={`/viewer/${r.id}`}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 10px', background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-sm)', fontSize: '0.82rem',
              textDecoration: 'none', color: 'var(--text-primary)',
            }}
          >
            <span>📄 p.{r.page_start}-{r.page_end}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{statusLabel}</span>
          </a>
        );
      })}
    </div>
  );
}

function DeletePdfConfirm({ pdf, onClose, onConfirm }) {
  const [relatedCount, setRelatedCount] = useState(null);

  useEffect(() => {
    if (!pdf) { setRelatedCount(null); return; }
    supabase
      .from('reading_materials')
      .select('*', { count: 'exact', head: true })
      .eq('source_pdf_id', pdf.id)
      .then(({ count }) => setRelatedCount(count || 0));
  }, [pdf]);

  return (
    <ConfirmModal
      open={!!pdf}
      title="PDF 삭제"
      message={
        relatedCount === null
          ? '정보 확인 중...'
          : relatedCount === 0
            ? `"${pdf?.title}"을 삭제할까요?`
            : `"${pdf?.title}"을 삭제하면 연결된 ${relatedCount}개 분석 자료도 함께 삭제됩니다. 저장한 단어는 단어장에 남습니다. 계속할까요?`
      }
      confirmLabel="삭제"
      onConfirm={onConfirm}
      onCancel={onClose}
    />
  );
}
