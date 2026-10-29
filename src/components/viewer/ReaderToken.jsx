'use client';
import { memo } from 'react';
import { splitRuby } from '../../lib/splitRuby';
import { pinyinPerChar } from '../../lib/viewerHanjaPanel';
import { pinyinToneClass } from '../../lib/pinyinTone';
import { pronHiddenFor } from '../../lib/readingSheet';
import { variantPieces } from '../../lib/scriptVariant';
import { ZhText } from './ZhText';
import { opensWordCard } from '../../lib/wordState';

/**
 * 본문 낱말 하나(분석 완료 토큰) — 뷰어 본문이 낱말 수(수백 개)만큼 그린다(VIEWER-TAP-PERF-001).
 * 낱말을 누르면 뷰어 전체가 다시 그려지는데, 이 칸은 memo라 **바뀐 낱말만**(고른 낱말 · 직전에 고른 낱말 등) 다시 그린다.
 * 실측(390 · 360낱말): 탭 한 번에 낱말 360개 · host 약 1,330개를 모두 다시 그렸다.
 *
 * 마크업 · 클래스 · 속성 · 이벤트는 뷰어가 직접 그리던 것과 같다(ViewerPage renderToken에서 옮김). 바뀌는 값은 모두 원시값 props로 받는다:
 * - className · selected · paceStyle(같은 값이면 같은 객체로 비교 — arePropsEqual)
 * - onTokenClick · onLinePick은 뷰어가 ref로 감싼 고정 함수다(매 렌더 새 함수가 memo를 깨지 않게).
 * - 루비 조각(splitRuby)과 발음 가림(pronHiddenFor)은 이 안에서 계산한다 — 다시 그릴 때만 돈다. 바로 뒤 토큰 표기(nextText)는 뷰어가 원시값으로 준다.
 */
function ReaderToken({
  tokenId, token, className, selected, paceStyle, tokenRefs,
  lineHeadText, lineHeadKey, linePickLabel, onLinePick, onTokenClick,
  pronDisplay, isKnown, isSaved, patternMark, zhGrid, showToneColors, nextText = '', variantText,
}) {
  // 번체로 읽기(LIT-SRC-WS-1) — 화면 글자만 같은 자리의 번체로(분석 · 데이터 속성은 간체 그대로). 없으면 원문 그대로.
  const shownText = variantText ?? token.text;
  // ruby는 토글과 무관하게 항상 만든다 — 폭 예약(ruby[data-pinyin])이 병음을 꺼도 유지돼야 켤 때 글자가 밀리지 않는다.
  // 활용형은 기본형 읽기에서 한자 읽기만(違[ちが]い) · 来 | ない는 바로 뒤 토큰 표기(nextText, 같은 줄)로 こ를 고른다.
  // 붙여 쓴 병음(túshūguǎn)은 글자마다 나눠 준다 — 글자 칸마다 음절 · 성조색이 붙는다(뷰어 점검 E1). 나눌 수 없으면 원래 독음 그대로.
  const rubySegments = token.furigana ? splitRuby(token.text, pinyinPerChar(token.text, token.furigana) ?? token.furigana, token.base_form, nextText) : null;
  // 「가려져 있다」는 읽기가 실제로 붙는 토큰에서만 참이다(한자 없는 plain 한 조각이면 벗길 rt가 없다).
  const hasReading = !!rubySegments?.some((seg) => seg.kanji);
  const furiOff = hasReading && pronHiddenFor(pronDisplay, { isKnown, isSaved });
  const mark = patternMark ? <span className="pattern-mark" aria-hidden="true" /> : null;
  // 선택 테두리 자리(VIEWER-TAP-INP-002) — 모든 낱말이 처음부터 갖고, 고르면 선만 켠다(reader-controls.css .word-frame).
  // .surface의 마지막 자식이다: 글자 · 문형 밑줄보다 뒤에 그려져 예전 테두리(z 1)처럼 글자 획 위에 선이 온다.
  // 예전에는 고를 때마다 낱말에 position:relative + ::before 상자를 새로 만들어, 쪽 넘김(다단) 본문 전체가 다시 배치됐다.
  const frame = <span className="word-frame" aria-hidden="true" />;
  const linePick = lineHeadText != null ? (
    <button
      className="line-pick"
      aria-label={linePickLabel}
      title={linePickLabel}
      onMouseUp={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); onLinePick({ text: lineHeadText, key: lineHeadKey }); }}
    />
  ) : null;
  // 단어 조작은 .surface가 맡아 문장 지정 막대(.line-pick)와 형제로 둔다(#1323). 마우스 탭은 루비 여백까지 받도록 바깥에 둔다.
  // 문장부호는 누를 거리가 아니다 — Tab 정거장 · 버튼 역할 없이 글자로만 둔다(opensWordCard, 뷰어 점검 2026-10-23).
  const wordAction = !opensWordCard(token) ? {} : {
    role: 'button', tabIndex: 0,
    onKeyDown: e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault(); e.stopPropagation();
      onTokenClick(token, tokenId);
    },
  };
  return (
    <div ref={el => { if (el) tokenRefs.current[tokenId] = el; }}
      data-tid={tokenId}
      data-source-token={tokenId}
      data-source-text={token.text}
      data-text={token.text}
      data-selected={selected ? true : undefined}
      className={className}
      style={paceStyle}
      onClick={() => onTokenClick(token, tokenId)}>
      {linePick}
      {rubySegments ? (
        <span className={`surface${furiOff ? ' surface--furi-off' : ''}`} {...wordAction}>
          {variantPieces(rubySegments, variantText).map((seg, i) =>
            seg.kanji
              ? <ruby key={i} data-pinyin={seg.pinyin ? '1' : undefined}
                  data-yomi={seg.pinyin ? undefined : '1'}>
                  {zhGrid && !seg.pinyin ? <ZhText text={seg.kanji} /> : seg.kanji}<span className={['rt-an', showToneColors && seg.pinyin ? pinyinToneClass(seg.reading) : ''].filter(Boolean).join(' ')}>{seg.reading}</span>
                </ruby>
              : zhGrid ? <ZhText key={i} text={seg.plain} /> : <span key={i}>{seg.plain}</span>
          )}{mark}{frame}
        </span>
      ) : (
        <span className="surface" {...wordAction}>{zhGrid ? <ZhText text={shownText} /> : shownText}{mark}{frame}</span>
      )}
    </div>
  );
}

/** paceStyle은 매 렌더 새 객체라 값으로 비교한다(구간 · 금칙 여백이 같으면 같은 칸). 나머지는 그대로 같음 비교. */
export function sameStyle(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every(k => a[k] === b[k]);
}
export function readerTokenPropsEqual(prev, next) {
  for (const key of Object.keys(next)) {
    if (key === 'paceStyle') { if (!sameStyle(prev.paceStyle, next.paceStyle)) return false; }
    else if (prev[key] !== next[key]) return false;
  }
  return Object.keys(prev).length === Object.keys(next).length;
}

export default memo(ReaderToken, readerTokenPropsEqual);
