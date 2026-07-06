'use client';

// 🎧 듣고 읽기 (실험) — LingQ식 「영상 검색 → 자막 자동 로드 → 정독」 도구.
// 영상 검색·자막은 서버 라우트(/api/media/*)가 youtubei.js(비공식)로 가져온다
// — 비상업 개인용 전제의 오너 결정. 라이브러리 파손 시를 대비해 .srt/.vtt
// 업로드·텍스트 붙여넣기(직접 입력)가 상시 폴백. 재생 위치에 싱크된
// 스크립트에서 모르는 표현을 탭해 단어장(user_vocabulary)에 저장한다.
//
// 접근: 로그인 + profiles.role==='admin'만. admin 🧪 신기능 탭에서만 진입.
// 영속화 없음(실험) — 저장된 단어만 영구.

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import YouTube from 'react-youtube';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import Spinner from '../components/Spinner';
import Button from '../components/Button';
import {
  parseYouTubeId,
  parseTimedSubtitles,
  parsePlainTextCues,
  findActiveCueIndex,
  formatCueTime,
  segmentWords,
  matchTokenAt,
  groupTokensToUnits,
  layoutUnits,
} from '../lib/listenSubtitles';

// 언어 선택지 — REF_LANGS를 직접 import하면 교재 콘텐츠 전체가 클라 번들에 딸려 온다(1.8MB).
// 키는 REF_LANGS와 반드시 일치(user_vocabulary.language·/api/analyze 규약).
// code = YouTube 자막 언어 코드(/api/media/captions에 넘김)
const LANG_OPTIONS = [
  { key: 'Japanese', name: '일본어', flag: '🇯🇵', code: 'ja' },
  { key: 'English',  name: '영어',   flag: '🇬🇧', code: 'en' },
  { key: 'French',   name: '프랑스어', flag: '🇫🇷', code: 'fr' },
  { key: 'Chinese',  name: '중국어', flag: '🇨🇳', code: 'zh' },
];
const LANG_KEYS = new Set(LANG_OPTIONS.map(l => l.key));
const LANG_CODE = Object.fromEntries(LANG_OPTIONS.map(l => [l.key, l.code]));

// 자막 트랙 코드(ja-JP·en-US·es 등) → REF_LANGS 키. 지역 접미사를 떼고 기본 언어로 역변환.
// 매핑되면 그 키(단어장 지원), 안 되면 null(단어장 미지원 언어).
function langKeyFromCode(code) {
  const base = String(code || '').split('-')[0].toLowerCase();
  return LANG_OPTIONS.find(l => l.code === base)?.key || null;
}

const POLL_MS = 250;
const MANUAL_SCROLL_SUPPRESS_MS = 3000;

// react-youtube onError의 event.data(YouTube IFrame Player API 에러 코드)별 안내.
//   · 101/150 = 소유자가 외부(임베드) 재생을 차단 → 다른 영상으로 안내
//   · 100     = 삭제/비공개
//   · 2       = 잘못된 videoId 파라미터
//   · 5/그 외 = HTML5 플레이어/일시 오류
// findAnother=true면 "다른 영상 찾기"로 검색 화면 복귀를 권한다.
function describePlayerError(code) {
  switch (code) {
    case 101:
    case 150:
      return { text: '이 영상은 외부 재생이 막혀 있어요 — 다른 영상을 골라주세요.', findAnother: true };
    case 100:
      return { text: '영상이 삭제됐거나 비공개예요.', findAnother: false };
    case 2:
      return { text: 'YouTube 주소를 다시 확인해주세요.', findAnother: false };
    default:
      return { text: '재생에 실패했어요 — 잠시 후 다시 시도해주세요.', findAnother: false };
  }
}

// 분석 결과 토큰 칩으로 쓸 만한 토큰만 (기호·개행·공백 제외)
function isMeaningfulToken(t) {
  if (!t || !t.text) return false;
  if (t.pos === '개행') return false;
  const s = String(t.text).trim();
  if (!s) return false;
  // 한 글자 이상의 문자(한자·가나·한글·라틴·키릴 등)가 있어야 칩
  return /[\p{L}\p{N}]/u.test(s) && !/^[\p{P}\p{S}\s]+$/u.test(s);
}

export default function ListenLabPage() {
  const { user, profile, isAdmin, loading } = useAuth();
  const toast = useToast();

  // ── 입력 단계 상태 ──
  const [urlInput, setUrlInput] = useState('');
  const [videoId, setVideoId] = useState(null);
  const [cues, setCues] = useState([]);          // { start, end, text, timed }
  const [timed, setTimed] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [language, setLanguage] = useState('Japanese');
  const [inputError, setInputError] = useState('');
  const [started, setStarted] = useState(false);
  // null=정상, 그 외=YouTube IFrame 에러 코드(2/5/100/101/150 등). 코드별로 안내를 분기한다.
  const [playerError, setPlayerError] = useState(null);

  // ── 영상 찾기 탭 상태 ──
  const [inputTab, setInputTab] = useState('search');   // 'search' | 'manual'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [loadingVideoId, setLoadingVideoId] = useState(null);   // 자막 로드 중인 카드
  const [captionError, setCaptionError] = useState('');
  const [availableTracks, setAvailableTracks] = useState(null); // 요청 언어 없을 때 가용 목록
  const [pendingVideoId, setPendingVideoId] = useState(null);   // 언어 칩 선택 대기 중인 영상

  // 실제 로드된 자막 언어의 REF_LANGS 키 — 분석·저장의 정본(칩으로 다른 언어를
  // 골라 진입해도 오염되지 않게). LANG_OPTIONS에 없는 언어(es 등)면 null → 단어장 미지원.
  const [loadedLangKey, setLoadedLangKey] = useState(null);

  // 기본 언어 = 프로필 학습 언어 (배열/문자열 모두 대응), 없으면 일본어
  useEffect(() => {
    const raw = Array.isArray(profile?.learning_language)
      ? profile.learning_language[0]
      : profile?.learning_language;
    if (raw && LANG_KEYS.has(raw)) setLanguage(raw);
  }, [profile?.learning_language]);

  // ── 플레이어 · 싱크 상태 ──
  const playerRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeIdx, setActiveIdx] = useState(-1);
  const pollRef = useRef(null);
  const listRef = useRef(null);
  const cueRefs = useRef({});                     // idx → DOM 노드
  const suppressScrollUntil = useRef(0);          // 수동 스크롤 후 자동 스크롤 억제 시각

  // ── 분석·저장 상태 ──
  // analyzed[idx] = { status: 'loading'|'done'|'error', tokens: [{tokenId, text, furigana, meaning, base_form, pos}] }
  const [analyzed, setAnalyzed] = useState({});
  const [saved, setSaved] = useState({});         // `${idx}:${base}` → true (저장은 base 우선)
  // 인라인 탭 — 지금 열린 대상. 어절 단위 탭이면 { idx, unitIndex }, 미분석 세그먼트 탭이면
  // { idx, segStart, segText }(분석 완료 후 그 토큰이 속한 단위로 승격해 팝오버).
  const [activeTok, setActiveTok] = useState(null);
  // 문맥 해석(지연 로드) — `${idx}:${unitIndex}:${surface}` → { status, text }
  const [ctxMap, setCtxMap] = useState({});

  // ── 문장 번역(기능 1) ──
  const [koMap, setKoMap] = useState({});         // idx → 한국어 번역(부분 도착 즉시 렌더)
  const [showKo, setShowKo] = useState(true);     // 번역 표시 토글 (localStorage 기억)
  useEffect(() => {
    try {
      const v = localStorage.getItem('listen_show_ko');
      if (v != null) setShowKo(v === '1');
    } catch { /* 무해 */ }
  }, []);
  const toggleKo = () => setShowKo((v) => {
    const next = !v;
    try { localStorage.setItem('listen_show_ko', next ? '1' : '0'); } catch { /* 무해 */ }
    return next;
  });

  // ── 파일 선택 → 자막 파싱 ──
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseTimedSubtitles(text);
      if (parsed.length === 0) {
        setInputError('자막을 읽지 못했어요. .srt 또는 .vtt 파일인지 확인해주세요.');
        return;
      }
      setCues(parsed);
      setTimed(true);
      setInputError('');
      setPasteText('');
    } catch {
      setInputError('파일을 읽지 못했어요.');
    }
    e.target.value = ''; // 같은 파일 재선택 허용
  };

  // ── 붙여넣기 텍스트 → 타임리스 큐 ──
  const applyPaste = () => {
    const parsed = parsePlainTextCues(pasteText);
    if (parsed.length === 0) {
      setInputError('붙여넣은 텍스트가 비어 있어요.');
      return;
    }
    setCues(parsed);
    setTimed(false);
    setInputError('');
  };

  // ── 인증 헤더 (로그인 세션 Bearer) ──
  const authHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const h = { 'Content-Type': 'application/json' };
    if (session?.access_token) h.Authorization = `Bearer ${session.access_token}`;
    return h;
  }, []);

  // ── 영상 검색 ──
  const runSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setSearchError('');
    setSearchResults([]);
    setCaptionError('');
    setAvailableTracks(null);
    setPendingVideoId(null);
    try {
      const res = await fetch('/api/media/search', {
        method: 'POST',
        headers: await authHeaders(),
        // 학습 언어를 함께 보내 검색을 그 언어권으로 편향 + 자막 뱃지 대조.
        body: JSON.stringify({ query: q, lang: LANG_CODE[language] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const results = Array.isArray(data?.results) ? data.results : [];
      if (results.length === 0) setSearchError('검색 결과가 없어요. 직접 입력으로도 시작할 수 있어요.');
      setSearchResults(results);
    } catch (e) {
      setSearchError(e?.message || '검색에 실패했어요. 직접 입력을 이용해주세요.');
    } finally {
      setSearching(false);
    }
  };

  // ── 영상 선택 → 자막 자동 로드 → 성공 시 바로 학습 시작 ──
  const loadVideo = async (vid, langCode) => {
    setLoadingVideoId(vid);
    setCaptionError('');
    setAvailableTracks(null);
    try {
      const res = await fetch('/api/media/captions', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ videoId: vid, lang: langCode }),
      });
      const data = await res.json();
      if (res.status === 409 && Array.isArray(data?.available) && data.available.length > 0) {
        // 요청 언어 자막이 없음 — 무엇이 없고 무엇으로 학습 가능한지 명시하고 고르게
        const wantedName = LANG_OPTIONS.find(l => l.code === langCode)?.name || '선택한 언어';
        const offerKeys = [...new Set(data.available.map(t => langKeyFromCode(t.code)).filter(Boolean))];
        const offerNames = offerKeys.map(k => LANG_OPTIONS.find(l => l.key === k)?.name).filter(Boolean);
        setAvailableTracks(data.available);
        setPendingVideoId(vid);
        setCaptionError(
          offerNames.length > 0
            ? `이 영상은 ${wantedName} 자막이 없어요 — ${offerNames.join('·')} 콘텐츠예요. 아래 언어로 학습할까요?`
            : `이 영상은 ${wantedName} 자막이 없어요. 아래에서 자막 언어를 골라주세요.`
        );
        return;
      }
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const cuesRaw = Array.isArray(data?.cues) ? data.cues : [];
      if (cuesRaw.length === 0) throw new Error('자막이 비어 있어요.');
      // 서버 큐 {from,to,text} → 앱 큐 {start,end,text,timed}
      const nextCues = cuesRaw.map((c) => ({ start: c.from, end: c.to, text: c.text, timed: true }));
      // 로드된 자막 언어를 학습 문맥의 정본으로 확정 (칩으로 다른 언어를 골랐어도).
      const resolvedKey = langKeyFromCode(langCode);
      if (resolvedKey && resolvedKey !== language) {
        // 지원되는 다른 언어로 전환됨 — 안내 1회 + 셀렉터 동기화(재검색 시 그 언어 기준).
        const nm = LANG_OPTIONS.find((l) => l.key === resolvedKey)?.name || '';
        toast(`${nm} 자막으로 학습해요 — 단어는 ${nm} 단어장에 저장돼요.`, 'info');
        setLanguage(resolvedKey);
      }
      setLoadedLangKey(resolvedKey);
      setCues(nextCues);
      setTimed(true);
      setVideoId(vid);
      setInputError('');
      setPlayerError(null);
      setStarted(true);
    } catch {
      setCaptionError('자막을 가져오지 못했어요 — 직접 붙여넣기로 학습할 수 있어요.');
      setPendingVideoId(vid);
    } finally {
      setLoadingVideoId(null);
    }
  };

  // ── 시작: URL 파싱 + 큐 확인 ──
  const start = () => {
    const id = parseYouTubeId(urlInput);
    if (!id) {
      setInputError('YouTube 주소를 인식하지 못했어요. watch·youtu.be·shorts 링크를 넣어주세요.');
      return;
    }
    if (cues.length === 0) {
      setInputError('자막을 먼저 올리거나 붙여넣어 주세요.');
      return;
    }
    setVideoId(id);
    // 직접 입력은 사용자가 고른 학습 언어 그대로가 자막 언어 — 그 키를 정본으로.
    setLoadedLangKey(LANG_KEYS.has(language) ? language : null);
    setInputError('');
    setPlayerError(null);
    setStarted(true);
  };

  const reset = () => {
    stopPoll();
    setStarted(false);
    setVideoId(null);
    setActiveIdx(-1);
    setCurrentTime(0);
    setActiveTok(null);
    setAnalyzed({});
    setCtxMap({});
    setKoMap({});
    setPlayerError(null);
    setLoadedLangKey(null);
  };

  // ── 폴링 (재생 중 250ms) — getCurrentTime는 Promise ──
  const stopPoll = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const startPoll = useCallback(() => {
    if (pollRef.current || !timed) return;
    pollRef.current = setInterval(async () => {
      const p = playerRef.current;
      if (!p) return;
      try {
        const t = await p.getCurrentTime();
        if (typeof t === 'number' && !Number.isNaN(t)) setCurrentTime(t);
      } catch { /* 무해 */ }
    }, POLL_MS);
  }, [timed]);

  useEffect(() => stopPoll, [stopPoll]);

  // 현재 시각 → 활성 큐 (타임드 모드만)
  useEffect(() => {
    if (!timed) return;
    const idx = findActiveCueIndex(cues, currentTime);
    setActiveIdx(idx);
  }, [currentTime, cues, timed]);

  // 활성 큐 자동 스크롤 (수동 스크롤 억제 중이면 skip)
  useEffect(() => {
    if (!timed || activeIdx < 0) return;
    if (Date.now() < suppressScrollUntil.current) return;
    const node = cueRefs.current[activeIdx];
    const container = listRef.current;
    if (node && container) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeIdx, timed]);

  // 수동 스크롤 의도 감지 (휠·터치·키) → 3초간 자동 스크롤 억제
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const mark = () => { suppressScrollUntil.current = Date.now() + MANUAL_SCROLL_SUPPRESS_MS; };
    container.addEventListener('wheel', mark, { passive: true });
    container.addEventListener('touchmove', mark, { passive: true });
    return () => {
      container.removeEventListener('wheel', mark);
      container.removeEventListener('touchmove', mark);
    };
  }, [started]);

  // ── 플레이어 이벤트 ──
  const onReady = (e) => { playerRef.current = e.target; };
  const onStateChange = (e) => {
    // YT.PlayerState.PLAYING === 1
    if (e.data === 1) startPoll();
    else stopPoll();
  };
  // event.data = YouTube IFrame 에러 코드. 코드가 없으면(-1 등) 일반 오류로 처리.
  const onPlayerError = (e) => {
    const code = typeof e?.data === 'number' ? e.data : -1;
    setPlayerError(code);
  };

  // ── 큐 탭 → 해당 시점 seekTo ──
  const seekToCue = (cue) => {
    const p = playerRef.current;
    if (!p || cue.start == null) return;
    try { p.seekTo(cue.start, true); p.playVideo?.(); } catch { /* 무해 */ }
  };

  // ── 인라인 탭 → 그 줄 분석 (큐당 1회 캐시). 상태 토글 없이 "보장"만 한다 ──
  const ensureAnalyzed = useCallback(async (idx) => {
    if (analyzed[idx]) return;                       // 이미 로딩/완료면 재호출 금지
    setAnalyzed((m) => ({ ...m, [idx]: { status: 'loading', tokens: [] } }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers,
        body: JSON.stringify({ lines: [cues[idx].text], language: loadedLangKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      const result = data?.results?.[0];
      const tokens = (result?.sequence || [])
        .map((tid) => ({ tokenId: tid, ...result.dictionary[tid] }))
        .filter(isMeaningfulToken);

      setAnalyzed((m) => ({ ...m, [idx]: { status: 'done', tokens } }));
    } catch {
      setAnalyzed((m) => ({ ...m, [idx]: { status: 'error', tokens: [] } }));
    }
  }, [analyzed, cues, loadedLangKey]);

  // ── 재생 중 자동 분석: 현재+다음 큐를 백그라운드 analyze(큐당 1회 캐시·동시 1개) ──
  // 사용자가 보는 문장이 대체로 어절 단위가 되도록 미리 분석한다. 실패는 무해(탭 시 재시도).
  useEffect(() => {
    if (!started || activeIdx < 0 || !loadedLangKey) return;
    let cancelled = false;
    (async () => {
      // 순차 await = 이 쌍 안에서 동시 1개. ensureAnalyzed가 이미 캐시된 큐는 스킵한다.
      for (const i of [activeIdx, activeIdx + 1]) {
        if (cancelled) return;
        if (i < 0 || i >= cues.length || analyzed[i]) continue;
        await ensureAnalyzed(i);
      }
    })();
    return () => { cancelled = true; };
  }, [activeIdx, started, loadedLangKey, cues.length, analyzed, ensureAnalyzed]);

  // ── 세그먼트 탭(미분석 큐) → 팝오버 열기 + 분석 (word-span만; seek와 stopPropagation로 분리) ──
  const tapSegment = (idx, seg) => {
    // 같은 세그먼트 재탭이면 닫기(토글)
    setActiveTok((cur) =>
      cur && cur.idx === idx && cur.segStart === seg.start ? null : { idx, segStart: seg.start, segText: seg.text }
    );
    // 분석 실패했던 큐면 캐시 비우고 재시도, 아니면 최초 1회 분석
    if (analyzed[idx]?.status === 'error') {
      setAnalyzed((m) => { const n = { ...m }; delete n[idx]; return n; });
      ensureAnalyzed(idx);
    } else {
      ensureAnalyzed(idx);
    }
  };

  // ── 어절 단위 탭(분석 완료 큐) → 그 단위 팝오버 열기(토글) ──
  const tapUnit = (idx, unitIndex) => {
    setActiveTok((cur) =>
      cur && cur.idx === idx && cur.unitIndex === unitIndex ? null : { idx, unitIndex }
    );
  };

  // 바깥 탭 시 팝오버 닫기 (세그먼트·팝오버는 stopPropagation으로 유지 — 기존 activeWord 패턴)
  useEffect(() => {
    if (!activeTok) return;
    const onDoc = () => setActiveTok(null);
    window.addEventListener('click', onDoc);
    return () => window.removeEventListener('click', onDoc);
  }, [activeTok]);

  // ── 각 큐를 Intl.Segmenter로 즉시 분할 (의존성 0). 미지원이면 null → 통짜 텍스트 폴백 ──
  // loadedLangKey null(단어장 미지원 언어)이면 인라인 탭 비활성 → 분할도 생략.
  const segLocale = loadedLangKey ? LANG_CODE[loadedLangKey] : null;
  const segmentedCues = useMemo(() => {
    if (!segLocale) return null;
    return cues.map((c) => segmentWords(c.text, segLocale));
  }, [cues, segLocale]);

  // ── 분석 완료 큐를 어절 단위로 묶는다(형태소 → 학습 단위). idx → units 배열 ──
  const unitsByCue = useMemo(() => {
    const out = {};
    for (const [k, a] of Object.entries(analyzed)) {
      if (a?.status === 'done') out[k] = groupTokensToUnits(a.tokens);
    }
    return out;
  }, [analyzed]);

  // 현재 열린 팝오버가 가리키는 어절 단위를 해석한다(어절 탭이면 바로, 세그먼트 탭이면
  // 분석 완료 후 그 토큰이 속한 단위로 승격). 못 찾으면 null.
  const resolveActiveUnit = useCallback((at) => {
    if (!at) return null;
    const units = unitsByCue[at.idx];
    if (!units) return null;
    if (typeof at.unitIndex === 'number') {
      const u = units[at.unitIndex];
      return u ? { unit: u, unitIndex: at.unitIndex } : null;
    }
    const a = analyzed[at.idx];
    if (a?.status !== 'done') return null;
    const tk = matchTokenAt(a.tokens, cues[at.idx]?.text || '', at.segStart, at.segText);
    if (!tk) return null;
    const ui = units.findIndex((u) => u.tokens.includes(tk));
    return ui >= 0 ? { unit: units[ui], unitIndex: ui } : null;
  }, [unitsByCue, analyzed, cues]);

  // ── 문맥 해석(지연) — 팝오버가 단위로 확정되면 1회 호출, ctxMap 캐시 ──
  const fetchWordContext = useCallback(async (idx, unit, unitIndex) => {
    const key = `${idx}:${unitIndex}:${unit.surface}`;
    setCtxMap((m) => ({ ...m, [key]: { status: 'loading', text: '' } }));
    try {
      const res = await fetch('/api/media/word-context', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          sentence: cues[idx]?.text || '',
          surface: unit.surface,
          base: unit.base || unit.surface,
          language: loadedLangKey,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.context) throw new Error('no context');
      setCtxMap((m) => ({ ...m, [key]: { status: 'done', text: data.context } }));
    } catch {
      // 실패 시 3행만 조용히 생략 — error 상태로 두어 재호출은 막는다.
      setCtxMap((m) => ({ ...m, [key]: { status: 'error', text: '' } }));
    }
  }, [cues, loadedLangKey, authHeaders]);

  // 팝오버가 열려 단위로 확정될 때 문맥 해석을 딱 1회 로드(탭 시에만 — 호버는 비용 0).
  useEffect(() => {
    if (!activeTok) return;
    const resolved = resolveActiveUnit(activeTok);
    if (!resolved) return;
    const { unit, unitIndex } = resolved;
    const key = `${activeTok.idx}:${unitIndex}:${unit.surface}`;
    if (ctxMap[key] !== undefined) return; // 이미 로딩/완료/실패
    fetchWordContext(activeTok.idx, unit, unitIndex);
  }, [activeTok, resolveActiveUnit, ctxMap, fetchWordContext]);

  // ── 문장 번역(기능 1): 시작 직후 백그라운드로 40개씩 배치 순차 호출 → koMap 채움 ──
  // 스크립트 표시는 번역을 기다리지 않음. 실패 배치는 조용히 생략(빈 문자열).
  useEffect(() => {
    if (!started || cues.length === 0) return;
    let cancelled = false;
    const srcCode = LANG_CODE[loadedLangKey] || LANG_CODE[language] || '';
    (async () => {
      const headers = await authHeaders();
      const BATCH = 40;
      for (let i = 0; i < cues.length; i += BATCH) {
        if (cancelled) return;
        const slice = cues.slice(i, i + BATCH);
        try {
          const res = await fetch('/api/media/translate', {
            method: 'POST',
            headers,
            body: JSON.stringify({ videoId: videoId || null, lang: srcCode, texts: slice.map((c) => c.text) }),
          });
          if (!res.ok) continue;
          const data = await res.json();
          const arr = Array.isArray(data?.translations) ? data.translations : [];
          if (cancelled) return;
          setKoMap((prev) => {
            const next = { ...prev };
            arr.forEach((t, j) => { if (t) next[i + j] = t; });
            return next;
          });
        } catch { /* 실패 배치 조용히 생략 */ }
      }
    })();
    return () => { cancelled = true; };
    // videoId·cues가 확정된 시작 시점에 1회 — authHeaders/language는 그 시점 값 사용.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, cues, videoId]);

  // ── 어절 단위 저장 → 단어장 (ViewerPage와 동일 컬럼·onConflict) ──
  // 저장은 base(기본형) 우선: word_text=base로 통일해야 활용형(思います·届いたら)이
  // 각각 별도 등록되는 걸 막는다(onConflict user_id,word_text가 같은 어휘를 1회만 담음).
  // base가 없으면(영어 lemma 실패 등) surface로 폴백. furigana·source_sentence는 유지.
  const saveUnit = async (idx, unit) => {
    if (!user) { toast('로그인이 필요해요.', 'warning'); return; }
    const base = unit.base || unit.surface;
    const savedKey = `${idx}:${base}`;
    if (saved[savedKey]) return;
    try {
      const row = {
        user_id: user.id,
        word_text: base,                      // ← base 우선(활용형 중복 등록 방지)
        base_form: base,
        furigana: unit.furigana || '',
        meaning: unit.meaning || '',
        pos: unit.tokens?.[0]?.pos || '',      // 선두 내용어 품사
        next_review_at: new Date().toISOString(),
        language: loadedLangKey,
        source_sentence: cues[idx]?.text || null,
        source_material_id: null,
      };
      const { error } = await supabase
        .from('user_vocabulary')
        .upsert([row], { onConflict: 'user_id,word_text', ignoreDuplicates: true });
      if (error) throw error;
      // 성공(신규)이든 이미 있음(ignoreDuplicates)이든 조용히 ✓
      setSaved((m) => ({ ...m, [savedKey]: true }));
    } catch {
      toast('저장에 실패했어요. 잠시 후 다시 시도해주세요.', 'error');
    }
  };

  // ── 팝오버 (기존 재료 단어 팝오버 .study-wordpop 스타일) — 어절 단위 기준 ──
  // activeTok을 어절 단위로 해석: 성공하면 표면형·기본형 구분 + 문맥 해석(지연) 표시.
  // 미분석/미해석이면 로딩·실패·못 찾음 안내. 팝오버·버튼은 stopPropagation로 유지.
  const renderPopover = (idx) => {
    const stop = (e) => e.stopPropagation();
    const resolved = resolveActiveUnit(activeTok);

    if (!resolved) {
      const a = analyzed[idx];
      let inner;
      if (!a || a.status === 'loading') {
        inner = <span className="listen-tok__dots" style={{ fontSize: '0.85rem' }} />;
      } else if (a.status === 'error') {
        inner = <span style={{ color: 'var(--danger, #dc2626)' }}>분석 실패 — 다시 탭해 주세요</span>;
      } else {
        inner = <span style={{ color: 'var(--text-muted)' }}>뜻을 찾지 못했어요</span>;
      }
      return <span className="study-wordpop" onClick={stop}>{inner}</span>;
    }

    const { unit, unitIndex } = resolved;
    const surface = unit.surface;
    const base = unit.base || surface;
    const showBase = base && base !== surface;
    const ctx = ctxMap[`${idx}:${unitIndex}:${surface}`];
    const isSaved = saved[`${idx}:${base}`];

    return (
      <span className="study-wordpop" onClick={stop}>
        {/* 1행: 표면형(문장 속 형태) 크게 + 후리가나, surface≠base면 기본형 병기 */}
        <span
          lang={segLocale || undefined}
          style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}
        >
          {unit.furigana && (
            <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.72rem' }}>
              {unit.furigana}
            </span>
          )}
          <span style={{ fontWeight: 700, fontSize: '1.02rem' }}>{surface}</span>
          {showBase && (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 500 }}>
              기본형 {base}
            </span>
          )}
        </span>

        {/* 2행: 사전 뜻(즉시) */}
        <span style={{ color: 'var(--text-secondary)' }}>{unit.meaning || '뜻 정보 없음'}</span>

        {/* 3행: 문맥 해석(지연) — 로딩 "…", 실패 시 조용히 생략 */}
        {ctx?.status === 'loading' && (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>…</span>
        )}
        {ctx?.status === 'done' && ctx.text && (
          <span
            style={{
              color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.5,
              borderTop: '1px solid var(--border, rgba(128,128,128,0.2))', paddingTop: 5, marginTop: 1,
            }}
          >
            💡 {ctx.text}
          </span>
        )}

        <button
          type="button"
          onClick={(e) => { stop(e); saveUnit(idx, unit); }}
          style={{
            marginTop: 4, alignSelf: 'flex-start',
            fontSize: '0.76rem', padding: '3px 10px', borderRadius: 999, cursor: 'pointer',
            border: '1px solid var(--border, rgba(128,128,128,0.3))',
            background: isSaved ? 'var(--accent-subtle, rgba(99,102,241,0.12))' : 'transparent',
            color: isSaved ? 'var(--accent, #6366f1)' : 'var(--text-secondary)',
          }}
        >
          {isSaved ? '✓ 담김' : '+ 담기'}
        </button>
      </span>
    );
  };

  // ── 게이트 ──
  if (loading) return <div className="page-container"><Spinner /></div>;
  if (!user || !isAdmin) {
    return (
      <div className="page-container" style={{ textAlign: 'center', paddingTop: 80 }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔒</div>
        <h2 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>실험 기능이에요</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: '0.9rem' }}>
          관리자만 들어올 수 있는 실험실이에요.
        </p>
        <Link href="/home" className="btn btn--primary">홈으로</Link>
      </div>
    );
  }

  // ── 렌더 ──
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-header__title">🎧 듣고 읽기 <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>실험</span></h1>
        <p className="page-header__subtitle">YouTube 영상 + 내 자막으로 표현을 모아요</p>
      </div>

      {!started ? (
        // ── 입력 단계 ──
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 640 }}>
          {/* 공통: 언어 선택 (검색·직접 입력 모두 사용) */}
          <div className="form-field">
            <label className="form-label">언어</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {LANG_OPTIONS.map(l => (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => setLanguage(l.key)}
                  className={`tab-pills__item ${language === l.key ? 'tab-pills__item--primary' : ''}`}
                >
                  {l.flag} {l.name}
                </button>
              ))}
            </div>
          </div>

          {/* 탭 전환 */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setInputTab('search')}
              className={`tab-pills__item ${inputTab === 'search' ? 'tab-pills__item--primary' : ''}`}
            >
              🔎 영상 찾기
            </button>
            <button
              type="button"
              onClick={() => setInputTab('manual')}
              className={`tab-pills__item ${inputTab === 'manual' ? 'tab-pills__item--primary' : ''}`}
            >
              ✍️ 직접 입력
            </button>
          </div>

          {inputTab === 'search' ? (
            // ── 영상 찾기 ──
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '18px 20px' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  placeholder="검색어 · 영상 링크 · 채널 링크"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
                  style={{ flex: 1 }}
                />
                <Button onClick={runSearch} disabled={searching || !searchQuery.trim()}>
                  {searching ? '검색 중…' : '검색'}
                </Button>
              </div>

              {searchError && (
                <p style={{ fontSize: '0.82rem', color: 'var(--danger, #dc2626)' }}>{searchError}</p>
              )}

              {captionError && (
                <div style={{ fontSize: '0.82rem', color: 'var(--danger, #dc2626)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span>{captionError}</span>
                  {availableTracks && availableTracks.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {availableTracks.map((t) => (
                        <button
                          key={`${t.code}:${t.kind}`}
                          type="button"
                          onClick={() => pendingVideoId && loadVideo(pendingVideoId, t.code)}
                          className="tab-pills__item"
                        >
                          {t.name || t.code}{t.kind === 'asr' ? ' (자동)' : ''}
                        </button>
                      ))}
                    </div>
                  )}
                  <div>
                    <Button size="sm" variant="secondary" onClick={() => setInputTab('manual')}>
                      직접 붙여넣기로 전환
                    </Button>
                  </div>
                </div>
              )}

              {searchResults.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '52vh', overflowY: 'auto' }}>
                  {searchResults.map((v) => {
                    const busy = loadingVideoId === v.videoId;
                    // 요청 언어 자막이 확인된 경우에만 뱃지(미확인·9번째 이후는 불이익 아님).
                    const hasLangCaption =
                      Array.isArray(v.captionLangs) && v.captionLangs.includes(LANG_CODE[language]);
                    const langName = LANG_OPTIONS.find((l) => l.key === language)?.name || '';
                    // 서버가 임베드 불가로 확인한 영상(embeddable===false)은 골라도 플레이어에서
                    // 101/150로 막히므로 미리 흐리게 + 비활성 + 사유 표기(undefined=미확인은 기존대로).
                    const notEmbeddable = v.embeddable === false;
                    const disabled = !!loadingVideoId || notEmbeddable;
                    return (
                      <button
                        key={v.videoId}
                        type="button"
                        disabled={disabled}
                        onClick={() => loadVideo(v.videoId, LANG_CODE[language])}
                        title={notEmbeddable ? '이 영상은 외부 재생이 막혀 있어요' : undefined}
                        className="card"
                        style={{
                          display: 'flex', gap: 10, alignItems: 'center', textAlign: 'left',
                          padding: 8,
                          cursor: notEmbeddable ? 'not-allowed' : (loadingVideoId ? 'default' : 'pointer'),
                          opacity: notEmbeddable || (loadingVideoId && !busy) ? 0.5 : 1,
                        }}
                      >
                        {v.thumbnailUrl && (
                          <img
                            src={v.thumbnailUrl}
                            alt=""
                            style={{ width: 120, height: 68, objectFit: 'cover', borderRadius: 6, flexShrink: 0, background: '#000' }}
                          />
                        )}
                        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.35 }}>
                            {v.title || v.videoId}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {v.channel}
                            {v.durationSec != null ? ` · ${formatCueTime(v.durationSec)}` : ''}
                            {v.hasCaptions ? ' · 자막' : ''}
                          </span>
                          {hasLangCaption && (
                            <span
                              style={{
                                alignSelf: 'flex-start', marginTop: 2,
                                fontSize: '0.68rem', fontWeight: 600, lineHeight: 1.4,
                                padding: '1px 8px', borderRadius: 999,
                                background: 'var(--accent-subtle, rgba(99,102,241,0.12))',
                                color: 'var(--accent, #6366f1)',
                              }}
                            >
                              {langName} 자막
                            </span>
                          )}
                          {notEmbeddable && (
                            <span
                              style={{
                                alignSelf: 'flex-start', marginTop: 2,
                                fontSize: '0.68rem', fontWeight: 600, lineHeight: 1.4,
                                padding: '1px 8px', borderRadius: 999,
                                background: 'var(--danger-subtle, rgba(220,38,38,0.12))',
                                color: 'var(--danger, #dc2626)',
                              }}
                            >
                              🚫 외부 재생 불가
                            </span>
                          )}
                        </span>
                        {busy && <Spinner />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            // ── 직접 입력 (폴백) ──
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '18px 20px' }}>
              <div className="form-field">
                <label className="form-label">YouTube 주소</label>
                <input
                  className="form-input"
                  placeholder="https://www.youtube.com/watch?v=…  ·  youtu.be/…  ·  /shorts/…"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                />
              </div>

              <div className="form-field">
                <label className="form-label">자막 — .srt / .vtt 파일</label>
                <input type="file" accept=".srt,.vtt,text/vtt,application/x-subrip" onChange={handleFile} />
              </div>

              <div className="form-field">
                <label className="form-label">또는 텍스트 붙여넣기 (타임스탬프 없이 줄 단위로만 표시)</label>
                <textarea
                  className="form-input"
                  rows={5}
                  placeholder="자막 텍스트를 줄바꿈으로 붙여넣어 주세요"
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                />
                <div style={{ marginTop: 8 }}>
                  <Button size="sm" variant="secondary" onClick={applyPaste} disabled={!pasteText.trim()}>
                    텍스트 적용
                  </Button>
                </div>
              </div>

              {cues.length > 0 && (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  ✅ 자막 {cues.length}줄 준비됨 {timed ? '· 타임스탬프 싱크' : '· 싱크 없음(줄만 표시)'}
                </p>
              )}
              {inputError && (
                <p style={{ fontSize: '0.82rem', color: 'var(--danger, #dc2626)' }}>{inputError}</p>
              )}

              <div>
                <Button onClick={start}>시작</Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        // ── 플레이어 + 스크립트 ──
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {timed ? '재생하면 스크립트가 따라가요 · 줄을 탭하면 그 시점으로 이동' : '싱크 없는 텍스트 모드'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button type="button" className="study-textlink" onClick={toggleKo}>
                {showKo ? '번역 끄기' : '번역 켜기'}
              </button>
              <Button size="sm" variant="secondary" onClick={reset}>새로 시작</Button>
            </div>
          </div>

          {loadedLangKey == null && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              이 자막 언어는 단어장 미지원 — 시청·스크립트만
            </span>
          )}

          {playerError != null ? (
            <div className="card" style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
              <span>{describePlayerError(playerError).text}</span>
              {/* 회수 모드 — 재생만 막힌 것: 유튜브에서 보며 아래 스크립트로 학습(단어 저장 가능) */}
              {cues.length > 0 && (
                <span style={{ fontSize: '0.8rem' }}>
                  아래 스크립트로 학습은 계속할 수 있어요 — 영상은{' '}
                  <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noreferrer" className="study-textlink">
                    YouTube에서 열기 ↗
                  </a>
                </span>
              )}
              {describePlayerError(playerError).findAnother && (
                <Button size="sm" onClick={reset}>다른 영상 찾기</Button>
              )}
            </div>
          ) : (
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', background: '#000', borderRadius: 12, overflow: 'hidden' }}>
              <YouTube
                videoId={videoId}
                onReady={onReady}
                onStateChange={onStateChange}
                onError={onPlayerError}
                iframeClassName="listen-yt-iframe"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                opts={{ width: '100%', height: '100%', playerVars: { rel: 0, modestbranding: 1 } }}
              />
            </div>
          )}

          {/* 스크립트 큐 리스트 */}
          <div
            ref={listRef}
            style={{ maxHeight: '46vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 4 }}
          >
            {cues.map((cue, idx) => {
              const active = timed && idx === activeIdx;
              const segs = segmentedCues ? segmentedCues[idx] : null; // null=미지원→통짜 폴백
              const units = unitsByCue[idx];                          // 분석 완료면 어절 단위
              // 현재 열린 팝오버가 이 큐의 어느 단위를 가리키는지(어절·세그먼트 탭 모두 해석).
              const activeUnitIndex =
                activeTok && activeTok.idx === idx ? (resolveActiveUnit(activeTok)?.unitIndex ?? null) : null;
              const ko = showKo ? koMap[idx] : null;
              return (
                <div
                  key={idx}
                  ref={(el) => { cueRefs.current[idx] = el; }}
                  className="card"
                  style={{
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    borderColor: active ? 'var(--accent, #6366f1)' : undefined,
                    background: active ? 'var(--accent-subtle, rgba(99,102,241,0.10))' : undefined,
                    transition: 'background 0.2s, border-color 0.2s',
                  }}
                >
                  {/* 본문 — 빈 영역(단어 밖) 탭하면 seek. word-span은 stopPropagation로 seek와 분리. */}
                  <div
                    onClick={() => timed && seekToCue(cue)}
                    style={{
                      textAlign: 'left', color: 'var(--text-primary)',
                      cursor: timed ? 'pointer' : 'default',
                      fontSize: '0.95rem', lineHeight: 1.7,
                    }}
                    title={timed ? '이 시점으로 이동' : undefined}
                  >
                    {timed && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginRight: 8, fontFamily: 'monospace' }}>
                        {formatCueTime(cue.start)}
                      </span>
                    )}
                    {/* 인라인 탭 렌더:
                        1) 분석 완료 큐 → groupTokensToUnits 어절 단위 span(호버·탭이 어절 단위).
                        2) 미분석 큐 → Intl.Segmenter 세그먼트 span(임시, 저품질 인지 — 탭하면 분석).
                        3) 둘 다 없으면(미지원 언어/브라우저) 통짜 텍스트 폴백. */}
                    {Array.isArray(units)
                      ? layoutUnits(units, cue.text).map((piece, pIdx) => {
                          if (piece.type === 'gap') return <span key={pIdx}>{piece.text}</span>;
                          const tappable = /[\p{L}\p{N}]/u.test(piece.text);
                          if (!tappable) return <span key={pIdx}>{piece.text}</span>;
                          const isActive = activeUnitIndex === piece.unitIndex;
                          return (
                            <span
                              key={pIdx}
                              className={`listen-tok${isActive ? ' listen-tok--active' : ''}`}
                              onClick={(e) => { e.stopPropagation(); tapUnit(idx, piece.unitIndex); }}
                            >
                              {piece.text}
                              {isActive && renderPopover(idx)}
                            </span>
                          );
                        })
                      : Array.isArray(segs)
                      ? segs.map((seg, sIdx) => {
                          if (!seg.isWord) return <span key={sIdx}>{seg.text}</span>;
                          const isActive = activeTok && activeTok.idx === idx && activeTok.segStart === seg.start;
                          return (
                            <span
                              key={sIdx}
                              className={`listen-tok${isActive ? ' listen-tok--active' : ''}`}
                              onClick={(e) => { e.stopPropagation(); tapSegment(idx, seg); }}
                            >
                              {seg.text}
                              {isActive && renderPopover(idx)}
                            </span>
                          );
                        })
                      : cue.text}
                  </div>

                  {/* 번역 줄(기능 1) — 도착·토글 켜짐일 때만. 원문만 토큰화(이 줄은 분할 대상 아님). */}
                  {ko && <div className="listen-ko">{ko}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
