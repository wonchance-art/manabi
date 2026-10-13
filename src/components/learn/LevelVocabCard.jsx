'use client';
/**
 * 레벨 어휘(현황 2×2) — 레벨마다 [아는 단어 / 복습 중 막대][확보 수 / 전체 수]. 줄을 누르면 그 급수 범위의 복습방
 * (`/vocab?lang=Chinese&level=H2` — serializeReviewScope, 정정 2026-10-11).
 * 계산은 정본 두 함수: haveWordSet(담은 표현 ∪ 이미 앎) · vocabCoverage. 급수는 화면 정본 HSK 2026 표(zhHskLevelOf)라
 * 복습 범위의 급수 판정과 같다. 표는 이 화면에서만 받는다(홈 첫 화면은 받지 않는다).
 * 레벨 목록이 없는 언어는 「준비 중」 한 줄(목업 — 한국어 · 프랑스어 · 일본어 N급은 결정 전).
 */
import { useMemo } from 'react';
import Link from 'next/link';
import { haveWordSet, vocabCoverage } from '@/lib/goalVocab';
import { useZhHskLevels, zhHskLevelOf } from '@/lib/zhHskLevel';
import { ZH_SCOPE_LEVELS, scopeLevelLabel, serializeReviewScope } from '@/lib/reviewScope';

const LEVEL_KEYS = ZH_SCOPE_LEVELS.filter(key => key !== 'NONE');

export function levelIndex(levels) {
  const index = new Map();
  for (const word of Object.keys(levels || {})) {
    const level = zhHskLevelOf(word, levels);
    if (level) index.set(word, { level: `H${level}` });
  }
  return index;
}

export default function LevelVocabCard({ lang, vocab = [], projections = [], knownRows = [], className = '' }) {
  const supported = lang === 'Chinese';
  const levels = useZhHskLevels(supported);
  const rows = useMemo(() => {
    if (!supported || !levels) return null;
    const index = levelIndex(levels);
    const knownFromVocab = projections.filter(p => p.review?.known).map(p => ({ word_text: p.vocabulary.word_text }));
    const have = vocabCoverage(index, LEVEL_KEYS, haveWordSet({ vocabRows: vocab, knownRows, language: lang }));
    const known = vocabCoverage(index, LEVEL_KEYS, haveWordSet({ knownRows: [...knownRows, ...knownFromVocab] }));
    if (!have) return [];
    const knownBy = new Map((known?.byLevel || []).map(b => [b.level, b.have]));
    return have.byLevel.map(b => ({ ...b, known: knownBy.get(b.level) || 0 }));
  }, [supported, levels, vocab, projections, knownRows, lang]);

  return (
    <div className={`learn-tile learn-levels ${className}`.trim()}>
      <div className="learn-sec-head"><h2 className="learn-sec-title">레벨 어휘</h2></div>
      {!supported ? <p className="learn-center">이 언어의 레벨 목록은 준비 중이에요</p>
        : !rows ? <p className="learn-center" role="status">레벨 어휘 불러오는 중…</p>
          : <>
            <div className="learn-levels__rows">
              {rows.map(row => (
                <Link key={row.level} href={serializeReviewScope({ lang, level: row.level })} prefetch={false} className="learn-levels__row"
                  aria-label={`${scopeLevelLabel(row.level)} 어휘 ${row.total.toLocaleString('ko-KR')}개 중 ${row.have.toLocaleString('ko-KR')}개 확보 · 이 급수 복습하기`}>
                  <span className="learn-levels__key">{scopeLevelLabel(row.level)}</span>
                  <span className="learn-levels__bar" aria-hidden="true">
                    <i className="s" style={{ width: `${(row.have / row.total) * 100}%` }} />
                    <i className="k" style={{ width: `${(row.known / row.total) * 100}%` }} />
                  </span>
                  <span className="learn-levels__have">{row.have.toLocaleString('ko-KR')}</span>
                  <span className="learn-levels__sep" aria-hidden="true">/</span>
                  <span className="learn-levels__total">{row.total.toLocaleString('ko-KR')}</span>
                </Link>
              ))}
            </div>
            <div className="learn-levels__legend" aria-hidden="true"><span><i className="k" />아는 단어</span><span><i className="s" />복습 중</span></div>
          </>}
    </div>
  );
}
