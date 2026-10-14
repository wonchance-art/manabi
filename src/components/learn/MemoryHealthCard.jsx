'use client';
/**
 * 기억 건강(현황 2×2) — 선명 · 양호 · 흐릿 · 위험 + 복습 스케줄 7일. 색과 문구는 예전 그대로(오너 결정), 숫자는 잉크 · 색은 점에만.
 * 칩 언어로 거른다. 「흐릿」 · 「위험」을 누르면 그 언어의 흐릿한 표현 복습(`/vocab?lang=…&state=fragile`, 정정 2026-10-11).
 */
import Link from 'next/link';
import { memoryHealth } from '@/lib/memoryHealth';
import { serializeReviewScope, wordScopeLanguage } from '@/lib/reviewScope';

const BUCKETS = [
  { key: 'high', label: '선명', color: 'var(--accent-text)' },
  { key: 'mid', label: '양호', color: 'var(--primary-light)' },
  { key: 'low', label: '흐릿', color: 'var(--warning)', fragile: true },
  { key: 'forgotten', label: '위험', color: 'var(--danger)', fragile: true },
];

export default function MemoryHealthCard({ lang, projections = [], now, className = '' }) {
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
    </div>
  );
}
