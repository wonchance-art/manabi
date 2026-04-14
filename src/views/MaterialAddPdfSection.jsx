'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import Button from '../components/Button';
import ConfirmModal from '../components/ConfirmModal';
import { getPdfMetadata, extractPageRange, ocrPageRange, suggestChunkSize, renderPageAsBase64 } from '../lib/pdfExtract';
import { getCachedPdf, cachePdf, removeCachedPdf } from '../lib/pdfCache';

const MAX_PDF_SIZE = 50 * 1024 * 1024; // 50MB

async function fetchMyPdfs(userId) {
  const { data, error } = await supabase
    .from('uploaded_pdfs')
    .select('id, title, filename, page_count, language, level, last_page_read, created_at, thumbnail_path')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/** base64 → Blob */
function base64ToBlob(base64, mimeType = 'image/jpeg') {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mimeType });
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
  const [useOcr, setUseOcr] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(null); // { current, total, pageNum }

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
      // Storage에서 PDF + 썸네일 삭제
      const paths = [pdf.storage_path];
      if (pdf.thumbnail_path) paths.push(pdf.thumbnail_path);
      const { error: storageErr } = await supabase.storage
        .from('user-pdfs')
        .remove(paths);
      if (storageErr) console.warn('[pdf delete] storage error:', storageErr.message);

      // IndexedDB 캐시 제거
      removeCachedPdf(pdf.id).catch(() => {});

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
      const { pageCount, isLikelyScanned, avgCharsPerPage } = await getPdfMetadata(buffer);

      if (isLikelyScanned) {
        toast(
          `📷 스캔본으로 감지됐어요 (페이지당 평균 ${avgCharsPerPage}자). OCR 모드로 추출합니다. 시간이 조금 더 걸려요.`,
          'info',
          6000,
        );
        setUseOcr(true);
      } else {
        setUseOcr(false);
      }

      // 2. Storage 업로드
      const pdfId = crypto.randomUUID();
      const storagePath = `${user.id}/${pdfId}.pdf`;
      const { error: uploadErr } = await supabase.storage
        .from('user-pdfs')
        .upload(storagePath, file, { contentType: 'application/pdf' });
      if (uploadErr) throw uploadErr;

      // 3. 첫 페이지 썸네일 생성 + 업로드 (실패해도 본 업로드는 성공 처리)
      let thumbnailPath = null;
      try {
        const { doc } = await getPdfMetadata(buffer);
        const thumbBase64 = await renderPageAsBase64(doc, 1, 400); // 작게 렌더
        const thumbBlob = base64ToBlob(thumbBase64, 'image/jpeg');
        thumbnailPath = `${user.id}/${pdfId}_thumb.jpg`;
        const { error: thumbErr } = await supabase.storage
          .from('user-pdfs')
          .upload(thumbnailPath, thumbBlob, { contentType: 'image/jpeg' });
        if (thumbErr) { console.warn('[pdf thumbnail]', thumbErr.message); thumbnailPath = null; }
      } catch (err) {
        console.warn('[pdf thumbnail] failed:', err?.message);
      }

      // 4. uploaded_pdfs insert
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
          thumbnail_path: thumbnailPath,
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
    setOcrProgress(null);
    try {
      // 1차: IndexedDB 캐시 확인
      let buffer = await getCachedPdf(activePdf.id);

      if (!buffer) {
        // 캐시 없으면 Storage에서 다운로드
        const { data: signed } = await supabase.storage
          .from('user-pdfs')
          .createSignedUrl(activePdf.storage_path, 60);
        if (!signed?.signedUrl) throw new Error('PDF 접근 실패');

        const res = await fetch(signed.signedUrl);
        buffer = await res.arrayBuffer();
        // 캐시에 저장 (실패해도 진행)
        cachePdf(activePdf.id, buffer).catch(() => {});
      }

      let text;
      if (useOcr) {
        // OCR 경로: pdfjs doc 먼저 로드
        const { getPdfMetadata } = await import('../lib/pdfExtract');
        const { doc } = await getPdfMetadata(buffer);
        text = await ocrPageRange(doc, pageStart, pageEnd, (current, total, pageNum) => {
          setOcrProgress({ current, total, pageNum });
        });
      } else {
        text = await extractPageRange(buffer, pageStart, pageEnd);
      }

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
      setActivePdf(null);
    } catch (err) {
      toast('텍스트 추출 실패: ' + err.message, 'error');
    } finally {
      setExtractingRange(false);
      setOcrProgress(null);
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
                  {pdf.thumbnail_path && (
                    <PdfThumbnail path={pdf.thumbnail_path} title={pdf.title} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {!pdf.thumbnail_path && '📘 '}{pdf.title}
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

            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
              💡 너무 많은 페이지는 분석에 시간이 오래 걸려요. 5~10페이지가 적절합니다.
            </p>

            {/* OCR 토글 */}
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '10px 12px', marginBottom: 12,
              background: useOcr ? 'var(--primary-glow)' : 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${useOcr ? 'var(--primary)' : 'var(--border)'}`,
              cursor: 'pointer', fontSize: '0.82rem',
            }}>
              <input
                type="checkbox"
                checked={useOcr}
                onChange={e => setUseOcr(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <div>
                <div style={{ fontWeight: 600 }}>
                  📷 OCR 모드 (이미지 기반 PDF)
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  스캔본·이미지 PDF용. 페이지마다 AI가 텍스트를 읽어요. 추출에 페이지당 3~10초 소요.
                </div>
              </div>
            </label>

            {/* 진행률 */}
            {ocrProgress && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 4 }}>
                  <span>📷 OCR 진행 중 (p.{ocrProgress.pageNum})</span>
                  <span style={{ fontWeight: 700 }}>{ocrProgress.current}/{ocrProgress.total}</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${(ocrProgress.current / ocrProgress.total) * 100}%`,
                    background: 'var(--primary-light)',
                    transition: 'width 0.3s',
                  }} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" onClick={() => setActivePdf(null)} disabled={extractingRange} style={{ flex: 1 }}>
                건너뛰기
              </Button>
              <Button onClick={handleExtractAndAnalyze} disabled={extractingRange} style={{ flex: 2 }}>
                {extractingRange
                  ? (useOcr ? '📷 OCR 추출 중...' : '텍스트 추출 중...')
                  : useOcr
                    ? `🤖 OCR로 p.${pageStart}-${pageEnd} 추출 →`
                    : `p.${pageStart}-${pageEnd} 가져오기 →`}
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

/** 썸네일 표시 — signed URL 요청 후 캐시 */
function PdfThumbnail({ path, title }) {
  const { data: url } = useQuery({
    queryKey: ['pdf-thumb', path],
    queryFn: async () => {
      const { data } = await supabase.storage
        .from('user-pdfs')
        .createSignedUrl(path, 60 * 60); // 1시간
      return data?.signedUrl || null;
    },
    staleTime: 1000 * 60 * 50, // 50분 (만료 전)
  });

  if (!url) {
    return <div style={{
      width: 44, height: 56,
      background: 'var(--bg-primary)', border: '1px solid var(--border)',
      borderRadius: 4, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem',
    }}>📘</div>;
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={url}
      alt={`${title} 미리보기`}
      style={{
        width: 44, height: 56,
        objectFit: 'cover',
        borderRadius: 4,
        border: '1px solid var(--border)',
        flexShrink: 0,
      }}
      loading="lazy"
    />
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
