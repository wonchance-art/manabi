'use client';
// 한자 창(팝오버) — 뷰어 v2 AE-R4 PR ②(VIEWER-V2-ROUNDS-001 §9 · 설계서 docs/manabi-viewer-v2-ae-r4.md §2·§4·§5·§6·§12).
// 무엇을 보일지는 PR ① 순수 함수(viewerHanjaPanel.js)가 정하고, 여기서는 놓는 일과 창 동작만 한다. 표시만 한다(쓰기 0 —
// 저장·교정·FSRS·아는 단어 경로를 부르지 않는다). 중국어 일반 모드에서 글자 카드(char-inspect) 대신 뜬다.
//
// 세 덩어리(설명 문장 0): 머리(간체 · 이 단어 속 병음 → 正 꼴 · 훈음) · 구성(뜻 조각 + 소리 조각, 역할 미상이면 색 없이) ·
// 같은 한자어 타일 3개(병음 · 중국어 · 한국 한자어). 소리 조각 → 같은 소리 글자 5개 + 요약 한 줄, 뜻 조각 → 그 글자의 창.
// 드릴다운은 1단계 기록이다(‹는 늘 원 글자로 돌아간다 — 설계서 Q3).
//
// 창 동작(설계서 §4):
//   · 비모달 dialog(aria-modal=false, aria-labelledby=머리). 열리면 창으로 포커스, 닫히면 그 글자로 돌려준다.
//   · 닫기 = ✕(44px) · Esc(창 안 + 열린 동안 문서 어디서나 — 시트의 Esc보다 먼저) · 바깥 누르기 · 같은 글자 다시 누르기
//     (호출부 toggleInspectChar). 포커스가 창·표제어 글자 밖으로 나가면 닫는다(돌려주지 않는다 — 사용자가 옮긴 자리).
//   · 다른 글자를 누르면 내용만 바뀐다(드릴다운 초기화, 화살표만 새 글자로).
//   · 단어창(.word-detail-card) 위 층(.hanja-pop-layer)의 절대 위치 — 흐름 밖이라 카드 요소 이동 0. 본문 스크롤 상자 밖이라
//     하단의 「얼마나 알겠어요?」 줄 위로는 겹쳐도(시안 그대로) 등급 버튼은 가리지 않는다(아래 끝 ≤ 등급 버튼 위 − 3px).
//     본문을 스크롤하면 글자를 따라간다. 표제어 글자 아래 8px, 좌우는 본문 안으로 고정하고 화살표만 글자 가운데에 맞춘다.
//     크기는 CSS 고정(높이 170px · 너비 min(346px, 본문 − 16px))이라 드릴다운·다른 글자 사이에 바뀌지 않는다. 열 때 들지 않으면
//     한 단계 작은 규격(data-compact — 머리 글자·여백 축소)으로, 그래도 넘치면 모자란 만큼 위로 올려(data-shifted) 연다.
//     단계는 그 글자가 열린 동안 고정이다(크기 불변).
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { pinyinToneClass } from '../../lib/pinyinTone';
import {
  formatDrillSummary, hanjaPanelModel, normalizePinyin, panelSearchChar, selectSameHanjaTiles, soundPieceDrill,
} from '../../lib/viewerHanjaPanel';

const GAP = 8; // 표제어 글자 아래 간격(설계서 §11.2)
const EDGE = 8; // 본문 좌우 안쪽 여백
const MAX_W = 346; // 390 화면 시안 폭
const FOOT_GAP = 3; // 창 아래 끝과 하단(등급 줄) 사이 최소 여유(시안)
const HEIGHTS = [170, 152]; // 기본 · 한 단계 작은 규격(CSS --hanja-pop-h와 같은 값)
const ZH_HANT = 'zh-Hant-TW';
const PINYIN = 'zh-Latn-pinyin';

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));
const toneOf = (on, syl) => (on && syl ? pinyinToneClass(syl) : undefined);

/** 포커스를 받아도 조작이 아닌 자리 — 몸통·카드 상자(tabIndex=-1)·본문. 여기로 간 포커스는 그 글자로 돌려준다. */
const isPassiveFocus = (el) => !el || el === document.body || (el.tabIndex < 0 && !el.matches('input,textarea,select,button,a[href],[contenteditable="true"]'));

/**
 * 바깥 누르기 뒤 포커스 복귀. 누른 자리의 기본 포커스 이동(mousedown — 가장 가까운 tabIndex 조상, 예: 카드 상자)은 pointerdown
 * 뒤에 오고, 터치는 click 직전에야 온다. 그래서 시간(setTimeout)에 기대지 않고 그 몸짓이 끝날 때까지(click 또는 600ms) 생기는
 * focusin을 보고, 비조작 자리로 간 포커스만 글자로 되돌린다. 마지막에 한 번 더 확인한다(포커스가 아예 안 움직인 경우).
 */
function restoreAfterOutsidePress(anchor) {
  let done = false;
  const back = () => { if (anchor.isConnected && isPassiveFocus(document.activeElement)) anchor.focus({ preventScroll: true }); };
  const onFocusIn = (e) => { if (e.target !== anchor && isPassiveFocus(e.target)) queueMicrotask(back); };
  const settle = () => {
    if (done) return;
    done = true;
    document.removeEventListener('focusin', onFocusIn, true);
    document.removeEventListener('click', onClick, true);
    clearTimeout(timer);
    back();
  };
  const onClick = () => setTimeout(settle, 0);
  document.addEventListener('focusin', onFocusIn, true);
  document.addEventListener('click', onClick, true);
  const timer = setTimeout(settle, 600);
}

/** 병음 한 덩어리 — 성조 색 설정을 따른다(R0 버그 2와 같은 규칙: 켜면 음절마다 pinyin-tone--N). */
function Pinyin({ text, tones, className = '' }) {
  if (!text) return null;
  return <span className={['hanja-pop__py', className, toneOf(tones, text)].filter(Boolean).join(' ')} lang={PINYIN}>{text}</span>;
}

/** 조각 라벨 — 역할 확인 조각은 훈음 전체(뜻 = 훈 진하게, 소리 = 음 진하게). 역할 미상 조각은 음만 보이고 원 훈은
 *  title·접근 이름으로(PR① 판단 4 — 시안 폭 우선), 단 패널 라벨 보정(PIECE_LABELS → lab)이 있으면 그 라벨 전체를 보인다. */
function PieceLabel({ piece, panel }) {
  const { hun, eum, label } = piece;
  if (!label) return null;
  if (piece.role === 'meaning') return <span className="hanja-pop__pl">{hun ? <><strong>{hun}</strong> {eum}</> : <strong>{eum}</strong>}</span>;
  if (piece.role === 'sound') return <span className="hanja-pop__pl">{hun ? <>{hun} <strong>{eum}</strong></> : <strong>{eum}</strong>}</span>;
  if (panel?.lab?.[piece.ch] || !hun) return <span className="hanja-pop__pl">{label}</span>;
  return <span className="hanja-pop__pl" title={label}><span aria-hidden="true">{eum}</span><span className="hanja-pop__sr">{label}</span></span>;
}

/** 같은 한자어 타일 하나 — 병음 · 중국어 · 한국 한자어(판정 실패면 짧은 뜻, 흐리게). 누른 글자와 그 음절만 칠한다. 누름 없음. */
function WordTile({ tile, tones, mineLabel }) {
  const zh = [...tile.word];
  const paint = (i, node, cls) => (i === tile.at ? <em key={i} className={cls}>{node}</em> : <span key={i} className={cls}>{node}</span>);
  return (
    <div className={`hanja-pop__tile${tile.mine ? ' is-mine' : ''}${tile.dim ? ' is-dim' : ''}`}>
      {tile.mine && <i className="hanja-pop__mine">{mineLabel}</i>}
      <span className={`hanja-pop__tpy${tones ? ' has-tones' : ''}`} lang={PINYIN}>
        {tile.syllables.map((s, i) => paint(i, s, toneOf(tones, s)))}
      </span>
      <span className="hanja-pop__tzh" lang="zh-Hans">{zh.map((c, i) => paint(i, c))}</span>
      {tile.ko
        ? <span className="hanja-pop__tko" lang="ko">{tile.koSylls.map((s, i) => paint(i, s))}</span>
        : <span className="hanja-pop__tko is-short" lang="ko">{tile.short}</span>}
    </div>
  );
}

/**
 * @param {object} p
 * @param {{ch:string, key:string, reading:string|null}} p.inspect - 뷰어 inspectChar(누른 표제어 글자)
 * @param {string} p.word - 표제어(기본형)
 * @param {{koTable?:object, hunTable?:object, tradTable?:object, panel?:object}} p.tables
 * @param {object[]} [p.savedRows] - 내 단어(user_vocabulary 행)
 * @param {object} [p.material] - processed_json
 * @param {Map} [p.refIndex] - 우리 사전 색인(refVocabIndex)
 * @param {boolean} [p.showToneColors]
 * @param {string} [p.uiLocale]
 * @param {(text:string, values?:object)=>string} p.vt
 * @param {() => void} p.onClose - inspectChar를 비운다(포커스는 이 컴포넌트가 돌려준다)
 */
export default function ViewerHanjaPopover({ inspect, word, tables = {}, savedRows = [], material = null, refIndex = null, showToneColors = false, uiLocale = 'ko', vt, onClose }) {
  const ref = useRef(null);
  const headId = useId();
  const [view, setView] = useState({ key: inspect.key, kind: 'main', target: null });
  const [pos, setPos] = useState(null);
  const returnTo = useRef(null); // 드릴다운에서 돌아올 때 포커스를 받을 조각(글자)
  const v = view.key === inspect.key ? view : { key: inspect.key, kind: 'main', target: null };
  const tones = !!showToneColors;
  const { panel } = tables;

  const anchorOf = useCallback(() => {
    const card = ref.current?.closest('.word-detail-card');
    return card?.querySelector(`.reader-card-body [data-inspect-key="${CSS.escape(inspect.key)}"]`) || null;
  }, [inspect.key]);
  const close = useCallback((restore = true) => {
    const anchor = restore ? anchorOf() : null;
    onClose();
    anchor?.focus({ preventScroll: true });
  }, [anchorOf, onClose]);

  // 위치 — 표제어 글자 아래 8px, 본문 안 좌우 고정, 화살표만 글자 가운데. 글자의 표제어 속 자리(data-glyph-i)도 여기서 읽는다.
  // 기준 상자는 단어창(.word-detail-card — 본문 + 하단). 창은 본문 스크롤 상자 밖 층(.hanja-pop-layer)에 있어 잘리지 않고,
  // 본문을 스크롤하면 글자를 따라간다(scroll 이벤트). 규격은 글자를 열 때 한 번 정한다: 창 아래 끝이 등급 버튼(저장 단어는
  // 저장 줄) 위 끝 − 3px 안에 들면 기본, 아니면 한 단계 작게, 그래도 넘치면 그만큼 위로 올린다(화살표 숨김).
  // 화면(창) 크기가 바뀌면 다시 정한다 — 연 채 390×844 → 320×640이면 옛 규격이 등급 버튼을 덮고 화면 밖으로 넘쳤다(M09 V7 2026-10-09).
  // 스크롤만으로는 다시 정하지 않는다(창 크기 고정).
  const fitRef = useRef({ key: null, level: 0, shift: 0 });
  const place = useCallback(() => {
    const pop = ref.current;
    const card = pop?.closest('.word-detail-card');
    const body = card?.querySelector('.reader-card-body');
    const anchor = anchorOf();
    if (!pop || !card || !body || !anchor || !body.clientWidth || !anchor.getClientRects().length) return;
    const cr = card.getBoundingClientRect();
    const br = body.getBoundingClientRect();
    const ar = anchor.getBoundingClientRect();
    const width = Math.min(MAX_W, body.clientWidth - 2 * EDGE);
    const ax = ar.left + ar.width / 2 - cr.left;
    const bodyLeft = br.left - cr.left + body.clientLeft;
    const left = clamp(ax - width / 2, bodyLeft + EDGE, bodyLeft + body.clientWidth - EDGE - width);
    if (fitRef.current.key !== inspect.key) {
      const floor = [...card.querySelectorAll('.reader-card-actions :is(.review-score-btn, .save-grade__saved)')].find((el) => el.getClientRects().length);
      const limit = (floor ? floor.getBoundingClientRect().top : Math.min(cr.bottom, br.bottom)) - FOOT_GAP;
      const room = limit - (ar.bottom + GAP);
      const level = room >= HEIGHTS[0] ? 0 : 1;
      fitRef.current = { key: inspect.key, level, shift: Math.min(0, Math.floor(room - HEIGHTS[level])) };
    }
    const { level, shift } = fitRef.current;
    const next = { top: ar.bottom - cr.top + GAP + shift, left, width, arrow: clamp(ax - left, 16, width - 16), index: Number(anchor.dataset.glyphI), compact: level, shifted: shift < 0 ? 1 : 0 };
    setPos((cur) => (cur && Object.keys(next).every((k) => Math.abs((cur[k] ?? -1) - (next[k] ?? -1)) < 0.5) ? cur : next));
  }, [anchorOf, inspect.key]);
  useLayoutEffect(() => {
    place();
    const card = ref.current?.closest('.word-detail-card');
    const body = card?.querySelector('.reader-card-body');
    if (!body) return undefined;
    const onScroll = () => place();
    body.addEventListener('scroll', onScroll, { passive: true });
    // 크기가 바뀌면 규격을 버리고 레이아웃이 자리 잡은 다음 프레임에 다시 정한다(resize 이벤트 시점 값은 중간 상태라 그대로 쓰면 어긋난다).
    let frame = 0;
    const refit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => { fitRef.current = { key: null, level: 0, shift: 0 }; place(); });
    };
    window.addEventListener('resize', refit);
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(refit) : null;
    if (ro) {
      ro.observe(card);
      const head = body.querySelector('.reader-card-headword');
      if (head) ro.observe(head);
    }
    return () => { body.removeEventListener('scroll', onScroll); window.removeEventListener('resize', refit); cancelAnimationFrame(frame); ro?.disconnect(); };
  }, [place]);

  // 열리면(다른 글자로 바뀌어도) 창으로 포커스 — 비모달이라 가두지는 않는다. 자리가 잡혀 보인 뒤에 옮긴다(숨은 상자는 포커스를 못 받는다).
  const placed = !!pos;
  const focusedKey = useRef(null);
  useEffect(() => {
    if (!placed || focusedKey.current === inspect.key) return;
    focusedKey.current = inspect.key;
    ref.current?.focus({ preventScroll: true });
  }, [placed, inspect.key]);

  // Esc는 열린 동안 문서 어디서나(포착 단계) — 시트의 Esc(패널 닫기)보다 먼저 창만 닫는다. 바깥 누르기도 같다.
  useEffect(() => {
    const isHeadChar = (el) => !!el?.closest?.('[data-inspect-key]');
    const shown = () => !!ref.current?.getClientRects().length; // 문장 탭 등으로 가려져 있으면 시트 동작을 가로채지 않는다
    const onKey = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented || !shown()) return;
      e.preventDefault();
      e.stopPropagation();
      close(true);
    };
    const onDown = (e) => {
      const t = e.target;
      if (!shown() || ref.current?.contains(t) || isHeadChar(t)) return; // 표제어 글자는 toggleInspectChar가 닫거나 바꾼다
      // 바깥 누르기: 닫고 그 글자로 포커스를 돌려준다 — 단, 누른 자리가 조작 요소(버튼·입력·다른 낱말)면 그 포커스를 빼앗지 않는다.
      const anchor = anchorOf();
      onClose();
      if (anchor) restoreAfterOutsidePress(anchor);
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [close, anchorOf, onClose]);
  const onBlur = (e) => {
    const next = e.relatedTarget;
    if (!next || ref.current?.contains(next) || next.closest?.('[data-inspect-key]')) return;
    close(false);
  };

  const index = Number.isInteger(pos?.index) ? pos.index : undefined;
  const main = useMemo(() => hanjaPanelModel({ ch: inspect.ch, index, reading: inspect.reading, word, tables }),
    [inspect.ch, index, inspect.reading, word, tables]);
  const charModel = useMemo(() => (v.kind === 'char' ? hanjaPanelModel({ ch: v.target, tables }) : null), [v.kind, v.target, tables]);
  const drill = useMemo(() => (v.kind === 'sound' ? soundPieceDrill(v.target, tables) : null), [v.kind, v.target, tables]);
  const model = v.kind === 'char' ? charModel : main;
  const tiles = useMemo(() => {
    if (v.kind === 'sound' || !panel) return [];
    if (v.kind === 'char') {
      return charModel?.head.reading ? selectSameHanjaTiles({ ch: panelSearchChar(v.target, panel), reading: charModel.head.reading, headText: word, savedRows, material, refIndex, tables }) : [];
    }
    return selectSameHanjaTiles({ ch: inspect.ch, reading: inspect.reading, headText: word, index, savedRows, material, refIndex, tables });
  }, [v.kind, v.target, charModel, panel, inspect.ch, inspect.reading, word, index, savedRows, material, refIndex, tables]);

  const go = (kind, target, from) => {
    returnTo.current = from;
    setView({ key: inspect.key, kind, target });
  };
  const back = () => {
    const from = returnTo.current;
    setView({ key: inspect.key, kind: 'main', target: null });
    requestAnimationFrame(() => {
      const btn = from && ref.current?.querySelector(`[data-piece="${CSS.escape(from)}"]`);
      (btn || ref.current)?.focus({ preventScroll: true });
    });
  };
  useEffect(() => {
    if (v.kind !== 'main') ref.current?.querySelector('.hanja-pop__back')?.focus({ preventScroll: true });
  }, [v.kind, v.target]);

  const roleChip = (role) => (uiLocale === 'ko' ? (role === 'meaning' ? '뜻' : '소리') : vt(role === 'meaning' ? '뜻 조각' : '소리 조각'));

  const closeBtn = (
    <button type="button" className="hanja-pop__close" aria-label={vt('닫기')} title={vt('닫기')} onClick={() => close(true)} data-icon-action>
      <svg className="action-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18" /></svg>
    </button>
  );
  const backBtn = (
    <button type="button" className="hanja-pop__back" aria-label={vt('돌아가기')} title={vt('돌아가기')} onClick={back} data-icon-action>
      <svg className="action-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m15 6-6 6 6 6" /></svg>
    </button>
  );

  // 머리: 간체(또는 조각 글자) · 병음 → 正 · 훈음. 역할이 확인된 글자만 훈 = 뜻 색, 음 = 소리 색(조각과 같은 토큰).
  const head = (m, { sub = false } = {}) => {
    const h = m?.head;
    const label = h?.label || '';
    return (
      <div className="hanja-pop__head" id={headId}>
        {sub && backBtn}
        <span className="hanja-pop__zg">
          <span className="hanja-pop__ch" lang={sub ? ZH_HANT : 'zh-Hans'}>{sub ? v.target : inspect.ch}</span>
          <Pinyin text={h ? h.reading : inspect.reading} tones={tones} />
        </span>
        {h?.zheng && <><span className="hanja-pop__to" aria-hidden="true">→</span><span className="hanja-pop__ch hanja-pop__ch--zheng" lang={ZH_HANT}>{h.zheng}</span></>}
        {label && (
          <span className={`hanja-pop__hun${[...label].length > 6 ? ' is-long' : ''}`} lang="ko">
            {h.hun && <span className={h.tone.hun ? 'is-meaning' : undefined}>{h.hun}</span>}
            {h.hun && h.eum ? ' ' : ''}
            {h.eum && <span className={h.tone.eum ? 'is-sound' : undefined}>{h.eum}</span>}
          </span>
        )}
      </div>
    );
  };

  // 구성: 역할 확인 = [뜻 조각(채운 초록)] + [소리 조각(황토 테두리)], 역할 미상 = 1단 성분(색 없음) + 「역할 미상」. 자료 없음 = 빈 자리.
  const parts = (m) => {
    const ps = m?.parts;
    if (!ps) return <div className="hanja-pop__parts is-empty" aria-hidden="true" />;
    return (
      <div className={`hanja-pop__parts${ps.known ? '' : ' is-unknown'}`}>
        {ps.pieces.map((p, i) => {
          const glyph = <b lang={ZH_HANT}>{p.ch}</b>;
          let node;
          if (p.role === 'meaning') {
            node = <button type="button" className="hanja-pop__piece is-meaning" data-piece={p.ch} aria-label={vt('{ch} {label}, 뜻 조각', { ch: p.ch, label: p.label || '' })} onClick={() => go('char', p.target || p.ch, p.ch)}>{glyph}<PieceLabel piece={p} /><i>{roleChip('meaning')}</i></button>;
          } else if (p.role === 'sound') {
            const inner = <>{glyph}<PieceLabel piece={p} /><i>{roleChip('sound')}</i></>;
            node = p.drill
              ? <button type="button" className="hanja-pop__piece is-sound" data-piece={p.ch} aria-label={vt('{ch} {label}, 소리 조각', { ch: p.ch, label: p.label || '' })} onClick={() => go('sound', p.ch, p.ch)}>{inner}</button>
              : <span className="hanja-pop__piece is-sound" role="group" aria-label={vt('{ch} {label}, 소리 조각', { ch: p.ch, label: p.label || '' })}>{inner}</span>;
          } else {
            node = <span className="hanja-pop__piece">{glyph}<PieceLabel piece={p} panel={panel} /></span>;
          }
          return <span key={`${p.ch}:${i}`} className="hanja-pop__slot">{i > 0 && <span className="hanja-pop__plus" aria-hidden="true">+</span>}{node}</span>;
        })}
        {!ps.known && <span className="hanja-pop__unknown">{vt('역할 미상')}</span>}
      </div>
    );
  };

  const words = () => (tiles.length
    ? <div className="hanja-pop__words">{tiles.map((t) => <WordTile key={t.word} tile={t} tones={tones} mineLabel={vt('내 단어')} />)}</div>
    : <div className="hanja-pop__words is-empty" aria-hidden="true" />);

  let content;
  if (v.kind === 'sound') {
    const items = drill?.items || [];
    const summary = drill ? (uiLocale === 'ko' ? formatDrillSummary(drill)
      : vt('{piece}이(가) 들면 대개 {list}', { piece: drill.piece, list: `${drill.summary.eums.join('·')}${drill.summary.pys.length ? ` (${drill.summary.pys.join('·')})` : ''}` })) : '';
    content = (
      <>
        <div className="hanja-pop__head" id={headId}>
          {backBtn}
          <span className="hanja-pop__zg">
            <span className="hanja-pop__ch is-sub" lang={ZH_HANT}>{v.target}</span>
            <Pinyin text={drill?.reading} tones={tones} />
          </span>
          <span className="hanja-pop__hun is-sub" lang="ko">
            {drill?.label && <span>{drill.label}</span>}
            <small className="is-sound">{vt('소리 조각')}</small>
          </span>
        </div>
        <div className="hanja-pop__fam">
          {items.map((x, i) => (
            <span key={x.ch} className={`hanja-pop__fc${i === 0 ? ' is-first' : ''}`}>
              {x.py ? <span className={['hanja-pop__fpy', toneOf(tones, x.py)].filter(Boolean).join(' ')} lang={PINYIN}>{normalizePinyin(x.py)}</span> : <span className="hanja-pop__fpy" aria-hidden="true">&nbsp;</span>}
              <b lang={ZH_HANT}>{x.ch}</b>
              <span lang="ko">{x.eum || ''}</span>
            </span>
          ))}
        </div>
        {summary && <p className="hanja-pop__note" lang={uiLocale}>{summary}</p>}
      </>
    );
  } else {
    content = <>{head(model, { sub: v.kind === 'char' })}{parts(model)}{words()}</>;
  }

  const style = pos ? { top: `${pos.top}px`, left: `${pos.left}px`, width: `${pos.width}px`, '--hanja-pop-arrow': `${pos.arrow}px` } : { visibility: 'hidden' };
  return (
    <div
      ref={ref}
      className="hanja-pop"
      role="dialog"
      aria-modal="false"
      aria-labelledby={headId}
      tabIndex={-1}
      data-view={v.kind}
      data-compact={pos?.compact ? '1' : undefined}
      data-shifted={pos?.shifted ? '1' : undefined}
      style={style}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); } }}
      onBlur={onBlur}
    >
      <span className="hanja-pop__arrow" aria-hidden="true" />
      {content}
      {closeBtn}
    </div>
  );
}
