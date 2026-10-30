'use client';
/**
 * 실제 기억률 표(TRUE-RET-001 · docs/design/true-retention.md 목업) — 현황 기억 건강 칸의 한 줄을 누르면 TileModal 안에 편다.
 * 줄: 오늘 · 어제 · 지난 7일 · 지난 30일 · 지난 1년 · 전체 / 열: 익히는 중 · 익숙 · 전체 / 칸: 「88% (22)」 또는 「—」.
 * 1년 · 전체 줄은 긴 조회(모달을 열 때 받는다)가 끝나야 숫자를 적는다 — 그 전에는 「…」, 실패면 「—」와 다시 시도.
 * 목표 대비 색 · 화살표는 없다(거울이지 성적표가 아니다). 계산 · 문구 규칙은 lib/trueRetention 정본.
 */
import Link from 'next/link';
import { MATURE_MIN_INTERVAL } from '@/lib/growthStats';
import {
  TRUE_RETENTION_COLUMNS, TRUE_RETENTION_LABELS, TRUE_RETENTION_RECENT_KEYS,
  formatRetentionCell, retentionTargetLabel,
} from '@/lib/trueRetention';

/**
 * @param {object} p
 * @param {object|null} p.table - buildTrueRetention 결과(긴 조회가 있으면 그것, 없으면 짧은 창)
 * @param {'loading'|'error'|'ready'} p.longStatus - 1년 · 전체 조회 상태
 * @param {boolean} [p.failed] - 짧은 창 조회도 실패(표를 그릴 재료가 없음)
 * @param {() => void} [p.onRetry] - 다시 시도(실패한 조회를 다시 받는다)
 * @param {string} p.reviewHref - 빈 상태의 「복습하기」 주소
 */
export default function TrueRetentionTable({ table, longStatus, failed = false, onRetry, reviewHref }) {
  const longReady = longStatus === 'ready';
  if (!table) {
    return failed
      ? <div className="learn-true__empty" role="alert"><p>실제 기억률을 불러오지 못했어요.</p><button type="button" className="learn-button-s" onClick={onRetry}>다시 시도</button></div>
      : <p className="learn-true__state" aria-busy="true">실제 기억률 불러오는 중…</p>;
  }
  const cellOf = (key, part) => table.periods.find(p => p.key === key)?.[part];
  const everything = cellOf('all', 'all');
  // 짧은 창이 비었는데 긴 조회가 아직이면 빈 상태를 단정하지 않는다(30일 밖에만 복습이 있을 수 있다).
  if (!longReady && longStatus === 'loading' && !(cellOf('month', 'all')?.total > 0)) {
    return <p className="learn-true__state" aria-busy="true">실제 기억률 불러오는 중…</p>;
  }
  if (longReady && !(everything?.total > 0)) {
    return (
      <div className="learn-true__empty">
        <p>아직 실제 기억률을 잴 복습이 없어요</p>
        <Link href={reviewHref} prefetch={false} className="learn-button-s">복습하기</Link>
      </div>
    );
  }
  const shown = key => longReady || TRUE_RETENTION_RECENT_KEYS.includes(key);
  return (
    <div className="learn-true">
      <p className="learn-true__lead">복습 단계 단어를 다시 만났을 때 기억해 낸 비율이에요. 「다시」를 누른 답만 못 떠올린 것으로 세요.</p>
      <table className="learn-true__table" aria-busy={longStatus === 'loading' || undefined}>
        <thead>
          <tr>
            <th scope="col"><span className="sr-only">기간</span></th>
            {TRUE_RETENTION_COLUMNS.map(col => <th key={col.key} scope="col">{col.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {table.periods.map(period => (
            <tr key={period.key}>
              <th scope="row">{TRUE_RETENTION_LABELS[period.key]}</th>
              {TRUE_RETENTION_COLUMNS.map(col => (
                <td key={col.key}>
                  {shown(period.key) ? formatRetentionCell(period[col.key]) : longStatus === 'loading' ? '…' : '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {longStatus === 'error' && (
        <div className="learn-true__retry" role="alert">
          <p className="learn-true__note">지난 1년 · 전체를 불러오지 못했어요.</p>
          <button type="button" className="learn-button-s" onClick={onRetry}>다시 시도</button>
        </div>
      )}
      <p className="learn-true__note">{retentionTargetLabel(table.target)} — 오래 보면 이 근처에 모여요. 하루 값은 흔들리니 30일 줄을 보세요.</p>
      <p className="learn-true__note">익숙 = 간격 {MATURE_MIN_INTERVAL}일 이상 · 괄호 = 답 수 · 연습 · 되돌린 답 · 학습 단계 답은 빼요.</p>
      {table.estimated > 0 && (
        <p className="learn-true__note">예전 일정 단어 답 {table.estimated.toLocaleString('ko-KR')}개는 간격을 지난 날짜로 어림했어요.</p>
      )}
    </div>
  );
}
