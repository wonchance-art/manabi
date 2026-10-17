// 분석 전 공개 자료 일괄 분석(BULK-ANALYZE-001, 오너 「권장대로」 2026-10-17 KST) — 순수 판정만. 화면은 components/admin/BulkAnalysisPanel.
// 대상: 내 소유(분석 저장 RPC viewer_replace_analysis가 owner_id = auth.uid()만 고친다) · 공개 · 미분석 표지(idle · pending · saved —
// 뷰어 isPending과 같은 집합) · 원문 있음. 수업 팀 설정 행(isTeamRoot)과 정본 책(isCanonicalBookKey)은 뺀다.
import { isTeamRoot } from './classTeamRoot.js';
import { isCanonicalBookKey } from './canonicalBookKey.js';

export const BULK_PENDING_STATUSES = Object.freeze(['idle', 'pending', 'saved']);
export const BULK_FAILURE_STOP = 3; // 연달아 이만큼 실패하면 할당량 · 네트워크 같은 공통 원인으로 보고 멈춘다(정본 문학책 패널과 같은 값)

export function bulkAnalysisTargets(rows, ownerId) {
  return (rows || []).filter((row) => row && ownerId && row.owner_id === ownerId && row.visibility === 'public'
    && BULK_PENDING_STATUSES.includes(row.status) && Number(row.raw_length) > 0
    && !isTeamRoot(row) && !isCanonicalBookKey(row.book_key));
}
