'use client';

/**
 * 문법 패턴 카드 (v2-G R1, #1077 설계 §3).
 *
 * 본문에서 표지(把·越来越·除了…)를 만난 자리에 정본 문형을 붙인다. 지금까지 [자세히]는
 * 뷰어→챕터 단방향이라, 챕터에서 배운 문법이 본문에서 다시 만나지지 않았다 — 그 역방향을
 * 여는 카드다.
 *
 * 톤은 **후보**다. 1단 표지어 스캔이라 是…的와 단순 是를 구별하지 못한다 — "이 문장은
 * 이 문형이다"가 아니라 "이 표지가 쓰이는 문형은 이런 것들"이라고 말한다.
 */
import { useMemo } from 'react';
import Link from 'next/link';
import { orderPatternsByMark } from '../lib/patternIndex';

/** 한 표지가 여러 문형에 걸릴 때 몇 개까지 펼칠지 — 把는 14개다. 나머지는 수로만. */
export const PATTERN_CARD_MAX = 3;

export default function PatternCard({ hit, dueSlugs, weakSlugs }) {
  // 표식이 붙은 문형이 앞으로 온다(v2-G R2) — 잘리는 자리가 3개뿐이라 순서가 곧 노출이다.
  // 두 축을 합쳐서 민다: '전체'로 보는 중에도 지금 봐야 할 것이 잘려 나가면 안 된다.
  const marked = useMemo(() => {
    if (!dueSlugs && !weakSlugs) return null;
    return new Set([...(dueSlugs || []), ...(weakSlugs || [])]);
  }, [dueSlugs, weakSlugs]);
  const patterns = orderPatternsByMark(hit?.patterns, marked);
  if (patterns.length === 0) return null;

  const shown = patterns.slice(0, PATTERN_CARD_MAX);
  const restCount = patterns.length - shown.length;

  return (
    <div className="pattern-card">
      <div className="pattern-card__head">
        <b lang="zh-Hans">{hit.kernel}</b>
        <span>이 표지가 쓰이는 문형</span>
      </div>

      {shown.map((p) => (
        <div key={p.id} className="pattern-card__item">
          <div className="pattern-card__line">
            <span className="pattern-card__pat" lang="zh-Hans">{p.pattern}</span>
            <span className="pattern-card__lv">{p.level}</span>
            {/* 복습 예정 표식(v2-G R2) — 이 문형을 지금 본문에서 만나면 그게 복습이다.
                큐를 안 읽었거나(전체 모드·비로그인) 예정이 아니면 아무 표시도 없다. */}
            {p.ch && dueSlugs?.has(p.ch) && <span className="pattern-card__due">복습 예정</span>}
            {/* 약점 표식(v2-A 결합) — 시간이 아니라 기록이 부르는 자리다. 색을 새로 만들지
                않고 테두리 알약으로 가른다: 채운 알약 둘(레벨·복습 예정)과 형태로 구분된다. */}
            {p.ch && weakSlugs?.has(p.ch) && <span className="pattern-card__weak">자주 틀림</span>}
          </div>
          {p.ko && <div className="pattern-card__ko">{p.ko}</div>}
          {p.conn && <div className="pattern-card__conn">{p.conn}</div>}
          {p.ex?.zh && (
            <div className="pattern-card__ex">
              <span lang="zh-Hans">{p.ex.zh}</span>
              {p.ex.ko && <em>{p.ex.ko}</em>}
            </div>
          )}
          {/* 챕터 링크가 이 카드의 존재 이유 — 본문에서 만난 문법을 배운 자리로 되돌린다.
              정본에 없는 slug는 인덱스가 이미 링크를 지웠으므로 죽은 화살표가 남지 않는다. */}
          {p.href && <Link className="pattern-card__go" href={p.href}>챕터로 →</Link>}
        </div>
      ))}

      {restCount > 0 && (
        <div className="pattern-card__more">이 표지를 쓰는 문형 {restCount}개가 더 있어요</div>
      )}
    </div>
  );
}
