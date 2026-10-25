'use client';
// 훈음 표 구독 훅(HANJA-LAZY-001) — 지연 로드 정본(hanjaTables.js)의 스냅숏을 읽고, 이 언어에 필요한 표가 없으면
// 그 자리에서 받기 시작한다(카드를 처음 그릴 때 = 표가 필요한 첫 상호작용). 뷰어는 별도로 유휴 시간에 미리 받는다.
import { useEffect, useSyncExternalStore } from 'react';
import { hanjaTableNamesFor, hanjaTablesNow, hasHanjaTables, loadHanjaTables, subscribeHanjaTables } from './hanjaTables';

const EMPTY = Object.freeze({ koTable: null, hunTable: null, tradTable: null });
// 서버 그림 · 하이드레이션은 늘 「표 없음」 — 클라이언트 첫 그림과 같게(받은 뒤 다시 그린다).
const serverSnapshot = () => EMPTY;

/** language에 필요한 훈음 표 → { tables, ready }. enabled=false면 받지 않는다(스냅숏만 읽는다). */
export function useHanjaTables(language, { enabled = true } = {}) {
  const tables = useSyncExternalStore(subscribeHanjaTables, hanjaTablesNow, serverSnapshot);
  const names = hanjaTableNamesFor(language);
  const ready = hasHanjaTables(names, tables);
  const want = enabled && names.length > 0 && !ready;
  useEffect(() => {
    if (!want) return;
    loadHanjaTables(hanjaTableNamesFor(language)).catch(() => {}); // 실패하면 훈음 자리만 빈 채 — 다음에 다시 받는다
  }, [want, language]);
  return { tables, ready };
}
