'use client';
// 레벨별 단어 · 문형 목록(LEVEL-LIST-AJ-001) — 목업 docs/design/mocks/lv/lv.html 8판, 인계 #1337 6119208984 · 6146777048.
// 단어(LEVEL-OX-AN-001 — 빠른 암기, 오너 지시 2026-10-15 · 목업 /mnt/project-files/notes/level-list-ox-mockup.md):
// 찾기 + ⚙(아는 단어 숨기기 · 중국어 훈음(기본 켬) · 한자 대조), 보기 탭 하나 고르기 [전체 · 단어 · 문장 · 뜻 · 소리], 카드마다 [O][X].
// 탭 보기에서 카드를 누르면 나머지가 아래로 펼쳐지고, 다시 누르거나 10초가 지나면 접힌다(4판). 채점 · 입력창은 없다(채점 설계 폐기).
// 문형: 읽기 전용(저장 · 번호 · 캡션 · 펼치기 없음).
// X(모른다) = 공부 중인 단어로 저장 = /api/learning/vocabulary action:'save'(FSRS 직접 추가 정본, 기존 카드는 그대로 돌려받는다).
// O(안다) = 아는 단어 표시(useKnownWords → markKnown). 다시 누르면 되돌린다. 로그인 전에는 둘 다 로그인 안내만, 기록 0.
// 단어 · 문장 · 뜻 · 소리 탭의 O · X는 그 탭에만 기록한다(user_word_facets — LEVEL-FACET-AO-001). 탭 X는 공부 중 담기도 같이 한다.
// 훈음 · 正日은 뷰어 부품을 그대로 쓴다(hunRubyCells + HunCell — 정체 꼴로 찾기, glyphRows — 正 대만 정체 · 日 일본어 표기).
// 한자(중국어 HSK 1–2): HanziBoard — 답 카드의 단어 칩이 같은 저장 · 제외 함수를 쓴다(HANZI-TAB-AL-001).
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { useTTS } from '@/lib/useTTS';
import { useKnownWords } from '@/lib/useKnownWords';
import { knownWordKeys, knownWordSetOf, normalizeKnownWord } from '@/lib/knownWordControl';
import { allFacetsKnown, facetIndex, facetMark } from '@/lib/wordFacets';
import { useWordFacets } from '@/lib/useWordFacets';
import { authEntryHref } from '@/lib/authRedirect';
import { hunRubyCells } from '@/lib/viewerHunRuby';
import { glyphRows } from '@/lib/glyphColumn';
import { loadJaWordsTable, loadZhengTable } from '@/lib/glyphTables';
import HunCell from '@/components/viewer/HunCell';
import { alignFurigana } from '@/views/refShared';
import {
  LEVEL_LIST_LANGS, LEVEL_KIND_LABEL, levelKinds, levelLabel, levelPill, levelListHref, jaHeadMode, matchesLevelQuery, splitKnown, fetchSavedLevelKeys, fetchSavedLevelKeysAll, levelGroupsOf,
  LEVEL_PEEK_CLOSE_MS, LEVEL_PEEK_MS, LEVEL_PREFS_DEFAULT, LEVEL_VIEWS, normalizeLevelPrefs, levelProgress, pinyinSyllables, writeLevelSnapshot,
  levelPlaceOf, withLevelPlace,
} from '@/lib/levelList';
import { pinyinToneNumber } from '@/lib/pinyinTone';
import { ZH_SCOPE_LEVELS, serializeReviewScope } from '@/lib/reviewScopeUrl';
import { levelCardLabel, levelListKeyAction, levelListMove, levelListNearest } from '@/lib/levelListKeys';
import { reducedMotion } from '@/lib/reducedMotion';
import NavPendingMark from '@/components/NavPendingMark';
// 한자판은 HSK 1 · 2 「한자」 탭에서만 쓴다 — 단어 · 문형 목록 번들에 싣지 않는다.
const HanziBoard = dynamic(() => import('@/components/levels/HanziBoard'), {
  loading: () => <p className="lv-empty" role="status">한자판 불러오는 중…</p>,
});
import '@/components/levels/level-list.css';

const svg = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const SpeakerIcon = () => <svg {...svg} width={17} height={17} strokeWidth={1.5}><path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4Z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></svg>;
const SearchIcon = () => <svg {...svg} width={17} height={17} strokeWidth={1.6}><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M21 21l-5-5" /></svg>;
const SpinIcon = () => <svg {...svg} width={20} height={20} strokeWidth={2.2}><path d="M12 3a9 9 0 1 0 9 9" /></svg>;
const CrossIcon = () => <svg {...svg} strokeWidth={2}><path d="M6 6l12 12M18 6 6 18" /></svg>;
const GearIcon = () => <svg {...svg} width={19} height={19} strokeWidth={1.6}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></svg>;
const CircleIcon = () => <svg {...svg} strokeWidth={2.2}><circle cx="12" cy="12" r="7" /></svg>;
const ChevronIcon = () => <svg {...svg} width={16} height={16} strokeWidth={2}><path d="m6 9 6 6 6-6" /></svg>;
const PREFS_KEY = 'manabi:level-list-view';
// 「복습하기」 알림은 하루 한 번(KST 날짜) — X를 연달아 누를 때마다 뜨지 않게.
const NUDGE_KEY = 'manabi:level-review-nudge';
const kstDay = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const HAN = /\p{Script=Han}/u;

/** 병음 — 성조 색(⚙ 「성조 색」, 기본 끔 — 성조 색은 옵트인, 오너 확정 2026-08-19)을 켜면 음절마다 pinyinTone 색. 음절이 글자 수와 안 맞으면(儿화 등) 색 없이. */
function Pinyin({ text, word, tone, className = 'lv-py' }) {
  const parts = tone ? pinyinSyllables(text, [...String(word || '')].filter((c) => HAN.test(c)).length) : null;
  if (!parts) return <span className={className}>{text}</span>;
  return <span className={className}>{parts.map((p, i) => <span key={i} className={`lv-tone lv-tone--${pinyinToneNumber(p) ?? 0}`}>{p}</span>)}</span>;
}

const newId = () => globalThis.crypto.randomUUID();
// 처음엔 150개만 그린다(N3 2,108개를 한 번에 그리면 DOM 예산 초과 — smoke e2e 「vocab performance」). 찾기는 레벨 전체에서 한다.
export const LEVEL_LIST_PAGE = 150;

/** 위 읽기 — 한자 구간에만 루비(alignFurigana 재사용). 정렬이 안 되면 글자만. */
function Ruby({ text, reading }) {
  const segs = alignFurigana(text, reading);
  if (!segs) return text;
  return segs.map((s, i) => (s.rt ? <ruby key={i}>{s.text}<rt>{s.rt}</rt></ruby> : <span key={i}>{s.text}</span>));
}

/** 표제어. bare = 읽기(병음 · 후리가나) 없이 글자만 — 「단어」만 볼 때 발음은 스스로 떠올린다. */
function Headword({ entry, lang, levelKey, hunCells, bare = false, tone = false }) {
  const py = !bare && entry.reading && (lang === 'chinese' ? <Pinyin text={entry.reading} word={entry.word} tone={tone} /> : <span className="lv-py">{entry.reading}</span>);
  if (lang === 'chinese' && hunCells) return <><span className="lv-hw lv-hw--hun" lang="zh-CN">{hunCells.map((c, i) => <span key={i} className="lv-hc">
    <span className="lv-hc__ch">{c.ch}</span><HunCell cell={c} /></span>)}</span>{py}</>;
  if (lang === 'chinese') return <><span className="lv-hw" lang="zh-CN">{entry.word}</span>{py}</>;
  const hasKanji = entry.reading && entry.reading !== entry.word && alignFurigana(entry.word, entry.reading);
  if (jaHeadMode(levelKey) === 'kana' && hasKanji) return <><span className="lv-hw" lang="ja">{entry.reading}</span>{!bare && <span className="lv-kj" lang="ja">{entry.word}</span>}</>;
  return <span className="lv-hw" lang="ja">{hasKanji && !bare ? <Ruby text={entry.word} reading={entry.reading} /> : entry.word}</span>;
}

function Example({ ex, lang, speak, hideTranslation, tabIndex }) {
  const zh = lang === 'chinese';
  return <p className="lv-ex">
    <span className="lv-ex__text" lang={zh ? 'zh-CN' : 'ja'}>{zh ? ex.text : <Ruby text={ex.text} reading={ex.reading} />}</span>
    {speak && <button type="button" className="lv-snd" aria-label="예문 듣기" title="예문 듣기" onClick={() => speak(ex.text)} tabIndex={tabIndex}><SpeakerIcon /></button>}
    {zh && ex.reading && <span className="lv-ex__py">{ex.reading}</span>}
    {!hideTranslation && ex.ko && <span className="lv-ex__tr">{ex.ko}</span>}
  </p>;
}

/** [O] 안다(아는 단어) · [X] 모른다(공부 중인 단어) — 누른 쪽이 채워진다. 아는 단어가 먼저다(저장돼 있어도 O면 O만). */
function OxButtons({ scope, known, studying, saving, pendingKnown, onO, onX, onPrepareX, showLabels = false, tabIndex }) {
  return <div className="lv-acts">
    <button type="button" className="lv-fab lv-fab--o" aria-pressed={known} aria-label={scope ? `${scope} 탭에서 안다` : '안다 — 아는 단어로'} title="안다"
      onClick={onO} disabled={pendingKnown} tabIndex={tabIndex}><CircleIcon />{showLabels && <span>안다</span>}</button>
    <button type="button" className={`lv-fab lv-fab--x${saving ? ' lv-fab--busy' : ''}`} aria-pressed={!known && studying}
      aria-label={saving ? '공부 중인 단어로 담는 중' : `${scope ? `${scope} 탭에서 ` : ''}모른다 — 공부 중인 단어로`} title="모른다"
      aria-disabled={saving || undefined} onClick={saving ? undefined : onX} onPointerEnter={onPrepareX} onFocus={onPrepareX} disabled={pendingKnown} tabIndex={tabIndex}>{saving ? <SpinIcon /> : <CrossIcon />}{showLabels && <span>모른다</span>}</button>
  </div>;
}


/** 正(대만 정체) · 日(일본어 표기) 한 줄 — 뷰어 자형 열과 같은 판정(glyphRows). 둘 다 없으면 없음. */
function GlyphLine({ rows }) {
  if (!rows?.zheng && !rows?.ja) return null;
  return <p className="lv-glyph">
    {rows.zheng && <span title="대만 정체"><b aria-label="대만 정체">正</b><span lang="zh-TW">{rows.zheng.form}</span></span>}
    {rows.ja && <span title="일본어 표기"><b aria-label="일본어 표기">日</b><span lang="ja">{rows.ja.form}</span><small lang="ja">{rows.ja.yomi}</small></span>}
  </p>;
}

/** 읽기 한 줄 — 표제어에서 읽기를 뺀 「단어」 보기를 펼쳤을 때. 중국어 = 병음, 일본어 = 표제어에 안 보인 쪽(가나 ↔ 한자). */
function readingLine(entry, lang, levelKey, tone = false) {
  if (lang === 'chinese') return entry.reading ? <Pinyin text={entry.reading} word={entry.word} tone={tone} /> : null;
  if (!entry.reading || entry.reading === entry.word || !alignFurigana(entry.word, entry.reading)) return null;
  return jaHeadMode(levelKey) === 'kana' ? <span className="lv-kj" lang="ja">{entry.word}</span> : <span className="lv-kj" lang="ja">{entry.reading}</span>;
}

/**
 * 단어 카드 — [O][X] + 보기 탭. 전체가 아니면 고른 것 하나만 깔끔하게 남긴다(가린 칸 없음 — 오너 2026-10-15
 * 「기존 모양에서 가리는 게 아니라 지정한 것들만 보이게」). 단어 = 글자(+훈음 · 正日, 읽기 없음), 문장 = 예문 글자만,
 * 뜻 = 뜻만, 소리 = 듣기 버튼만.
 * 카드를 누르면 고른 것은 제자리에 둔 채 나머지가 그 아래로 펼쳐지고, 다시 누르면 접힌다. 그대로 두면 10초 뒤 접힌다
 * (4판 — 오너 2026-10-15 「다시 클릭하면 닫히게 · 애니메이션 · 닫히면서 단어 위치 변하는 것 개선」). peek = 'open' | 'closing'.
 */
export function VocabCard({ entry: e, lang, levelKey, view, scoped = true, peek, peekEpoch = 0, onPeek, onRenew, speak, hunCells, glyph, tone = false, known, studying, saving, pendingKnown, onO, onX, onPrepareX, current, onCardFocus }) {
  const scope = view === 'all' || !scoped ? null : LEVEL_VIEWS.find((v) => v.id === view)?.label;
  // 키보드(LEVEL-KEYS-001): 목록의 Tab 정지는 지금 카드 하나(roving — current면 0, 아니면 -1). 카드 안 버튼(듣기 · 예문 듣기 ·
  // 펼쳐 보기 · O · X)은 지금 카드에서만 Tab으로 닿고(0), 다른 카드에서는 -1 — 단축키가 없는 듣기도 키보드로 쓸 수 있게.
  const roving = current !== undefined;
  const inner = roving ? (current ? 0 : -1) : undefined;
  // 이름표(안다 · 모른다)는 전체 보기 카드에만 — 탭 보기는 한 줄 카드라 동그라미만(디자인 검토 A안, 화면 읽기 이름은 그대로).
  const ox = <OxButtons scope={scope} showLabels={lang === 'chinese' && view === 'all'} known={known} studying={studying} saving={saving} pendingKnown={pendingKnown} onO={onO} onX={onX} onPrepareX={onPrepareX} tabIndex={inner} />;
  // 상태는 카드 자체에 — 아는 단어는 흐리게, 공부 중은 왼쪽 줄(점선 테두리는 「임시」로 읽혀 뺐다).
  const state = { 'data-known': known || undefined, 'data-studying': (!known && studying) || undefined };
  const card = roving ? { 'data-lv-card': e.key, role: 'listitem', tabIndex: current ? 0 : -1, onFocus: onCardFocus,
    'aria-label': levelCardLabel(e, view, { known, studying }), 'aria-keyshortcuts': 'ArrowUp ArrowDown O X Space Escape' } : null;
  if (view === 'all') return <li className="lv-entry" {...state} {...card}>
    <div className="lv-entry__top">
      <div className="lv-entry__word"><Headword entry={e} lang={lang} levelKey={levelKey} hunCells={hunCells} tone={tone} />
        {speak && <button type="button" className="lv-snd" aria-label="듣기" title="듣기" onClick={() => speak(e.word)} tabIndex={inner}><SpeakerIcon /></button>}</div>
      {ox}
    </div>
    <GlyphLine rows={glyph} />
    <p className="lv-mean">{e.meaning}</p>
    {e.ex && <Example ex={e.ex} lang={lang} speak={speak} tabIndex={inner} />}
  </li>;
  const zh = lang === 'chinese';
  const solo = view === 'word' ? <><div className="lv-entry__word"><Headword entry={e} lang={lang} levelKey={levelKey} hunCells={hunCells} bare /></div><GlyphLine rows={glyph} /></>
    : view === 'sentence' ? (e.ex ? <p className="lv-solo__ex" lang={zh ? 'zh-CN' : 'ja'}>{e.ex.text}</p> : <p className="lv-solo__ex lv-solo__none">예문 없음</p>)
      : view === 'meaning' ? <p className="lv-solo__mean">{e.meaning}</p>
        : speak ? <button type="button" className="lv-solo__play" aria-label="듣기" title="듣기" onClick={() => speak(e.word)} tabIndex={inner}><SpeakerIcon /></button>
          : <p className="lv-solo__none">이 기기에서는 소리를 낼 수 없어요</p>;
  // 펼친 안에서 듣기를 누르면 10초를 다시 센다 — 듣는 중에 접히지 않게.
  const say = speak && ((text) => { onRenew?.(); speak(text); });
  const sndWord = say && <button type="button" className="lv-snd" aria-label="듣기" title="듣기" onClick={() => say(e.word)} tabIndex={inner}><SpeakerIcon /></button>;
  const head = <div className="lv-entry__word"><Headword entry={e} lang={lang} levelKey={levelKey} hunCells={hunCells} tone={tone} />{sndWord}</div>;
  const mean = <p className="lv-mean">{e.meaning}</p>;
  const example = e.ex && <Example ex={e.ex} lang={lang} speak={say} tabIndex={inner} />;
  const rest = view === 'word' ? <><p className="lv-reveal__line">{readingLine(e, lang, levelKey, tone)}{sndWord}</p>{mean}{example}</>
    : view === 'sentence' ? <>{e.ex && <p className="lv-ex lv-ex--tail">
      {say && <button type="button" className="lv-snd" aria-label="예문 듣기" title="예문 듣기" onClick={() => say(e.ex.text)} tabIndex={inner}><SpeakerIcon /></button>}
      {zh && e.ex.reading && <span className="lv-ex__py">{e.ex.reading}</span>}
      {e.ex.ko && <span className="lv-ex__tr">{e.ex.ko}</span>}</p>}{head}{mean}</>
      : view === 'meaning' ? <>{head}<GlyphLine rows={glyph} />{example}</>
        : <>{head}<GlyphLine rows={glyph} />{mean}{example}</>;
  // 카드 어디를 눌러도(버튼 밖) 펼치기 · 접기 — 키보드 · 화면 읽기는 숨은 버튼으로 같은 동작.
  const tap = (event) => { if (!event.target.closest('button, a')) onPeek(); };
  return <li className="lv-entry lv-entry--solo" {...state} data-view={view} data-peek={peek || undefined} onClick={tap} {...card}>
    <div className="lv-solo__row"><div className="lv-solo">{solo}</div>{ox}</div>
    <button type="button" className="lv-sr" aria-expanded={peek === 'open'} onClick={onPeek} tabIndex={inner}>{peek === 'open' ? '접기' : '펼쳐 보기'}</button>
    {peek && <div className="lv-reveal"><div className="lv-reveal__in"><div className="lv-reveal__body">{rest}</div>
      {peek === 'open' && <i key={peekEpoch} className="lv-reveal__time" style={{ animationDuration: `${LEVEL_PEEK_MS}ms` }} aria-hidden="true" />}</div></div>}
  </li>;
}

export default function LevelListPage({ lang, kind, levelKey, groups: rawGroups }) {
  const conf = LEVEL_LIST_LANGS[lang];
  // 서버가 줄여 보낸 항목(compactLevelEntry)을 여기 한 곳에서 되살린다 — 아래는 늘 key · fullMeaning이 있는 항목만 본다.
  const groups = useMemo(() => levelGroupsOf(rawGroups), [rawGroups]);
  const vocab = kind === 'vocab';
  const hanzi = kind === 'hanzi';
  const wordsOn = vocab || hanzi; // 단어 저장 · 제외를 쓰는 탭
  const pathname = usePathname();
  const { user } = useAuth();
  const userId = user?.id || null;
  const { speak, supported: ttsSupported } = useTTS();
  const say = useCallback((text) => speak(text, conf.language), [speak, conf.language]);
  const known = useKnownWords(conf.langCode, wordsOn && !!userId);

  const [query, setQuery] = useState('');
  const [prefs, setPrefsState] = useState(LEVEL_PREFS_DEFAULT);
  const [peek, setPeek] = useState(() => new Map()); // 단어 키 → { phase: 'open' | 'closing', epoch }
  const [settingsOpen, setSettingsOpen] = useState(false);
  // 머리 접기(디자인 검토 A안) — 단어 목록은 레벨 · 목록 종류를 ▾ 안에 접고 찾기는 돋보기로 연다. 문형 · 한자는 지금처럼 펼친 채.
  const [navOpen, setNavOpen] = useState(kind !== 'vocab');
  const [searchOpen, setSearchOpen] = useState(false);
  const [tables, setTables] = useState({});
  const [saved, setSaved] = useState(() => new Set());
  const [saving, setSaving] = useState(() => new Set());
  const [toast, setToast] = useState(null);
  const [activeGroup, setActiveGroup] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [limit, setLimit] = useState(LEVEL_LIST_PAGE);
  const [jumpTo, setJumpTo] = useState(null);
  const moreRef = useRef(null);
  const pageRef = useRef(null);
  const barRef = useRef(null);
  const peekTimers = useRef(new Map());
  const fsrs = useRef(null); // { accountId, client }
  const fsrsLoad = useRef(null); // { accountId, promise } — 받는 중
  const fsrsEpoch = useRef(0);
  const userRef = useRef(userId);
  userRef.current = userId;

  // 하이드레이션: 서버 렌더와 첫 화면을 같게 — 계정 상태(저장됨 · 아는 단어)는 붙은 뒤에만 그린다.
  useEffect(() => setMounted(true), []);
  // 보기 설정은 이 기기에 기억한다(붙은 뒤에 읽는다 — 서버 렌더는 기본값). 그리기 전(layout effect)에 읽어
  // 뒤로 가기 자리 복원(아래)이 기본 보기가 아니라 고른 보기의 카드 높이로 맞춘다.
  useLayoutEffect(() => {
    if (!vocab) return;
    try { const raw = localStorage.getItem(PREFS_KEY); if (raw) setPrefsState(normalizeLevelPrefs(JSON.parse(raw))); } catch { /* 저장소 없음 — 기본값 */ }
  }, [vocab]);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const setPrefs = (patch) => setPrefsState((cur) => {
    const next = normalizeLevelPrefs({ ...cur, ...patch });
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* 저장소 없음 — 이번 화면만 */ }
    return next;
  });
  // 카드를 누르면 펼치고(10초 뒤 저절로 접힘), 펼친 카드를 다시 누르면 접는다. 접힐 때는 움직임이 끝난 뒤 내용을 뗀다.
  const peekRef = useRef(peek);
  peekRef.current = peek;
  const setPhase = useCallback((key, phase) => setPeek((cur) => {
    const n = new Map(cur);
    if (phase) n.set(key, { phase, epoch: (cur.get(key)?.epoch || 0) + (phase === 'open' ? 1 : 0) }); else n.delete(key);
    return n;
  }), []);
  const closePeek = useCallback((key) => {
    const timers = peekTimers.current;
    clearTimeout(timers.get(key));
    if (reducedMotion()) { timers.delete(key); return setPhase(key, null); }
    setPhase(key, 'closing');
    timers.set(key, setTimeout(() => { timers.delete(key); setPhase(key, null); }, LEVEL_PEEK_CLOSE_MS));
  }, [setPhase]);
  const openPeek = useCallback((key) => {
    const timers = peekTimers.current;
    clearTimeout(timers.get(key));
    setPhase(key, 'open');
    timers.set(key, setTimeout(() => closePeek(key), LEVEL_PEEK_MS));
  }, [setPhase, closePeek]);
  const togglePeek = useCallback((key) => (peekRef.current.get(key)?.phase === 'open' ? closePeek(key) : openPeek(key)), [openPeek, closePeek]);
  const renewPeek = useCallback((key) => { if (peekRef.current.get(key)?.phase === 'open') openPeek(key); }, [openPeek]);
  useEffect(() => () => { for (const t of peekTimers.current.values()) clearTimeout(t); }, []);
  useEffect(() => {
    for (const t of peekTimers.current.values()) clearTimeout(t);
    peekTimers.current.clear();
    setPeek(new Map());
  }, [prefs.view]);

  // 훈음 · 正日 표 — 중국어 단어 목록에서 켠 것만 받는다(뷰어와 같은 표 · 같은 지연 로드 모듈).
  const zhVocab = lang === 'chinese' && vocab;
  useEffect(() => {
    if (!zhVocab || !mounted || !(prefs.hun || prefs.glyph)) return undefined;
    let alive = true;
    const safe = (p) => p.catch(() => ({}));
    const jobs = [safe(loadZhengTable().then((trad) => ({ trad })))];
    if (prefs.hun) jobs.push(safe(Promise.all([import('@/lib/data/hanjaKo.json'), import('@/lib/data/hanjaHun.json')])
      .then(([ko, hun]) => ({ ko: ko.default || ko, hun: hun.default || hun }))));
    if (prefs.glyph) jobs.push(safe(loadJaWordsTable().then((ja) => ({ ja }))));
    Promise.all(jobs).then((parts) => { if (alive) setTables((cur) => Object.assign({}, cur, ...parts)); });
    return () => { alive = false; };
  }, [zhVocab, mounted, prefs.hun, prefs.glyph]);
  const hunOf = useCallback((word) => (zhVocab && prefs.hun && tables.ko && tables.hun
    ? hunRubyCells(word, { koTable: tables.ko, hunTable: tables.hun, tradTable: tables.trad || null }, { glyphPx: 27, hunPx: 12 }) : null),
  [zhVocab, prefs.hun, tables]);
  const glyphOf = useCallback((word) => (zhVocab && prefs.glyph && (tables.trad || tables.ja)
    ? glyphRows({ word, tradTable: tables.trad || null, jaTable: tables.ja || null }) : null), [zhVocab, prefs.glyph, tables]);
  // 붙어 다니는 머리 높이 → 목차 · 묶음 이동이 그 아래에 서게(--lv-bar-h).
  useEffect(() => {
    const bar = barRef.current, page = pageRef.current;
    if (!vocab || !bar || !page || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => page.style.setProperty('--lv-bar-h', `${Math.round(bar.getBoundingClientRect().height)}px`));
    ro.observe(bar);
    return () => ro.disconnect();
  }, [vocab]);
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 6000); return () => clearTimeout(t); }, [toast]);

  const allEntries = useMemo(() => groups.flatMap((g) => g.entries), [groups]);
  const knownSet = useMemo(() => (mounted && userId ? knownWordSetOf(known.rows, [], conf.langCode) : new Set()), [mounted, userId, known.rows, conf.langCode]);
  // 탭별 O · X(LEVEL-FACET-AO-001) — 전체 탭은 지금처럼 아는 단어 · 공부 중, 나머지 탭은 그 탭의 기록만 본다.
  // 표를 읽지 못하면(운영 미적용 등) 탭별 기록을 끄고 모든 탭이 단어 단위 O · X를 쓴다 — 누를 때마다 저장 실패가 뜨지 않게.
  const facets = useWordFacets(mounted ? userId : null, conf.langCode, vocab,
    { onError: () => setToast({ message: '저장하지 못했어요. 잠시 후 다시 시도해 주세요' }) });
  const facetView = vocab && prefs.view !== 'all' && facets.available ? prefs.view : null;
  const facetIdx = useMemo(() => facetIndex(facets.rows), [facets.rows]);
  // 숨길 단어 — 전체 탭은 아는 단어, 나머지 탭은 아는 단어 + 그 탭에서 O 한 단어.
  const hiddenSet = useMemo(() => {
    if (!facetView) return knownSet;
    const set = new Set(knownSet);
    for (const [word, marks] of facetIdx) if (marks[facetView] === 'o') set.add(word);
    return set;
  }, [facetView, knownSet, facetIdx]);

  // 저장됨 — 이미 단어장에 있는 단어는 처음부터 「저장됨」.
  useEffect(() => {
    setSaved(new Set());
    if (!vocab || !userId) return undefined;
    let alive = true;
    // 목록 전체는 그 언어 단어장을 한 번에(1000행 page) 받아 대조한다 — 키 묶음마다 묻지 않는다.
    fetchSavedLevelKeysAll(supabase, userId, conf.language, allEntries.map((e) => e.key))
      .then((set) => { if (alive) setSaved((prev) => new Set([...prev, ...set])); })
      .catch(() => {});
    return () => { alive = false; };
  }, [vocab, userId, conf.language, allEntries]);

  // FSRS 저장 클라이언트 — 처음 저장할 때(또는 X에 손이 갈 때) 받아 만든다. 목록만 보는 화면은 저장 코드를 받지 않는다.
  // 계정마다 하나: 같은 계정이면 다시 쓰고, 계정이 바뀌거나 화면을 떠나면 버린다(받는 중이던 것도 만들지 않는다).
  const ensureFsrs = useCallback(() => {
    const account = userRef.current;
    if (!account) return Promise.resolve(null);
    if (fsrs.current?.accountId === account) return Promise.resolve(fsrs.current.client);
    if (fsrsLoad.current?.accountId === account) return fsrsLoad.current.promise;
    const epoch = fsrsEpoch.current;
    const promise = import('@/lib/fsrsLearningClient').then(({ createFsrsLearningClient }) => {
      if (fsrsEpoch.current !== epoch || userRef.current !== account) return null;
      if (fsrs.current?.accountId === account) return fsrs.current.client;
      const client = createFsrsLearningClient({ accountId: account, getAccountId: () => userRef.current });
      client.start();
      fsrs.current = { accountId: account, client };
      return client;
    }).finally(() => { if (fsrsLoad.current?.promise === promise) fsrsLoad.current = null; });
    fsrsLoad.current = { accountId: account, promise };
    return promise;
  }, []);
  useEffect(() => () => {
    fsrsEpoch.current += 1;
    fsrsLoad.current = null;
    const current = fsrs.current;
    fsrs.current = null;
    current?.client.dispose?.();
  }, [userId]);
  const prepareSave = useCallback(() => { if (userRef.current) ensureFsrs().catch(() => {}); }, [ensureFsrs]);

  // 한자 탭 — 답 카드를 열 때 그 칩 단어들의 「저장됨」만 받아 합친다.
  const loadSaved = useCallback((keys) => {
    if (!userId || !keys?.length) return;
    fetchSavedLevelKeys(supabase, userId, conf.language, keys)
      .then((set) => setSaved((prev) => (set.size ? new Set([...prev, ...set]) : prev)))
      .catch(() => {});
  }, [userId, conf.language]);

  const loginToast = (message) => setToast({ message, href: authEntryHref(pathname), action: '로그인' });
  // 복습으로 가는 길(디자인 검토 B안) — 이 레벨 범위의 복습. 중국어 = HSK 급수 범위(serializeReviewScope 정본), 일본어 = 언어 범위.
  const levelScope = String(levelKey || '').toUpperCase();
  const reviewHref = serializeReviewScope(lang === 'chinese' && ZH_SCOPE_LEVELS.includes(levelScope)
    ? { lang: 'Chinese', level: levelScope } : { lang: conf.language });
  // 처음 공부 중에 담은 날만 한 번 알린다.
  const nudgeReview = () => {
    try { if (localStorage.getItem(NUDGE_KEY) === kstDay()) return; localStorage.setItem(NUDGE_KEY, kstDay()); } catch { return; }
    setToast({ message: '공부 중에 담았어요. 복습에서 다시 만나요', href: reviewHref, action: '복습하기' });
  };

  const save = async (entry) => {
    if (!userId) return loginToast('로그인하면 단어를 저장할 수 있어요');
    if (saving.has(entry.key) || saved.has(entry.key)) return;
    setSaving((s) => new Set(s).add(entry.key));
    const done = (ok) => {
      setSaving((s) => { const n = new Set(s); n.delete(entry.key); return n; });
      if (ok) setSaved((s) => new Set(s).add(entry.key));
    };
    try {
      const client = await ensureFsrs();
      if (!client) return done(false); // 받는 사이 계정이 바뀌었다 — 새 계정으로 저장하지 않는다.
      // 예문은 붙이지 않는다(인계 §5 — 저장 카드 예문은 보류). 뜻 · 읽기는 새 카드에만 쓰이고, 있던 카드는 그대로다.
      const vocabulary = { language: conf.language, word_text: entry.key, base_form: entry.key,
        meaning: (entry.fullMeaning ?? entry.meaning).slice(0, 2000), furigana: entry.reading.slice(0, 500), pos: entry.pos.slice(0, 80) };
      const response = await client.save({ action: 'save', accountId: userId, operationId: newId(), cardId: newId(), vocabulary });
      if (response?.ok === true || response?.status === 'pending' || response?.status === 'applied' || response?.status === 'replayed') { nudgeReview(); return done(true); }
      done(false);
      setToast({ message: /excluded|known/.test(response?.blockReason || '') ? '아는 단어로 옮긴 단어라 저장하지 않았어요' : '저장하지 못했어요. 잠시 후 다시 시도해 주세요' });
    } catch {
      done(false);
      setToast({ message: '저장하지 못했어요. 잠시 후 다시 시도해 주세요' });
    }
  };

  // 아는 단어 표시 · 해제는 누른 순간 화면에 반영된다(useKnownWords 낙관 갱신). 실패하면 그쪽이 되돌리고 알린다.
  const unmarkRequest = (key) => ({ lang: conf.langCode, wordText: key, known: false,
    removeKeys: knownWordKeys(known.rows, conf.langCode, { text: key }, []) });
  const unmark = (key) => known.mutation.mutate(unmarkRequest(key));
  const exclude = (entry) => {
    if (!userId) return loginToast('로그인하면 아는 단어로 옮길 수 있어요');
    const key = entry.key;
    // 서버가 받은 뒤에만 — 숨기기를 켰을 때만 카드가 사라지므로 그때만 되돌리기 토스트.
    known.mutation.mutateAsync({ lang: conf.langCode, wordText: key, known: true }).then(() => {
      if (prefsRef.current.hideKnown) setToast({ message: '아는 단어로 옮겼어요', action: '되돌리기', onAction: () => { unmark(key); setToast(null); } });
    }, () => { /* 실패 알림 · 되돌리기는 useKnownWords가 맡는다. */ });
  };
  const markO = (entry) => (knownSet.has(entry.key) ? unmark(entry.key) : exclude(entry));
  const markX = async (entry) => {
    if (!userId) return loginToast('로그인하면 단어를 저장할 수 있어요');
    // 모른다고 한 바로 그때 답을 본다(디자인 검토 B안) — 탭 보기에서 X를 누르면 그 카드를 펼친다(접기 · 10초는 그대로).
    if (prefs.view !== 'all') openPeek(entry.key);
    if (!knownSet.has(entry.key)) return save(entry);
    // 아는 단어면 먼저 풀고, 서버가 풀어 준 뒤에만 공부 중으로 담는다(아는 단어는 저장이 막힌다). 풀지 못하면 담지 않는다.
    try { await known.mutation.mutateAsync(unmarkRequest(entry.key)); } catch { return undefined; }
    return save(entry);
  };
  // 탭별 O — 그 탭 기록만 켜고 끈다(아는 단어 · 복습은 그대로). 네 탭이 모두 O면 아는 단어로 옮길지 한 번 묻는다.
  const markFacetO = (entry) => {
    if (!userId) return loginToast('로그인하면 아는 단어를 기록할 수 있어요');
    const facet = facetView, label = LEVEL_VIEWS.find((v) => v.id === facet)?.label;
    const mark = facetMark(facetIdx, entry.key, facet) === 'o' ? null : 'o';
    facets.mark({ wordText: entry.key, facet, mark });
    if (!mark) return;
    const after = new Map(facetIdx).set(normalizeKnownWord(entry.key), { ...facetIdx.get(normalizeKnownWord(entry.key)), [facet]: 'o' });
    if (allFacetsKnown(after, entry.key) && !knownSet.has(entry.key)) {
      setToast({ message: '네 탭 모두 알아요. 아는 단어로 옮길까요?', action: '옮기기', onAction: () => { exclude(entry); setToast(null); } });
    } else if (prefs.hideKnown) {
      setToast({ message: `${label} 탭에서 숨겼어요`, action: '되돌리기', onAction: () => { facets.mark({ wordText: entry.key, facet, mark: null }); setToast(null); } });
    }
  };
  // 탭별 X — 그 탭에 X를 남기고 공부 중인 단어로 담는다(markX 그대로). 이미 X면 그 탭 기록만 지운다(담긴 카드는 그대로).
  const markFacetX = (entry) => {
    if (!userId) return loginToast('로그인하면 단어를 저장할 수 있어요');
    if (facetMark(facetIdx, entry.key, facetView) === 'x') return facets.mark({ wordText: entry.key, facet: facetView, mark: null });
    facets.mark({ wordText: entry.key, facet: facetView, mark: 'x' });
    markX(entry);
  };

  // 진도(지금 탭) — 아는 = 숨김 기준과 같은 집합, 공부 중 = 전체 탭은 단어장 저장, 탭 보기는 그 탭의 X.
  const progress = useMemo(() => {
    if (!vocab || !mounted || !userId || !allEntries.length) return null;
    const studying = facetView ? new Set([...facetIdx].filter(([, m]) => m[facetView] === 'x').map(([w]) => w)) : saved;
    return levelProgress(allEntries, hiddenSet, studying);
  }, [vocab, mounted, userId, allEntries, facetView, facetIdx, hiddenSet, saved]);
  // 이어 하기 — 배움 입구 카드가 읽는 이 기기의 사본(전체 기준 개수 + 마지막 보기).
  useEffect(() => {
    if (!vocab || !mounted || !userId || !allEntries.length) return;
    const p = levelProgress(allEntries, knownSet, saved);
    try { writeLevelSnapshot(localStorage, lang, levelKey, { ...p, view: prefs.view, at: Date.now() }); } catch { /* 저장소 없음 */ }
  }, [vocab, mounted, userId, allEntries, knownSet, saved, lang, levelKey, prefs.view]);

  const hideKnown = vocab && prefs.hideKnown;
  const { shown, knownCount } = useMemo(() => {
    let known = 0;
    const filtered = groups.map((g) => {
      const split = vocab ? splitKnown(g.entries, hiddenSet) : { shown: g.entries, known: [] };
      known += split.known.length;
      return { name: g.name, entries: (hideKnown ? split.shown : g.entries).filter((e) => matchesLevelQuery(e, query)) };
    });
    return { shown: filtered.filter((g) => g.entries.length), knownCount: known };
  }, [groups, vocab, hiddenSet, query, hideKnown]);
  // 찾기 말을 바꿀 때만 처음 150개로 — 첫 그리기 · 뒤로 가기 복원(찾던 말을 되살림)에서는 그린 개수를 그대로 둔다.
  const lastQuery = useRef(query);
  useEffect(() => {
    if (lastQuery.current === query) return;
    lastQuery.current = query;
    setLimit(LEVEL_LIST_PAGE);
  }, [query]);
  // 점진 그리기 — 묶음 순서대로 limit개까지만. 묶음 제목의 개수는 전체 개수다.
  const { visible, total } = useMemo(() => {
    let budget = limit;
    const out = shown.map((g) => {
      const entries = g.entries.slice(0, Math.max(0, budget));
      budget -= entries.length;
      return { ...g, entries, count: g.entries.length };
    });
    return { visible: out, total: shown.reduce((n, g) => n + g.entries.length, 0) };
  }, [shown, limit]);
  const rest = Math.max(0, total - limit);

  // 키보드 — 단어 탭만(LEVEL-KEYS-001, 오너 목업 승인 2026-10-17 KST). 지금 카드 하나만 Tab 정지(roving)이고,
  // ↑↓ 이동 · O 안다 · X 모른다(누른 뒤 다음 카드로) · Space 펼치기 · Esc 접기. O · X는 클릭과 같은 onO · onX 경로다.
  const cardKeys = useMemo(() => (vocab ? visible.flatMap((g) => g.entries.map((e) => e.key)) : []), [vocab, visible]);
  const cardEntries = useMemo(() => new Map(visible.flatMap((g) => g.entries.map((e) => [e.key, e]))), [visible]);
  const [cursorKey, setCursorKey] = useState(null);
  const currentKey = cursorKey != null && cardEntries.has(cursorKey) ? cursorKey : (cardKeys[0] ?? null);
  const focusNext = useRef(null); // 다음 그리기 뒤 포커스를 옮길 카드 키
  const growFrom = useRef(null); // 더 그린 뒤 이 카드의 다음으로 옮긴다
  const listRef = useRef(null);
  const prevCardKeys = useRef([]); // 직전 그리기의 카드 순서 — 지금 카드가 사라지면 가까운 카드를 찾는다
  const goTo = (key) => { setCursorKey(key); focusNext.current = key; };
  const moveFrom = (from, delta) => {
    const step = levelListMove(cardKeys, from, delta, { canGrow: rest > 0 });
    if (step?.grow) { growFrom.current = from; setLimit((n) => n + LEVEL_LIST_PAGE); } else if (step?.key) goTo(step.key);
  };
  // 지금 카드가 사라졌다(숨기기 켠 채 마지막 카드 O · 되돌리기 · 검색) — 가장 가까운 남은 카드를 지금 카드로 삼고,
  // 포커스가 body로 떨어졌을 때만 그 카드(없으면 목록 안내 줄)로 옮긴다. 옮길 카드가 사라진 대기 포커스는 버린다.
  useEffect(() => {
    const before = prevCardKeys.current;
    prevCardKeys.current = cardKeys;
    if (focusNext.current && !cardEntries.has(focusNext.current)) focusNext.current = null;
    if (cursorKey == null || cardEntries.has(cursorKey)) return;
    const near = levelListNearest(before, cursorKey, cardEntries);
    setCursorKey(near);
    const lost = typeof document !== 'undefined' && (!document.activeElement || document.activeElement === document.body);
    if (!lost) return;
    if (near) { focusNext.current = near; return; }
    const fallback = listRef.current?.querySelector('h2, .lv-empty');
    if (fallback) { if (!fallback.hasAttribute('tabindex')) fallback.setAttribute('tabindex', '-1'); fallback.focus({ preventScroll: true }); }
    // 카드 목록이 바뀔 때만 본다 — 지금 카드는 목록이 바뀌어야 사라진다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardKeys]);
  useEffect(() => {
    const key = focusNext.current;
    if (!key || !listRef.current) return;
    const node = [...listRef.current.querySelectorAll('[data-lv-card]')].find((n) => n.dataset.lvCard === key);
    if (!node) return;
    focusNext.current = null;
    node.focus({ preventScroll: true });
    node.scrollIntoView?.({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  });
  useEffect(() => {
    const from = growFrom.current;
    if (!from) return;
    growFrom.current = null;
    const step = levelListMove(cardKeys, from, 1);
    if (step?.key) { setCursorKey(step.key); focusNext.current = step.key; }
  }, [cardKeys]);
  const onCardKey = (event) => {
    const action = levelListKeyAction(event);
    if (!action) return;
    // 카드 자체(또는 카드 안의 버튼 · 링크가 아닌 곳)에서 누른 키만 — 「더 보기」 · 듣기 같은 버튼은 제 Space · Enter를 그대로 쓴다.
    const target = event.target;
    const node = target?.closest?.('[data-lv-card]');
    if (!node || (node !== target && target.closest?.('button, a'))) return;
    const entry = cardEntries.get(node.dataset?.lvCard);
    if (!entry) return;
    if (action === 'next' || action === 'prev') { event.preventDefault(); moveFrom(entry.key, action === 'next' ? 1 : -1); return; }
    if (action === 'o' || action === 'x') {
      event.preventDefault();
      // 게스트 — 클릭과 같은 로그인 안내만 띄우고 그 카드에 머문다(표시하지 않았는데 넘어가지 않게).
      if (!userId) { if (action === 'o') { if (facetView) markFacetO(entry); else exclude(entry); } else if (facetView) markFacetX(entry); else markX(entry); return; }
      // 진행 중(아는 단어 반영 중 · 공부 중으로 담는 중 · 탭 기록 보내는 중)인 카드는 클릭처럼 막는다 — 다음 카드로도 넘어가지 않는다.
      if (saving.has(entry.key) || (mounted && known.isPendingWord(conf.langCode, entry.key)) || (facetView && facets.isPending?.(entry.key))) return;
      // 키보드는 켜기만 한다(목업 「O 안다 · X 모른다」) — 이미 그 표시면 풀지 않고 다음 카드로만. 버튼 클릭(aria-pressed)은 그대로 켜고 끈다.
      const mark = facetView ? facetMark(facetIdx, entry.key, facetView) : (knownSet.has(entry.key) ? 'o' : null);
      if (action === 'o' && mark !== 'o') { if (facetView) markFacetO(entry); else exclude(entry); }
      if (action === 'x' && !(facetView && mark === 'x')) { if (facetView) markFacetX(entry); else markX(entry); }
      moveFrom(entry.key, 1);
      return;
    }
    if (action === 'peek' && prefs.view !== 'all') { event.preventDefault(); togglePeek(entry.key); return; }
    if (action === 'close' && peek.get(entry.key)?.phase === 'open') { event.preventDefault(); closePeek(entry.key); }
  };
  useEffect(() => {
    const node = moreRef.current;
    if (!node || !rest || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((items) => {
      if (items.some((i) => i.isIntersecting)) setLimit((n) => n + LEVEL_LIST_PAGE);
    }, { rootMargin: '600px 0px' });
    io.observe(node);
    return () => io.disconnect();
  }, [rest]);
  // 목차로 아직 안 그린 묶음에 가면 그 묶음까지 그린 뒤 옮겨 간다.
  const openGroup = (event, gi) => {
    const start = shown.slice(0, gi).reduce((n, g) => n + g.entries.length, 0);
    if (start < limit) return;
    event.preventDefault();
    setLimit(start + LEVEL_LIST_PAGE);
    setJumpTo(gi);
  };
  useEffect(() => {
    if (jumpTo == null) return;
    document.getElementById(`lv-${kind}-${jumpTo}`)?.scrollIntoView();
    setJumpTo(null);
  }, [jumpTo, kind]);

  // 뒤로 가기 자리(LEVEL-RESTORE-001 — levelPlaceOf). 남기기: 굴리기를 멈췄을 때 · 링크를 누를 때(GNB 포함) · 페이지를 떠날 때
  // 이 기록에 { 그린 개수 · 세로 위치 · 기준 카드 · 찾던 말 }을 쓴다. 되살리기: 처음 그린 직후(그리기 전) 그 개수만큼 그리고,
  // 묶음 생략(content-visibility)을 잠시 끈 채 그 자리로 옮긴다 — 생략된 묶음의 어림 높이(1200px)로 맞추면 다른 줄에 선다.
  // 서버 렌더 · 하이드레이션은 늘 150개(불일치 0)이고, 늘리는 것은 붙은 뒤 layout effect다. 한자판은 목록이 아니라 쓰지 않는다.
  const limitRef = useRef(limit);
  limitRef.current = limit;
  const queryRef = useRef(query);
  queryRef.current = query;
  const placeRef = useRef(null); // 되살리는 중인 자리 — 끝나면 null
  const [restoring, setRestoring] = useState(false);
  useLayoutEffect(() => {
    if (hanzi) return;
    const place = levelPlaceOf(window.history.state, window.location.pathname);
    if (!place) return;
    placeRef.current = place;
    lastQuery.current = place.query; // 찾던 말을 되살려도 그린 개수를 150으로 되돌리지 않는다
    setQuery(place.query);
    setLimit(Math.max(LEVEL_LIST_PAGE, place.limit));
    setRestoring(true);
  }, [hanzi]);
  useLayoutEffect(() => {
    const place = placeRef.current;
    if (!restoring || !place) return undefined;
    const started = performance.now();
    let frame = 0, settled = started, done = false;
    const card = () => (place.key && listRef.current
      ? listRef.current.querySelector(`[data-lv-card="${CSS.escape(place.key)}"], [data-lv-pat="${CSS.escape(place.key)}"]`) : null);
    // 기준 카드가 있으면 그 카드를 남길 때의 높이에, 없으면(숨긴 카드 · 찾기로 빠진 카드) 남긴 세로 위치에.
    const apply = () => {
      const node = card();
      const top = node ? window.scrollY + node.getBoundingClientRect().top - place.top : place.y;
      if (Math.abs(window.scrollY - top) < 1) return false;
      window.scrollTo({ top, behavior: 'instant' });
      return true;
    };
    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(frame);
      off();
      // 생략을 다시 켜기 전에 묶음마다 실제 높이를 어림값으로 박는다 — 화면 밖 묶음이 1200px로 돌아가 줄이 튀지 않게.
      for (const group of pageRef.current?.querySelectorAll('[data-lv-group]') || []) {
        group.style.containIntrinsicSize = `auto ${Math.round(group.getBoundingClientRect().height)}px`;
      }
      placeRef.current = null;
      setRestoring(false);
    };
    // 계정 상태(진도 줄 · 아는 단어 숨기기 · 듣기 버튼)는 붙은 뒤 늦게 그려진다 — 0.6초 동안 더 고칠 것이 없을 때까지(최대 4초) 맞춘다.
    const tick = () => {
      const now = performance.now();
      if (apply()) settled = now;
      if (now - settled > 600 || now - started > 4000) finish(); else frame = requestAnimationFrame(tick);
    };
    // 사용자가 먼저 움직이면(굴리기 · 누르기 · 키) 거기서 멈춘다(useRestoreScroll과 같은 규칙).
    const stop = () => finish();
    const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    const off = () => events.forEach((name) => window.removeEventListener(name, stop));
    events.forEach((name) => window.addEventListener(name, stop, { passive: true }));
    apply(); // 첫 그림부터 그 자리
    frame = requestAnimationFrame(tick);
    return () => { done = true; cancelAnimationFrame(frame); off(); };
  }, [restoring]);
  useEffect(() => {
    if (hanzi) return undefined;
    const path = window.location.pathname;
    let timer = 0;
    // 기준 카드 = 붙어 다니는 머리 바로 밑에 걸친 첫 카드(이분 탐색 — 카드는 문서 순서대로 위에서 아래). 문형은 문형 칸(data-lv-pat)이
    // 기준이다 — 주제 칩으로 건너뛰면 사이 묶음이 어림 높이로 남아, 세로 위치만으로는 다른 문형에 선다.
    const anchor = () => {
      const cards = listRef.current?.querySelectorAll('[data-lv-card], [data-lv-pat]');
      if (!cards?.length) return {};
      const edge = barRef.current && vocab ? barRef.current.getBoundingClientRect().bottom : 0;
      let low = 0, high = cards.length - 1;
      while (low < high) {
        const mid = (low + high) >> 1;
        if (cards[mid].getBoundingClientRect().bottom <= edge) low = mid + 1; else high = mid;
      }
      return { key: cards[low].dataset.lvCard ?? cards[low].dataset.lvPat, top: Math.round(cards[low].getBoundingClientRect().top * 10) / 10 };
    };
    const remember = () => {
      clearTimeout(timer);
      // 되살리는 중에는 덮어쓰지 않고, 이미 다른 주소로 떠났으면(새 기록) 쓰지 않는다.
      if (placeRef.current || window.location.pathname !== path) return;
      const place = { path, limit: limitRef.current, query: queryRef.current, y: Math.round(window.scrollY), ...anchor() };
      try { window.history.replaceState(withLevelPlace(window.history.state, place), '', window.location.href); } catch { /* 기록 쓰기 제한 — 자리만 잃는다 */ }
    };
    const scroll = () => { clearTimeout(timer); timer = setTimeout(remember, 200); };
    const click = (event) => { if (event.target?.closest?.('a[href]')) remember(); };
    // 떠날 때 — bfcache로 들어가는 길(persisted)이면 쓰지 않는다. pagehide 안의 history.replaceState는 Chromium이 그 페이지를
    // bfcache에서 내쫓는다(IgnoreEventAndEvict, 실측 2026-10-17 KST) — 즉시 뒤로가기가 새로 불러오기가 됐다. bfcache로 돌아오면
    // 화면 · 스크롤이 그대로라 자리를 따로 남길 필요가 없고, 링크 누름(capture)과 굴리기 멈춤이 이미 이 기록에 남겨 둔다.
    const hide = (event) => { if (!event.persisted) remember(); };
    window.addEventListener('scroll', scroll, { passive: true });
    document.addEventListener('click', click, true);
    window.addEventListener('pagehide', hide);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', scroll);
      document.removeEventListener('click', click, true);
      window.removeEventListener('pagehide', hide);
    };
  }, [hanzi, vocab]);

  // 목차 — 보이는 묶음을 따라간다.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const nodes = [...document.querySelectorAll('[data-lv-group]')];
    const io = new IntersectionObserver((items) => {
      const top = items.filter((i) => i.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (top) setActiveGroup(Number(top.target.dataset.lvGroup));
    }, { rootMargin: '-20% 0px -70% 0px' });
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [shown]);

  const title = `${levelLabel(levelKey)} ${LEVEL_KIND_LABEL[kind]}`;
  const groupId = (i) => `lv-${kind}-${i}`;
  const nav = shown.map((g, i) => ({ i, name: g.name, href: `#${groupId(i)}`, current: i === activeGroup }));
  const speakOk = mounted && ttsSupported;

  return <div ref={pageRef} className={`manabi-page lv-page lv-page--${kind}`} data-language={conf.langCode} data-lv-restoring={restoring || undefined}>
    <div ref={barRef} className={vocab ? 'lv-bar lv-bar--sticky' : 'lv-bar'}>
      <div className="lv-head">
        <h1>{title}</h1>
        {vocab && <button type="button" className="lv-navbtn" aria-label="레벨 · 목록 바꾸기" title="레벨 · 목록 바꾸기" aria-expanded={navOpen} aria-controls="lv-nav"
          onClick={() => setNavOpen((v) => !v)}><ChevronIcon /></button>}
        {vocab && <span className="lv-head__tools">
          <button type="button" className="lv-gear" aria-label="찾기" title="찾기" aria-expanded={searchOpen || !!query} aria-controls="lv-find"
            onClick={() => setSearchOpen((v) => !v)}><SearchIcon /></button>
          <button type="button" className="lv-gear" aria-label="설정" title="설정" aria-expanded={settingsOpen} aria-controls="lv-settings"
            onClick={() => setSettingsOpen((v) => !v)}><GearIcon /></button>
        </span>}
      </div>
      <div className="lv-nav" id="lv-nav" hidden={!navOpen}>
        <p className="lv-crumb"><Link href={`/lessons?lang=${conf.language}`}>← 교재</Link></p>
        <nav className="lv-pills" aria-label="레벨">
          {conf.levels.map((key) => <Link key={key} href={levelListHref(lang, levelKinds(lang, key).includes(kind) ? kind : 'vocab', key)} aria-current={key === levelKey ? 'page' : undefined}
            aria-label={levelLabel(key)}>{levelPill(key)}<NavPendingMark /></Link>)}
        </nav>
        {/* 탭이 하나뿐인 레벨(H7 7–9 통합 밴드 = 단어만)은 종류 탭을 그리지 않는다. */}
        {levelKinds(lang, levelKey).length > 1 && <nav className="lv-tabs" aria-label="목록 종류">
          {levelKinds(lang, levelKey).map((k) => <Link key={k} href={levelListHref(lang, k, levelKey)} aria-current={k === kind ? 'page' : undefined}>{LEVEL_KIND_LABEL[k]}<NavPendingMark /></Link>)}
        </nav>}
      </div>
      {vocab && (searchOpen || query) && <div className="lv-tools" id="lv-find">
        <label className="lv-search"><SearchIcon /><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="찾기" aria-label={`${title}에서 찾기`} autoFocus={searchOpen} /></label>
      </div>}
      {vocab && settingsOpen && <div className="lv-settings" id="lv-settings">
        {[['hideKnown', '아는 단어 숨기기', knownCount > 0 ? `${facetView ? `${LEVEL_VIEWS.find((v) => v.id === facetView)?.label} 탭 ` : ''}${knownCount}개` : null],
          ...(zhVocab ? [['hun', '훈음', '한자마다 뜻과 소리'], ['tone', '성조 색', '병음 1성 빨강 · 2성 초록 · 3성 파랑 · 4성 보라'], ['glyph', '한자 대조', '正 대만 정체 · 日 일본어 표기']] : [])]
          .map(([key, label, note]) => <button key={key} type="button" role="switch" className="lv-switch" aria-checked={prefs[key]}
            onClick={() => setPrefs({ [key]: !prefs[key] })}><span>{label}{note && <small>{note}</small>}</span><i aria-hidden="true" /></button>)}
      </div>}
      {/* 진도 — 공부 화면에는 숫자 하나만(오너 2026-10-16 「숫자가 대거 적히면 시선이 분산」). 자세한 개수는 배움 입구 카드. */}
      {progress && <div className="lv-prog">
        <span className="lv-meter" aria-hidden="true"><i className="lv-meter__k" style={{ width: `${(progress.known / progress.total) * 100}%` }} />
          <i className="lv-meter__s" style={{ width: `${(progress.studying / progress.total) * 100}%` }} /></span>
        <span className="lv-prog__left">{progress.left > 0 ? `${progress.left.toLocaleString('en-US')}개 남음` : '다 봤어요'}</span>
        {progress.studying > 0 && <Link className="lv-prog__review" href={reviewHref} prefetch={false}>복습하기 →</Link>}
      </div>}
      {vocab && <div className="lv-view" role="group" aria-label="보기">
        {LEVEL_VIEWS.map((v) => <button key={v.id} type="button" aria-pressed={prefs.view === v.id}
          onClick={() => setPrefs({ view: v.id })}>{v.label}</button>)}
      </div>}
    </div>
    {!vocab && !hanzi && <div className="lv-tools">
      <label className="lv-search"><SearchIcon /><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="찾기" aria-label={`${title}에서 찾기`} /></label>
    </div>}
    {hanzi ? <HanziBoard levelKey={levelKey} groups={groups} userId={mounted ? userId : null} mounted={mounted} say={speakOk ? say : null}
      loginHref={authEntryHref(pathname)} words={{
        knownSet, save, exclude, loadSaved, prepare: prepareSave,
        isSaved: (key) => saved.has(key), isSaving: (key) => saving.has(key),
        isPendingKnown: (key) => mounted && !!userId && known.isPendingWord(conf.langCode, key),
      }} /> : <>
      <nav className="lv-chips" aria-label="주제">{nav.map((n) => <a key={n.href} href={n.href} aria-current={n.current || undefined} onClick={(e) => openGroup(e, n.i)}>{n.name}</a>)}</nav>
      <div className="lv-split">
        <div className="lv-col" ref={listRef} onKeyDown={vocab ? onCardKey : undefined}>
          {/* 마우스를 쓰는 화면에서만 보인다(복습방 .review-keys-hint — pointer: fine). */}
          {vocab && shown.length > 0 && <p className="lv-keys review-keys-hint">⌨ ↑↓ 카드 이동 · O 안다 · X 모른다 · Space 펼치기</p>}
          {shown.length === 0 && <p className="lv-empty" role="status">{query ? '이 레벨에서 찾지 못했어요' : '모든 단어를 아는 단어로 옮겼어요. 「아는 단어 숨기기」를 끄면 다시 보여요'}</p>}
          {visible.map((g, gi) => g.entries.length > 0 && <section key={g.name} className="lv-group" id={groupId(gi)} data-lv-group={gi} aria-labelledby={`${groupId(gi)}-h`}>
            <h2 id={`${groupId(gi)}-h`}>{g.name}<span>{g.count}</span></h2>
            <ul className="lv-entries">{g.entries.map((e) => vocab ? <VocabCard key={e.key} entry={e} lang={lang} levelKey={levelKey}
              view={prefs.view} scoped={!!facetView} peek={peek.get(e.key)?.phase} peekEpoch={peek.get(e.key)?.epoch} onPeek={() => togglePeek(e.key)} onRenew={() => renewPeek(e.key)}
              speak={speakOk ? say : null}
              hunCells={hunOf(e.word)} glyph={glyphOf(e.word)} tone={zhVocab && prefs.tone}
              known={facetView ? facetMark(facetIdx, e.key, facetView) === 'o' : knownSet.has(e.key)}
              studying={facetView ? facetMark(facetIdx, e.key, facetView) === 'x' : saved.has(e.key)} saving={saving.has(e.key)}
              pendingKnown={mounted && !!userId && known.isPendingWord(conf.langCode, e.key)}
              onO={() => (facetView ? markFacetO(e) : markO(e))} onX={() => (facetView ? markFacetX(e) : markX(e))} onPrepareX={mounted && userId ? prepareSave : undefined}
              current={e.key === currentKey} onCardFocus={() => setCursorKey(e.key)} /> : <li key={e.key} className="lv-pat" data-lv-pat={e.key}>
              <div className="lv-pat__head"><span className="lv-hw" lang={lang === 'chinese' ? 'zh-CN' : 'ja'}>{e.pattern}</span>{e.ko && <span className="lv-pat__ko">{e.ko}</span>}</div>
              {e.conn && <p className="lv-formula">{e.conn}</p>}
              {e.note && <p className="lv-note">{e.note}</p>}
              {e.exs.length > 0 && <div className="lv-pat__exs">{e.exs.map((ex, i) => <Example key={i} ex={ex} lang={lang} speak={speakOk ? say : null} />)}</div>}
            </li>)}</ul>
          </section>)}
          {/* 단어 목록은 「N개 남음」이 진도 줄 하나뿐이다 — 더 보기에 같은 말로 다른 숫자를 두지 않는다. */}
          {rest > 0 && <div ref={moreRef} className="lv-more"><button type="button" onClick={() => setLimit((n) => n + LEVEL_LIST_PAGE)}>{vocab ? '더 보기' : `더 보기 · ${rest.toLocaleString('en-US')}개 남음`}</button></div>}
          <p className="lv-src">{conf.source}</p>
        </div>
      </div>
    </>}
    {toast && <div className="lv-toast" role="status">
      <span>{toast.message}</span>
      {toast.href ? <Link href={toast.href}>{toast.action}</Link> : toast.onAction ? <button type="button" onClick={toast.onAction}>{toast.action}</button> : null}
    </div>}
  </div>;
}
