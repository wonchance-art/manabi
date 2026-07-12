'use client';

/**
 * 관리자 전용 슬림 스트립 — 챕터 페이지 하단에 항상 마운트되는 작은 클라이언트 컴포넌트.
 *
 * 편집은 본문 각 요소의 인라인 연필(InlineEdit)에서 한다. 이 스트립은 상태·복원만 담당:
 *  - "수정본 적용 중" 배지(override 존재 시)
 *  - [파일 버전으로 복원] — DELETE(확인 후) → router.refresh()
 * 창·오버레이는 없다. 챕터 데이터는 props로 받지 않는다(일반 유저 페이로드 보호 — lang·slug·overridden만).
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../lib/ToastContext';

export default function ChapterAdminStrip({ lang, slug, overridden = false }) {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  if (!isAdmin) return null;

  async function handleRestore() {
    if (!window.confirm('이 챕터의 수정본을 삭제하고 파일 버전으로 되돌릴까요?')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/chapter', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang, slug }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(json.error || '복원에 실패했어요.', 'error');
        return;
      }
      toast('파일 버전으로 복원했어요.', 'success');
      router.refresh();
    } catch {
      toast('네트워크 오류로 복원하지 못했어요.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-strip" role="region" aria-label="관리자 편집">
      <span className="admin-strip__hint">
        문장 오른쪽 <span aria-hidden="true">✎</span> 로 편집
      </span>
      {overridden && <span className="admin-strip__badge">수정본 적용 중</span>}
      {overridden && (
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={handleRestore}
          disabled={busy}
        >
          {busy ? '복원 중…' : '파일 버전으로 복원'}
        </button>
      )}
    </div>
  );
}
