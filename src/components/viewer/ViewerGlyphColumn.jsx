'use client';
// 자형 열(正 · 日) — 뷰어 v2 AE-R3 PR ②(VIEWER-V2-ROUNDS-001 §2·§6 · 설계서 docs/manabi-viewer-v2-ae-r3.md §2·§4·§12).
// 무엇을 보일지는 PR ① 순수 함수(glyphRows → zhengForm · jaGlyphRow)가 정하고, 여기서는 놓는 일만 한다.
//   안 1('side'): 표제어 오른쪽 열. 正·日 두 줄 묶음의 세로 가운데 = 표제어 글자 줄 가운데. 다른 글자는 초록 점선 밑줄.
//                 세로 맞춤은 재지 않고 CSS가 표제어와 같은 상수(병음 줄 1.125rem + 간격 .375rem + 글자 칸 1.2em의 절반,
//                 줄 수 --glyph-rows)로 계산한다 — 시트가 열리는 첫 프레임부터 맞는 자리다(reader-controls.css).
//   안 2('table'): 오른쪽 열에 한 줄로 안 들어가면 표제어 글자 칸에 맞춘 표. 같은 글자는 흐리게(0.45), 다른 글자만 초록,
//                  요미는 日 줄 끝에 한 줄(넘치면 요미 덩어리째 다음 줄 — 요미 문자열 안 줄바꿈 0, 설계서 Q4).
//   안 2b('stack'): 표마저 넘치면(글자 200%·긴 단어) 칸 맞춤 없이 표제어 아래 두 줄 묶음(설계서 §4 · Q4 제안).
// 판정은 글자 수가 아니라 폭이다 — glyphColumnLayout(em 추정, 글꼴 도착 전후 같음)에 표제어 덩어리 폭을 그리기 전에
// 한 번 읽어 넘기고(useLayoutEffect — 깜빡임 0), 회전·패널 전환·글꼴 도착은 ResizeObserver로 다시 잰다.
// 자리 예약(§4): 한 카드를 연 동안 한 번 보인 줄은 나중에 사전 행이 숨기라고 해도 빈 채로 남긴다(높이를 줄이지 않는다).
// 첫 화면 우선(AE-R1 PR② 합격 계약 — 메인 세션 결정 10-08): 표제어·이 문장 뜻 줄·하단이 시트 첫 화면에 다 보여야 한다.
// 뜻 줄이 본문 보이는 영역 밖으로 밀리면 onBudget(다음 단계)을 부른다 — 1단계 문장 줄 2줄 예산, 2단계 자형 표를 뜻 줄 아래로
// (표제어 옆에는 안 1 한 칸 — 正 줄 하나 — 만, sideOnly). 단계는 카드마다 오르기만 한다(진동 0).
// 이 열은 읽기 전용이다(쓰기 0). 수업 모드 TeachingWord 판서에는 넣지 않는다(설계서 Q3 — 호출부가 일반 모드에서만 둔다).
import { useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { glyphColumnLayout } from '../../lib/glyphColumn';

const HUN_FONT_PX = 13; // .word-fit__hun 글꼴(.8125rem) — hunRubyCells의 hunN(em) → px
const HUN_PAD_PX = 4; // .word-fit__hun 좌우 padding .125rem × 2
const near = (a, b) => Math.abs(a - b) < 0.5;
const sameXs = (a, b) => (a === b) || (!!a && !!b && a.length === b.length && a.every((x, i) => near(x, b[i])));

function GlyphRow({ kind, row, label, mark, lang, table, xs }) {
  const chars = [...row.form];
  const at = (i) => (!table || !xs || xs.length !== chars.length ? undefined
    : { marginInlineStart: `calc(${(i === 0 ? xs[0] : xs[i] - xs[i - 1]).toFixed(2)}px - ${i === 0 ? '.5em' : '1em'})` });
  return (
    <div className={`reader-card-glyph__row reader-card-glyph__row--${kind}${row.ghost ? ' is-ghost' : ''}`} role="group" aria-label={label} aria-hidden={row.ghost || undefined}>
      {mark}
      <span className="reader-card-glyph__form" lang={lang}>{chars.map((ch, i) => <span key={i} className={`reader-card-glyph__ch ${row.diff?.[i] ? 'is-diff' : 'is-same'}`} style={at(i)}>{ch}</span>)}</span>
      {row.yomi && <span className="reader-card-glyph__yomi" lang="ja">{row.yomi}</span>}
    </div>
  );
}

export default function ViewerGlyphColumn({ word, zheng, ja, hunCells = null, cardKey, labels, budgetStep = 0, onBudget = null, sideOnly = false, onSideMiss = null, forceLayout = null, className = '' }) {
  const ref = useRef(null);
  const seen = useRef({ key: null, zheng: null, ja: null });
  if (seen.current.key !== cardKey) seen.current = { key: cardKey, zheng: null, ja: null };
  const zRow = zheng || (seen.current.zheng ? { ...seen.current.zheng, ghost: true } : null);
  const jRow = ja || (seen.current.ja ? { ...seen.current.ja, ghost: true } : null);
  if (zheng) seen.current.zheng = zheng;
  if (ja) seen.current.ja = ja;
  const [layout, setLayout] = useState({ mode: forceLayout || 'side', xs: null });
  const shown = useRef(layout.mode); // 지금 그려진 배치 — 배치가 정해진 뒤에만 첫 화면 예산을 잰다
  shown.current = layout.mode;
  const n = [...String(word || '')].length;
  const zKey = zRow ? zRow.form : '';
  const jKey = jRow ? `${jRow.form}:${jRow.yomi}` : '';
  const hunKey = (hunCells || []).map((c) => c?.hunN || 0).join(',');

  useLayoutEffect(() => {
    const el = ref.current;
    const wrap = el?.parentElement;
    const fit = wrap?.querySelector(':scope > .word-fit');
    if (forceLayout || !el || !fit) return undefined;
    // 뜻 줄이 본문 첫 화면(스크롤 0) 안에 있는가 — 넘치면 다음 단계를 부른다(표제어·뜻·하단 > 자형 표).
    const checkBudget = () => {
      const body = el.closest('.reader-card-body');
      const meaning = body?.querySelector('.word-detail-card__meaning');
      if (!onBudget || !body || !meaning || body.scrollTop > 0 || budgetStep >= 2 || !body.clientHeight) return;
      const limit = body.getBoundingClientRect().top + body.clientHeight;
      if (meaning.getBoundingClientRect().bottom > limit + 0.5) onBudget(budgetStep + 1);
    };
    const measure = () => {
      // 아직 그려지지 않은 상자(시트가 열리는 중 — 크기 0)는 재지 않는다. 그려지면 ResizeObserver가 다시 부른다.
      if (!wrap.clientWidth || !fit.getClientRects().length) return;
      const scale = (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16;
      // 표제어 칸 폭 = max(em 추정, 훈음 칸, 그려진 칸 폭). 글자마다 칸이 하나(루비·훈음 열)이면 실제 칸 폭도 넣는다 —
      // 긴 병음(zhuàng)이 3.1rem 칸을 넘는 글꼴에서도 열이 표제어를 밀어 줄바꿈시키지 않게(추정은 하한으로만 쓴다).
      const cells = [...(fit.querySelector('.surface')?.children || [])];
      const drawn = cells.length === n ? cells.map((c) => c.getBoundingClientRect().width) : [];
      const hunPx = Array.from({ length: n }, (_, i) => Math.max(hunCells?.[i]?.hunN ? (hunCells[i].hunN * HUN_FONT_PX + HUN_PAD_PX) * scale : 0, drawn[i] || 0));
      let mode = glyphColumnLayout({ chars: n, zheng: !!zKey, ja: jKey ? { yomi: jRow.yomi } : null, containerPx: wrap.clientWidth, scale, hunPx }) || 'side';
      if (sideOnly && mode !== 'side') { mode = 'none'; onSideMiss?.(); }
      const glyphs = [...fit.querySelectorAll('[data-glyph-i]')];
      const fr = fit.getBoundingClientRect();
      const settled = shown.current === mode;
      setLayout((prev) => {
        if (prev.mode !== mode) return { mode, xs: null }; // 배치가 바뀌면 다음 그리기(그리기 전)에서 칸을 다시 잰다
        if (mode !== 'table') return prev;
        const xs = glyphs.length === n ? glyphs.map((g) => { const r = g.getBoundingClientRect(); return r.left + r.width / 2 - fr.left; }) : null;
        return sameXs(prev.xs, xs) ? prev : { ...prev, xs };
      });
      if (settled) checkBudget();
    };
    measure();
    // 그리기 전 콜백(ResizeObserver)·글꼴 도착에서 고친 값은 그 프레임 안에 반영한다 — 한 프레임이라도 어긋난 자리를 그리지 않게.
    const measureNow = () => flushSync(measure);
    let ro = null;
    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(() => measureNow());
      ro.observe(wrap);
      ro.observe(fit);
    }
    let alive = true;
    document.fonts?.ready?.then(() => { if (alive) measureNow(); });
    return () => { alive = false; ro?.disconnect(); };
  }, [layout.mode, n, zKey, jKey, hunKey, budgetStep, sideOnly, forceLayout]); // eslint-disable-line react-hooks/exhaustive-deps

  if ((!zRow && !jRow) || layout.mode === 'none') return null;
  const table = layout.mode === 'table';
  const xs = table ? layout.xs : null;
  return (
    <div ref={ref} className={`reader-card-glyph${className ? ` ${className}` : ''}`} data-layout={layout.mode} style={{ '--glyph-rows': (zRow ? 1 : 0) + (jRow ? 1 : 0) }}>
      {zRow && <GlyphRow kind="zheng" row={zRow} label={labels?.zheng} lang="zh-Hant-TW" table={table} xs={xs} mark={<span className="reader-card-glyph__label" aria-hidden="true">正</span>} />}
      {jRow && <GlyphRow kind="ja" row={jRow} label={labels?.ja} lang="ja" table={table} xs={xs} mark={<span className="reader-card-glyph__label" aria-hidden="true">日</span>} />}
    </div>
  );
}
