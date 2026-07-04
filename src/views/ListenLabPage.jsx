'use client';

// 🎧 듣고 읽기 (실험) — LingQ식 「영상 검색 → 자막 자동 로드 → 정독」 도구.
// 영상 검색·자막은 서버 라우트(/api/media/*)가 youtubei.js(비공식)로 가져온다
// — 비상업 개인용 전제의 오너 결정. 라이브러리 파손 시를 대비해 .srt/.vtt
// 업로드·텍스트 붙여넣기(직접 입력)가 상시 폴백. 재생 위치에 싱크된
// 스크립트에서 모르는 표현을 탭해 단어장(user_vocabulary)에 저장한다.
//
// 접근: 로그인 + profiles.role==='admin'만. admin 🧪 신기능 탭에서만 진입.
// 영속화 없음(실험) — 저장된 단어만 영구.

import { useState, useRef, useEffect, useCallback } from 'react';
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

const POLL_MS = 250;
const MANUAL_SCROLL_SUPPRESS_MS = 3000;

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
  const [playerError, setPlayerError] = useState(false);

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
  const [openCue, setOpenCue] = useState(-1);     // 토큰 패널이 열린 큐
  const [saved, setSaved] = useState({});         // `${idx}:${tokenId}` → true

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
        body: JSON.stringify({ query: q }),
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
        // 요청 언어 자막이 없음 — 가용 트랙에서 고르게
        setAvailableTracks(data.available);
        setPendingVideoId(vid);
        setCaptionError('이 언어 자막이 없어요. 아래에서 언어를 골라주세요.');
        return;
      }
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const cuesRaw = Array.isArray(data?.cues) ? data.cues : [];
      if (cuesRaw.length === 0) throw new Error('자막이 비어 있어요.');
      // 서버 큐 {from,to,text} → 앱 큐 {start,end,text,timed}
      const nextCues = cuesRaw.map((c) => ({ start: c.from, end: c.to, text: c.text, timed: true }));
      setCues(nextCues);
      setTimed(true);
      setVideoId(vid);
      setInputError('');
      setPlayerError(false);
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
    setInputError('');
    setPlayerError(false);
    setStarted(true);
  };

  const reset = () => {
    stopPoll();
    setStarted(false);
    setVideoId(null);
    setActiveIdx(-1);
    setCurrentTime(0);
    setOpenCue(-1);
    setPlayerError(false);
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
  const onPlayerError = () => { setPlayerError(true); };

  // ── 큐 탭 → 해당 시점 seekTo ──
  const seekToCue = (cue) => {
    const p = playerRef.current;
    if (!p || cue.start == null) return;
    try { p.seekTo(cue.start, true); p.playVideo?.(); } catch { /* 무해 */ }
  };

  // ── "단어 보기" → 그 줄 분석 (큐당 1회 캐시) ──
  const analyzeCue = useCallback(async (idx) => {
    setOpenCue((cur) => (cur === idx ? -1 : idx));   // 토글
    if (analyzed[idx]) return;                       // 이미 로딩/완료면 재호출 금지
    setAnalyzed((m) => ({ ...m, [idx]: { status: 'loading', tokens: [] } }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers,
        body: JSON.stringify({ lines: [cues[idx].text], language }),
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
  }, [analyzed, cues, language]);

  const retryCue = (idx) => {
    setAnalyzed((m) => { const n = { ...m }; delete n[idx]; return n; }); // 캐시 비우고
    analyzeCue(idx);
  };

  // ── 칩 탭 → 단어장 저장 (ViewerPage와 동일 컬럼·onConflict) ──
  const saveToken = async (idx, token) => {
    if (!user) { toast('로그인이 필요해요.', 'warning'); return; }
    const savedKey = `${idx}:${token.tokenId}`;
    if (saved[savedKey]) return;
    try {
      const row = {
        user_id: user.id,
        word_text: token.text,
        base_form: token.base_form || token.text,
        furigana: token.furigana || '',
        meaning: token.meaning || '',
        pos: token.pos || '',
        next_review_at: new Date().toISOString(),
        language,
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
                    return (
                      <button
                        key={v.videoId}
                        type="button"
                        disabled={!!loadingVideoId}
                        onClick={() => loadVideo(v.videoId, LANG_CODE[language])}
                        className="card"
                        style={{
                          display: 'flex', gap: 10, alignItems: 'center', textAlign: 'left',
                          padding: 8, cursor: loadingVideoId ? 'default' : 'pointer',
                          opacity: loadingVideoId && !busy ? 0.5 : 1,
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
            <Button size="sm" variant="secondary" onClick={reset}>새로 시작</Button>
          </div>

          {playerError ? (
            <div className="card" style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
              영상을 불러오지 못했어요. YouTube 주소를 다시 확인해주세요.
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
              const a = analyzed[idx];
              const isOpen = openCue === idx;
              return (
                <div
                  key={idx}
                  ref={(el) => { cueRefs.current[idx] = el; }}
                  className="card"
                  style={{
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    borderColor: active ? 'var(--accent, #6366f1)' : undefined,
                    background: active ? 'var(--accent-subtle, rgba(99,102,241,0.10))' : undefined,
                    transition: 'background 0.2s, border-color 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    {/* 본문 — 탭하면 seek (타임드 모드만) */}
                    <button
                      type="button"
                      onClick={() => timed && seekToCue(cue)}
                      style={{
                        flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none',
                        padding: 0, cursor: timed ? 'pointer' : 'default', color: 'var(--text-primary)',
                        fontSize: '0.95rem', lineHeight: 1.6,
                      }}
                      title={timed ? '이 시점으로 이동' : undefined}
                    >
                      {timed && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginRight: 8, fontFamily: 'monospace' }}>
                          {formatCueTime(cue.start)}
                        </span>
                      )}
                      {cue.text}
                    </button>

                    {/* 단어 보기 — seek와 분리된 소형 버튼 (탭 충돌 방지) */}
                    <button
                      type="button"
                      onClick={() => analyzeCue(idx)}
                      style={{
                        flexShrink: 0, fontSize: '0.72rem', padding: '4px 8px', borderRadius: 6,
                        border: '1px solid var(--border, rgba(128,128,128,0.3))',
                        background: isOpen ? 'var(--accent, #6366f1)' : 'transparent',
                        color: isOpen ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      📖 단어
                    </button>
                  </div>

                  {/* 토큰 패널 */}
                  {isOpen && (
                    <div style={{ borderTop: '1px solid var(--border, rgba(128,128,128,0.2))', paddingTop: 8 }}>
                      {a?.status === 'loading' && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>분석 중…</span>
                      )}
                      {a?.status === 'error' && (
                        <button
                          type="button"
                          onClick={() => retryCue(idx)}
                          style={{ fontSize: '0.8rem', color: 'var(--danger, #dc2626)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                          분석 실패 — 다시 시도
                        </button>
                      )}
                      {a?.status === 'done' && (
                        a.tokens.length === 0 ? (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>저장할 표현이 없어요.</span>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {a.tokens.map((tk) => {
                              const isSaved = saved[`${idx}:${tk.tokenId}`];
                              return (
                                <button
                                  key={tk.tokenId}
                                  type="button"
                                  onClick={() => saveToken(idx, tk)}
                                  title={tk.meaning || undefined}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    padding: '4px 10px', borderRadius: 999, cursor: 'pointer',
                                    border: '1px solid var(--border, rgba(128,128,128,0.3))',
                                    background: isSaved ? 'var(--accent-subtle, rgba(99,102,241,0.12))' : 'var(--bg-subtle, rgba(128,128,128,0.06))',
                                    fontSize: '0.85rem', color: 'var(--text-primary)',
                                  }}
                                >
                                  <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1 }}>
                                    {tk.furigana && <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{tk.furigana}</span>}
                                    <span>{tk.text}</span>
                                  </span>
                                  {tk.meaning && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>· {tk.meaning}</span>}
                                  {isSaved && <span style={{ color: 'var(--accent, #6366f1)' }}>✓</span>}
                                </button>
                              );
                            })}
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
