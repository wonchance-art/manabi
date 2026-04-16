'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabase';
import Button from './Button';

const REASONS = [
  { value: 'inappropriate', label: '부적절한 콘텐츠' },
  { value: 'copyright',     label: '저작권 침해' },
  { value: 'spam',          label: '스팸/광고' },
  { value: 'other',         label: '기타' },
];

export default function ReportMaterialButton({ materialId, userId, toast }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('inappropriate');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (submitting || !userId) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('content_reports').insert({
        material_id: materialId,
        reporter_id: userId,
        reason,
        details: details.trim() || null,
      });
      if (error) {
        if (error.code === '23505') {
          toast('이미 신고한 자료예요.', 'info');
        } else {
          throw error;
        }
      } else {
        toast('신고가 접수됐어요. 검토 후 조치하겠습니다.', 'success');
      }
      setOpen(false);
      setDetails('');
    } catch (err) {
      toast('신고 실패 — ' + (err?.message || '잠시 후 다시 시도'), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (!userId) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: 'transparent', border: 'none',
          color: 'var(--text-muted)', fontSize: '0.78rem',
          cursor: 'pointer', padding: '4px 8px', textDecoration: 'underline',
        }}
        title="이 자료를 신고합니다"
      >
        🚩 신고
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => !submitting && setOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h3 style={{ margin: '0 0 8px' }}>🚩 자료 신고</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
              이 자료가 부적절하다고 생각하시면 이유를 선택해주세요.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {REASONS.map(r => (
                <label key={r.value} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="report-reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={e => setReason(e.target.value)}
                  />
                  {r.label}
                </label>
              ))}
            </div>

            <textarea
              value={details}
              onChange={e => setDetails(e.target.value)}
              placeholder="추가 설명 (선택)"
              className="form-input"
              rows={3}
              maxLength={500}
              style={{ marginBottom: 14, resize: 'vertical' }}
            />

            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting} style={{ flex: 1 }}>
                취소
              </Button>
              <Button onClick={handleSubmit} disabled={submitting} style={{ flex: 1 }}>
                {submitting ? '접수 중...' : '신고'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
