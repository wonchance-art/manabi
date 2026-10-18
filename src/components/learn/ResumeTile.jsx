'use client';
import { ZhSlot } from '@/components/fonts/ScFontLink';
/**
 * 이어 읽기 칸 — 시안 C(위아래 나눔, 오너 확정 2026-10-09). 머리 = 언어 색(v2 --ja/--zh/--en/--fr),
 * 본문 = 원어 제목(주) + 한국어 제목(부), 맨 아래 = [진도 숫자][막대][버튼] — DOM 순서도 이대로.
 * 어떤 목적지를 고를지는 부르는 쪽(HomePage)이 정한다 — 이 칸은 그리기만 한다.
 */
import Link from 'next/link';
import { encounterLookupLang } from '@/lib/refVocabLookup';
import { SkeletonLine, SkeletonRegion } from '@/components/Skeleton';

export default function ResumeTile({ item, pending = false, onClick }) {
  if (pending || !item) {
    // 골격(LOADING-SKELETON-001): 머리 · 제목 두 줄 · 맨 아래 단추 자리 — 실제 칸과 같은 자리, 글만 회색 줄.
    return (
      <SkeletonRegion className="learn-tile learn-resume lang-ja learn-order-resume" label="읽던 위치">
        <span className="learn-resume__head" aria-hidden="true"><span className="learn-resume__kicker">이어 읽기</span></span>
        <span className="learn-resume__body" aria-hidden="true">
          <span className="learn-resume__title"><SkeletonLine width="70%" /></span>
          <span className="learn-resume__sub"><SkeletonLine width="45%" /></span>
        </span>
        <span className="learn-resume__bottom" aria-hidden="true">
          <span className="learn-resume__spacer" />
          <SkeletonLine className="learn-skeleton-pill" width="7.5em" height="40px" />
        </span>
      </SkeletonRegion>
    );
  }
  const code = encounterLookupLang(item.lang) || 'ja';
  const pct = item.count && item.count.total > 0 ? Math.min(100, (item.count.done / item.count.total) * 100) : 0;
  const label = [item.cta, item.kicker, item.number, item.title, item.sub, item.count && `${item.count.done} / ${item.count.total}`]
    .filter(Boolean).join(' · ');
  return (
    <Link href={item.href} prefetch={false} onClick={onClick} className={`learn-tile learn-resume lang-${code} learn-order-resume`} aria-label={label}>
      <ZhSlot lang={item.glyphLang || code}><span className="learn-resume__glyph" lang={item.glyphLang || code} aria-hidden="true">{item.glyph}</span></ZhSlot>
      <span className="learn-resume__head">
        <span className="learn-resume__kicker">{item.kicker}</span>
        {item.number && <span className="learn-resume__num">{item.number}</span>}
      </span>
      <span className="learn-resume__body">
        {/* 제목은 중국어여도 Noto Serif KR로 그린다(learn.css .learn-resume__title) — SC를 기다리지 않는다(ZhSlot 없음, 계약 SC_LINK_NOT_SC). */}
        <span className="learn-resume__title" lang={item.titleLang || undefined}>{item.title}</span>
        {item.sub && <span className="learn-resume__sub">{item.sub}</span>}
      </span>
      <span className="learn-resume__bottom">
        {item.count ? <>
          <span className="learn-resume__count">{item.count.done} / {item.count.total}</span>
          <span className="learn-resume__bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
        </> : <span className="learn-resume__spacer" />}
        <span className="learn-resume__pill">{item.cta}<i aria-hidden="true">→</i></span>
      </span>
    </Link>
  );
}
