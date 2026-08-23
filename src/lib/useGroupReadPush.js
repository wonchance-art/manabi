'use client';

/**
 * 뷰어 → 그룹 같이 읽기 진도 push (rfc-study-groups §4.3).
 * 이 자료가 내 그룹들의 이번 주 지정 자료면, 스크롤 진도의 세션 최대값을 30초 스로틀로
 * 스냅샷 material_pct 에 올린다(그룹 페이지 진도 바·토론 게이트의 원천).
 * 해당 없음·게스트·실패는 전부 조용히 — 뷰어 본연 동작 무영향(무해성 계약).
 */
import { useEffect, useRef } from 'react';
import { fetchGroupsReadingMaterial, kstWeekStartDate, pushMaterialPct } from './studyGroups';

const PUSH_INTERVAL_MS = 30000;

export function useGroupReadPush(materialId, userId, readProgress) {
  const groupsRef = useRef(null); // null=미조회, []=해당 없음
  const maxRef = useRef(0);
  const lastPushedRef = useRef(-1);

  useEffect(() => {
    groupsRef.current = null;
    maxRef.current = 0;
    lastPushedRef.current = -1;
    if (!materialId || !userId) return undefined;
    let alive = true;
    fetchGroupsReadingMaterial(materialId, kstWeekStartDate())
      .then((ids) => { if (alive) groupsRef.current = ids; })
      .catch(() => { if (alive) groupsRef.current = []; });
    return () => { alive = false; };
  }, [materialId, userId]);

  // 세션 최대값 추적 — 뒤로 스크롤·재방문으로 진도가 후퇴하지 않게
  useEffect(() => {
    if (readProgress > maxRef.current) maxRef.current = readProgress;
  }, [readProgress]);

  useEffect(() => {
    if (!materialId || !userId) return undefined;
    const flush = () => {
      const ids = groupsRef.current;
      const pct = maxRef.current;
      if (!ids?.length || pct <= lastPushedRef.current) return;
      lastPushedRef.current = pct;
      Promise.resolve(pushMaterialPct(ids, userId, pct)).catch(() => {});
    };
    const timer = setInterval(flush, PUSH_INTERVAL_MS);
    window.addEventListener('pagehide', flush);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pagehide', flush);
      flush(); // 언마운트(자료 전환·이탈) 시 마지막 반영
    };
  }, [materialId, userId]);
}
