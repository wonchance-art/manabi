'use client';
/**
 * 기억 건강(현황 2×2) — 선명 · 양호 · 흐릿 · 위험 + 복습 스케줄 7일. 색과 문구는 예전 그대로(오너 결정), 숫자는 잉크 · 색은 점에만.
 * 칩 언어로 거른다. 「흐릿」 · 「위험」을 누르면 그 언어의 흐릿한 표현 복습(`/vocab?lang=…&state=fragile`, 정정 2026-10-11).
 * 맨 아래 「실제 기억률」 한 줄(TRUE-RET-001) — trueRetention({ table, loading })이 없으면(손님) 줄을 그리지 않는다.
 */
import Link from 'next/link';
import { memoryHealth } from '@/lib/memoryHealth';
import { serializeReviewScope, wordScopeLanguage } from '@/lib/reviewScope';
import { trueRetentionLine } from '@/lib/trueRetention';

const BUCKETS = [
  { key: 'high', label: '선명', color: 'var(--accent-text)' },
  { key: 'mid', label: '양호', color: 'var(--primary-light)' },
  { key: 'low', label: '흐릿', color: 'var(--warning)', fragile: true },
  { key: 'forgotten', label: '위험', color: 'var(--danger)', fragile: true },
];

export default function MemoryHealthCard({ lang, projections = [], now, className = '', trueRetention = null, onOpenTrueRetention }) {
  const mine = projections.filter(p => wordScopeLanguage(p.vocabulary) === lang);
  const health = memoryHealth(mine, now);
  const max = Math.max(1, ...health.calendar.map(day => day.count));
  const fragileHref = serializeReviewScope({ lang, state: 'fragile' });
  return (
    <div className={`learn-tile learn-memory ${className}`.trim()}>
      <div className="learn-sec-head">
        <h2 className="learn-sec-title">기억 건강</h2>
        <span className="learn-memory__ret">유지율 {health.avgRetention == null ? '—' : `${health.avgRetention}%`}</span>
      </div>
      <div className="learn-memory__buckets">
        {BUCKETS.map(bucket => {
          const count = health.measured ? health.buckets[bucket.key] : '—';
          const body = <><small style={{ color: bucket.color }} aria-hidden="true">●</small><b>{count}</b><span>{bucket.label}</span></>;
          return bucket.fragile && health.measured
            ? <Link key={bucket.key} href={fragileHref} prefetch={false} className="learn-memory__bucket" aria-label={`${bucket.label} ${count}개 · 흐릿한 표현 복습하기`}>{body}</Link>
            : <div key={bucket.key} className="learn-memory__bucket">{body}</div>;
        })}
      </div>
      <p className="learn-memory__s">복습 스케줄</p>
      <div className="learn-memory__fc">
        {health.calendar.map(({ key, count }, i) => (
          <div key={key} className="learn-memory__col">
            <span className="learn-memory__n">{count > 0 ? count : ' '}</span>
            <span className="learn-memory__area"><i className={count > 0 ? undefined : 'is-zero'} style={{ height: `${(count / max) * 100}%`, minHeight: count > 0 ? 4 : 2 }} /></span>
            <span className="learn-memory__l">{i === 0 ? '오늘' : `${Number(key.slice(5, 7))}/${Number(key.slice(8))}`}</span>
          </div>
        ))}
      </div>
      {trueRetention && <TrueRetentionLine {...trueRetention} onOpen={onOpenTrueRetention} />}
    </div>
  );
}

/* 실제 기억률 한 줄(TRUE-RET-001, 오너 결정 2026-10-30 KST 「기억 건강 칸에 한 줄로」) — 지난 30일 전체 칸만, 답 10개 미만이면 「—」.
   목표 대비 색 · 화살표 없음. 누르면 현황이 TileModal로 기간별 표를 편다. 「유지율」(예측)과 다른 값이라 이름을 섞지 않는다. */
function TrueRetentionLine({ table, loading = false, onOpen }) {
  const line = trueRetentionLine(table);
  const spoken = `실제 기억률 지난 30일 ${line.measured ? line.value : '아직 없음'}${line.target ? `, ${line.target}` : ''} · 기간별 표 보기`;
  return (
    <button type="button" className="learn-memory__true" onClick={onOpen} aria-haspopup="dialog" aria-label={spoken} aria-busy={loading || undefined}>
      <span className="learn-memory__true-k">실제 기억률 · 지난 30일</span>
      <b className="learn-memory__true-v">{line.value}</b>
      {line.target && <span className="learn-memory__true-t">({line.target})</span>}
      <span className="learn-memory__true-go" aria-hidden="true">›</span>
    </button>
  );
}
