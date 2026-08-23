/**
 * 재독 후보 선정 엔진 (#1077 제안 12 — 발주 5386788169 회수분, Claude 직접 수행).
 * 순수 모듈: 완독한 자료를 14일 뒤 "다시 읽기"로 되부른다(repeated reading 선례).
 * 홈 카드·쿼리 배선은 별도 라운드. 날짜 경계는 growthStats 정본만(신설 금지).
 */
import { kstDayStartMs } from './growthStats';

export const REREAD_AFTER_DAYS = 14;
const DAY_MS = 86400000;

/**
 * 재독 후보 — 완독(is_completed) 후 KST 일 단위로 14일 이상 지난 자료,
 * 완독 최신순 상위 3건. 무효 행(completed_at 없음·파싱 불가)은 조용히 제외.
 * @param {{ progressRows: Array<{material_id, is_completed, completed_at}>, now?: number }} p
 * @returns {Array<{ material_id, completed_at, daysSince }>}
 */
export function pickRereadCandidates({ progressRows, now = Date.now() } = {}) {
  const todayStart = kstDayStartMs(now);
  const out = [];
  for (const r of progressRows || []) {
    if (!r?.is_completed || !r?.completed_at) continue;
    const t = new Date(r.completed_at).getTime();
    if (!Number.isFinite(t)) continue;
    const daysSince = Math.floor((todayStart - kstDayStartMs(t)) / DAY_MS);
    if (daysSince < REREAD_AFTER_DAYS) continue;
    out.push({ material_id: r.material_id, completed_at: r.completed_at, daysSince });
  }
  out.sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at));
  return out.slice(0, 3);
}
