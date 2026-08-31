'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { parseTitle } from '../lib/seriesMeta';
import { materialFit, fitBand, sortByFit, bookFit, FIT_MIN_TYPES } from '../lib/materialFit';
import { fetchKnownWords, mergeKnownIntoIndex } from '../lib/knownWords';
import { groupByBook } from '../lib/bookMeta';
import { useGroupReadIds } from '../lib/useGroupReadIds';
import { JP_LEVELS, EN_LEVELS, ZH_LEVELS, langNameKo } from '../lib/constants';
import ConfirmModal from '../components/ConfirmModal';
import { CardGridSkeleton } from '../components/Skeleton';


async function fetchTodaySuggestions() {
  const res = await fetch('/api/suggestions/today');
  if (!res.ok) return [];
  return res.json();
}

function SuggestionCard({ suggestion: s, router }) {
  const hasTranscript = !!s.transcript;
  const isReady = !!s.material_id; // 이미 분석된 자료

  function handleStudy() {
    if (isReady) {
      router.push(`/viewer/${s.material_id}`);
    } else {
      router.push(`/materials/add?suggestion=${s.id}`);
    }
  }

  return (
    <div className="suggestion-card">
      {s.thumbnail_url && (
        <div className="suggestion-card__thumb-wrap">
          <img src={s.thumbnail_url} alt={s.title} className="suggestion-card__thumb" />
        </div>
      )}
      <div className="suggestion-card__body">
        <div className="suggestion-card__meta">
          <span className="card__flag">{s.language === 'English' ? '영어' : '일본어'}</span>
          {s.level && <span className="tag">{s.level}</span>}
          <span className="suggestion-card__source">{s.channel_name}</span>
          {isReady && <span className="suggestion-card__ready">✓ 바로 읽기</span>}
        </div>
        <h3 className="suggestion-card__title">{s.title}</h3>
        <div className="suggestion-card__actions">
          <button
            className="btn btn--primary btn--sm"
            disabled={!hasTranscript}
            title={hasTranscript ? '' : '내용을 가져올 수 없습니다'}
            onClick={handleStudy}
          >
            {isReady ? '바로 읽기' : '공부하기'}
          </button>
          {!hasTranscript && (
            <span className="suggestion-card__no-transcript">자막 없음</span>
          )}
        </div>
      </div>
    </div>
  );
}

async function fetchMaterials({ tab, userId, langFilter, levelFilter, searchQuery }) {
  let query = supabase
    .from('reading_materials')
    .select('id, title, created_at, visibility, owner_id, processed_json')
    .order('created_at', { ascending: false });

  // 자료실은 현지 언어 콘텐츠만 — 시리즈 패턴 [* #N] 자료는 /lessons로 분리
  query = query.not('title', 'ilike', '[%#%]%');

  if (tab === 'public') {
    query = query.eq('visibility', 'public');
  } else {
    if (!userId) return [];
    query = query.eq('visibility', 'private').eq('owner_id', userId);
  }

  if (searchQuery) {
    query = query.ilike('title', `%${searchQuery}%`);
  }
  if (langFilter !== 'all') {
    query = query.eq('processed_json->metadata->>language', langFilter);
  }
  if (levelFilter !== 'all') {
    query = query.eq('processed_json->metadata->>level', levelFilter);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

const PAGE_SIZE = 12;

const LANG_FILTERS = [
  { key: 'all',      label: '전체' },
  { key: 'Japanese', label: '일본어' },
  { key: 'English',  label: '영어' },
  { key: 'Chinese',  label: '중국어' },
];


// 레벨 순서 정의 (낮을수록 쉬움)
const LEVEL_ORDER = {
  'N5 기초': 0, 'N4 기본': 1, 'N3 중급': 2, 'N2 상급': 3, 'N1 심화': 4,
  'A1 기초': 0, 'A2 초급': 1, 'B1 중급': 2, 'B2 상급': 3, 'C1 고급': 4, 'C2 마스터': 5,
};

// 유저 레벨 ±1 범위의 추천만 표시
function filterSuggestionsByProfile(suggestions, profile) {
  if (!profile || !suggestions.length) return suggestions;
  return suggestions.filter(s => {
    if (!profile.learning_language?.includes(s.language)) return false;
    if (!s.level) return true;
    const userLevel = s.language === 'Japanese'
      ? profile.learning_level_japanese
      : profile.learning_level_english;
    if (!userLevel) return true;
    const diff = Math.abs((LEVEL_ORDER[s.level] ?? 99) - (LEVEL_ORDER[userLevel] ?? 99));
    return diff <= 1;
  });
}

export default function MaterialsPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error, count } = await supabase.from('reading_materials').delete({ count: 'exact' }).eq('id', id);
      if (error) throw error;
      if (count === 0) throw new Error('삭제 권한이 없거나 이미 삭제된 자료입니다.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      toast('자료를 삭제했습니다.', 'success');
    },
    onError: (err) => toast('삭제 실패: ' + err.message, 'error'),
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ id, newVisibility }) => {
      const { error } = await supabase
        .from('reading_materials')
        .update({ visibility: newVisibility })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { newVisibility }) => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      toast(newVisibility === 'public' ? '공용으로 공개했습니다.' : '비공개로 전환했습니다.', 'success');
    },
    onError: (err) => toast('변경 실패: ' + err.message, 'error'),
  });
  const searchParams = useSearchParams();
  const [tab, setTab] = useState('public');
  const [testScores, setTestScores] = useState({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const result = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('reading_test_history:')) {
          const id = key.slice('reading_test_history:'.length);
          const arr = JSON.parse(localStorage.getItem(key) || '[]');
          if (arr.length === 0) continue;
          const best = arr.reduce((b, h) => h.score > b.score ? h : b);
          result[id] = best;
        }
      }
    } catch {}
    setTestScores(result);
  }, []);

  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [langFilter, setLangFilter] = useState(searchParams.get('lang') || 'all');
  const [levelFilter, setLevelFilter] = useState(searchParams.get('level') || 'all');
  const [sortBy, setSortBy] = useState('newest'); // newest | level | title | fit
  const [unreadOnly, setUnreadOnly] = useState(false); // v2-F R3 — 고르기 좁히기
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [confirmAction, setConfirmAction] = useState(null);

  // 검색어 debounce (300ms) — 매 키입력마다 DB 요청 방지
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // 필터 바뀌면 페이지 리셋
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [tab, searchQuery, langFilter, levelFilter]);

  const { data: suggestions = [] } = useQuery({
    queryKey: ['suggestions-today'],
    queryFn: fetchTodaySuggestions,
    staleTime: 60 * 60 * 1000, // 1시간 캐시
  });

  const { data: pdfs = [] } = useQuery({
    queryKey: ['my-pdfs', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uploaded_pdfs')
        .select('id, title, page_count, created_at, thumbnail_path')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && tab === 'pdf',
    staleTime: 1000 * 60,
  });

  const { data: progressMap = { completed: new Set(), inProgress: new Map() } } = useQuery({
    queryKey: ['reading-progress-list', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reading_progress')
        .select('material_id, is_completed, last_token_idx')
        .eq('user_id', user.id);
      if (error) throw error;
      const completed = new Set();
      const inProgress = new Map();
      for (const r of (data || [])) {
        if (r.is_completed) completed.add(r.material_id);
        else if (r.last_token_idx > 0) inProgress.set(r.material_id, r.last_token_idx);
      }
      return { completed, inProgress };
    },
    enabled: !!user,
    staleTime: 1000 * 60,
  });
  const completedIds = progressMap.completed;

  // 내 그룹들이 이번 주 같이 읽는 자료 (v2-F R3) — 홈이 쓰는 캐시를 그대로 타 추가 왕복 0.
  const groupReadIds = useGroupReadIds();

  // 복습 대기 중인 단어 (Reading-as-Review용)
  const { data: dueVocabIndex } = useQuery({
    queryKey: ['due-vocab-index', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_vocabulary')
        .select('word_text, base_form, next_review_at')
        .eq('user_id', user.id)
        .lte('next_review_at', new Date().toISOString());
      if (error) throw error;
      const surfaces = new Set();
      const bases = new Set();
      for (const v of data || []) {
        if (v.word_text) surfaces.add(v.word_text);
        if (v.base_form) bases.add(v.base_form);
      }
      return { surfaces, bases };
    },
    enabled: !!user,
    staleTime: 1000 * 60,
  });

  // 🎯 자료 맞춤도(rfc-material-fit R2) — 담김 **전체** 인덱스(위 due 인덱스와 별개: 커버리지는
  // 복습 대기 여부와 무관하게 "담아 본 말"인지가 기준). 게스트 무조회 — 줄·정렬 자체가 없다.
  const { data: savedVocabIndex } = useQuery({
    queryKey: ['saved-vocab-index', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_vocabulary')
        .select('word_text, base_form')
        .eq('user_id', user.id);
      if (error) throw error;
      const surfaces = new Set();
      const bases = new Set();
      for (const v of data || []) {
        if (v.word_text) surfaces.add(v.word_text);
        if (v.base_form) bases.add(v.base_form);
      }
      return { surfaces, bases };
    },
    enabled: !!user,
    staleTime: 1000 * 60,
  });

  // '이미 앎' 표기(목업 ⑤ — #1077-14): 커버리지 정밀화용 합집합 재료. 실패는 빈 배열(무해성).
  const { data: knownRows } = useQuery({
    queryKey: ['known-words-all', user?.id],
    queryFn: () => fetchKnownWords(user.id),
    enabled: !!user,
    staleTime: 1000 * 60,
  });

  function countDueInMaterial(material) {
    if (!dueVocabIndex || !material?.processed_json?.dictionary) return 0;
    const dict = material.processed_json.dictionary;
    const seen = new Set();
    let count = 0;
    for (const tokenId of material.processed_json.sequence || []) {
      const t = dict[tokenId];
      if (!t || t.pos === '개행') continue;
      const key = t.base_form || t.text;
      if (seen.has(key)) continue;
      if (dueVocabIndex.surfaces.has(t.text) || (t.base_form && dueVocabIndex.bases.has(t.base_form))) {
        seen.add(key);
        count++;
      }
    }
    return count;
  }

  const { data: materials = [], isLoading, error: materialsError, refetch: refetchMaterials } = useQuery({
    queryKey: ['materials', tab, user?.id, langFilter, levelFilter, searchQuery],
    queryFn: () => fetchMaterials({ tab, userId: user?.id, langFilter, levelFilter, searchQuery }),
    refetchInterval: (query) => {
      const hasAnalyzing = query.state.data?.some(
        m => m.processed_json?.status === 'analyzing'
      );
      return hasAnalyzing ? 5000 : false;
    },
  });

  const levelOptions = langFilter === 'Japanese' ? JP_LEVELS
    : langFilter === 'English' ? EN_LEVELS
    : langFilter === 'Chinese' ? ZH_LEVELS
    : [...JP_LEVELS, ...EN_LEVELS, ...ZH_LEVELS];

  // 커버리지 대조 인덱스 — 자료 카드(fitById)와 책 카드(bookFit)가 **같은 것**을 쓴다.
  // '이미 앎' 표기는 여기서 합집합으로 합류한다(엔진 시그니처 무변경 — 목업 ⑤ 정밀화).
  // 병합을 두 곳에서 하면 '이미 앎' 반영이 한쪽만 되는 조용한 어긋남이 생긴다.
  const savedFitIndex = useMemo(() => {
    if (!savedVocabIndex) return null;
    return knownRows?.length ? mergeKnownIntoIndex(savedVocabIndex, knownRows) : savedVocabIndex;
  }, [savedVocabIndex, knownRows]);

  // 자료별 맞춤도 — 분석 완료 자료만, 담김 인덱스가 있을 때만(게스트 빈 맵 → 표시·정렬 무효과).
  const fitById = useMemo(() => {
    const map = new Map();
    const index = savedFitIndex;
    if (!index) return map;
    for (const m of materials) {
      if (m.processed_json?.status !== 'completed') continue;
      const fit = materialFit(m.processed_json, index);
      map.set(m.id, { ...fit, band: fitBand(fit.coverage, fit.total) });
    }
    return map;
  }, [materials, savedFitIndex]);

  const sorted = (() => {
    if (sortBy === 'newest') return materials;
    if (sortBy === 'fit') return sortByFit(materials, (m) => fitById.get(m.id)?.band ?? null);
    const arr = [...materials];
    if (sortBy === 'level') {
      arr.sort((a, b) => {
        const la = a.processed_json?.metadata?.level;
        const lb = b.processed_json?.metadata?.level;
        const oa = la in LEVEL_ORDER ? LEVEL_ORDER[la] : 99;
        const ob = lb in LEVEL_ORDER ? LEVEL_ORDER[lb] : 99;
        if (oa !== ob) return oa - ob;
        // 같은 레벨: 시리즈 → 번호 → 최신순 (학습 경로 자연 정렬)
        const ma = parseTitle(a.title);
        const mb = parseTitle(b.title);
        const sa = ma.series || '￿'; // 시리즈 없는 자료는 뒤로
        const sb = mb.series || '￿';
        if (sa !== sb) return sa.localeCompare(sb);
        if (ma.num != null && mb.num != null) return ma.num - mb.num;
        if (ma.num != null) return -1;
        if (mb.num != null) return 1;
        return new Date(b.created_at) - new Date(a.created_at);
      });
    } else if (sortBy === 'title') {
      arr.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ko'));
    }
    return arr;
  })();

  // 「안 읽은 것만」(v2-F R3) — 고르기를 좁히는 필터. **완독한 것만** 걷어낸다:
  // 읽는 중(진도 %)은 남겨야 이어읽기가 목록에서 사라지지 않는다.
  // completedIds는 위에서 이미 로드된 인덱스라 추가 조회 0. 게스트는 칩 자체가 없다.
  const filtered = unreadOnly ? sorted.filter((m) => !completedIds.has(m.id)) : sorted;

  return (
    <div className="page-container">
      <div className="page-header page-header--row">
        <div>
          <h1 className="page-header__title">자료실</h1>
          <p className="page-header__subtitle">현지 언어 콘텐츠 (기사·이야기·PDF). 패턴 학습은 <Link href="/lessons" style={{ color: 'var(--accent-text)' }}>교재</Link>에서</p>
        </div>
        {/* 추가 입구는 하나 — 클립보드 붙여넣기는 추가 화면 안에 있다.
            빠른 분석은 추가가 아니라 무저장 해부(목업 ④)라 별도 입구가 원칙과 안 충돌한다. */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <Link href="/quick" className="btn btn--ghost btn--md">⚡ 빠른 분석</Link>
          <Link href="/materials/add" className="btn btn--primary btn--md">
            새 자료 추가
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="filter-row">
        <div className="search-wrap">
          <span className="search-wrap__icon" />
          <input
            type="text"
            placeholder="제목으로 자료 찾기..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="search-wrap__input"
          />
        </div>

        <div className="tab-pills">
          <button onClick={() => setTab('public')}
            aria-pressed={tab === 'public'}
            className={`tab-pills__item ${tab === 'public' ? 'tab-pills__item--accent' : ''}`}>
            공용
          </button>
          <button onClick={() => setTab('private')}
            aria-pressed={tab === 'private'}
            className={`tab-pills__item ${tab === 'private' ? 'tab-pills__item--primary' : ''}`}>
            내 자료
          </button>
          {user && (
            <button onClick={() => setTab('pdf')}
            aria-pressed={tab === 'pdf'}
              className={`tab-pills__item ${tab === 'pdf' ? 'tab-pills__item--primary' : ''}`}>
              PDF
            </button>
          )}
        </div>
      </div>

      {/* Language + Level filter — PDF 탭에서는 숨김 */}
      {tab !== 'pdf' && <div className="materials-filters">
        <div className="chip-group">
          {LANG_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => { setLangFilter(f.key); setLevelFilter('all'); }}
              aria-pressed={langFilter === f.key}
              className={`chip ${langFilter === f.key ? 'chip--active' : ''}`}
            >
              {f.label}
            </button>
          ))}
          {/* 「안 읽은 것만」(v2-F R3) — 완독분만 걷어낸다(읽는 중은 남긴다).
              게스트는 진도가 없어 칩 자체를 두지 않는다. */}
          {user && (
            <button
              onClick={() => setUnreadOnly(v => !v)}
              aria-pressed={unreadOnly}
              className={`chip ${unreadOnly ? 'chip--active' : ''}`}
              title="완독한 자료를 목록에서 숨깁니다"
            >
              안 읽은 것만
            </button>
          )}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="chip chip--select"
            aria-label="정렬"
            style={{ marginLeft: 'auto' }}
          >
            <option value="newest">최신순</option>
            {user && <option value="fit">내 수준 맞춤</option>}
            <option value="level">쉬운순</option>
            <option value="title">제목순</option>
          </select>
        </div>

        {langFilter !== 'all' && (
          <div className="chip-group">
            <button
              onClick={() => setLevelFilter('all')}
              aria-pressed={levelFilter === 'all'}
              className={`chip ${levelFilter === 'all' ? 'chip--active' : ''}`}
            >
              전체 난이도
            </button>
            {levelOptions.map(lvl => (
              <button
                key={lvl}
                onClick={() => setLevelFilter(lvl)}
                aria-pressed={levelFilter === lvl}
                className={`chip ${levelFilter === lvl ? 'chip--active' : ''}`}
              >
                {lvl}
              </button>
            ))}
          </div>
        )}
      </div>}

      {/* PDF 탭 */}
      {tab === 'pdf' ? (
        pdfs.length > 0 ? (
          <div className="feature-grid">
            {pdfs.map(pdf => (
              <Link key={pdf.id} href={`/pdf/${pdf.id}`} className="card card--clickable" style={{ padding: 16, textDecoration: 'none', color: 'inherit' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: '2rem' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pdf.title}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {pdf.page_count}페이지 · {new Date(pdf.created_at).toLocaleDateString('ko-KR')}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <p>업로드된 PDF가 없습니다.</p>
            <Link href="/materials/add" className="btn btn--primary btn--sm" style={{ marginTop: 12 }}>PDF 업로드하기</Link>
          </div>
        )
      ) : isLoading ? (
        <CardGridSkeleton />
      ) : materialsError ? (
        <div className="empty-state">
          <div className="empty-state__icon">×</div>
          <p className="empty-state__msg">자료 목록을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.</p>
          <button type="button" className="btn btn--primary btn--md" onClick={() => refetchMaterials()}>다시 시도</button>
        </div>
      ) : filtered.length > 0 ? (
        <>
        <div className="feature-grid">
          {(() => {
            // 시리즈별 총 편수 사전 계산 (자료 카드에 #5/23 표시용)
            const seriesTotals = new Map();
            for (const x of materials) {
              const xm = parseTitle(x.title);
              if (!xm.level || !xm.series || xm.num == null) continue;
              const k = `${xm.level}|${xm.series}`;
              seriesTotals.set(k, (seriesTotals.get(k) || 0) + 1);
            }
            // 책 묶음(P1) — metadata.book이 있는 자료는 책 카드 하나로 묶어 챕터 목록을 보여준다
            const { books, singles } = groupByBook(filtered);
            const bookCards = books.map((b) => {
              const analyzed = b.chapters.filter((c) => ['completed', 'partial'].includes(c.processed_json?.status)).length;
              const readDone = b.chapters.filter((c) => completedIds.has(c.id)).length;
              // 책 단위 커버리지(R2) — 챕터 types 합집합. 어휘 교재의 진짜 지표는 챕터별 배지가
              // 아니라 "책 전체 단어 중 몇 개를 아는가"다. 표본 미달·게스트·미분석은 무표기.
              const bf = savedFitIndex ? bookFit(b.chapters, savedFitIndex) : null;
              const showBookFit = bf && bf.coverage != null && bf.total >= FIT_MIN_TYPES;
              return (
                <details key={b.key} className="card book-card" style={{ gridColumn: '1 / -1', padding: '14px 18px' }}>
                  <summary style={{ cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: '1rem' }}>📖 {b.title || '제목 없는 책'}</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      챕터 {b.chapters.length}개 · 분석 {analyzed}/{b.chapters.length} · 읽음 {readDone}/{b.chapters.length}
                    </span>
                    {showBookFit && (
                      <span style={{ flexBasis: '100%', fontSize: '0.8rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                        {bf.analyzed < bf.chapters && `분석한 ${bf.analyzed}과 기준 · `}
                        {bf.total.toLocaleString()}단어 중{' '}
                        <strong style={{ color: 'var(--accent-text)' }}>{Math.round(bf.coverage * 100)}% 앎</strong>
                        {' '}· 새 단어 {bf.unknown.toLocaleString()}개
                      </span>
                    )}
                  </summary>
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {b.chapters.map((c) => {
                      const st = c.processed_json?.status || 'idle';
                      const chTitle = c.title.includes(' — ') ? c.title.split(' — ').slice(1).join(' — ') : c.title;
                      return (
                        <div key={c.id} onClick={() => router.push(`/viewer/${c.id}`)}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', cursor: 'pointer' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', width: 24, textAlign: 'right', flexShrink: 0 }}>{c._bookOrder}</span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chTitle}</span>
                          {completedIds.has(c.id) && <span style={{ fontSize: '0.72rem', color: 'var(--primary-light)', flexShrink: 0 }}>✓ 읽음</span>}
                          <span style={{ fontSize: '0.72rem', flexShrink: 0, color: st === 'pending' ? 'var(--text-muted)' : st === 'failed' ? 'var(--danger)' : st === 'analyzing' ? 'var(--warning)' : 'var(--primary-light)' }}>
                            {st === 'pending' ? '분석 전' : st === 'analyzing' ? '분석 중' : st === 'failed' ? '실패' : st === 'partial' ? '일부 완료' : '완료'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </details>
              );
            });
            return [...bookCards, ...singles.slice(0, visibleCount).map(m => {
            const status = m.processed_json?.status || 'idle';
            const metadata = m.processed_json?.metadata || {};
            const language = metadata.language || (m.title.match(/[a-zA-Z]/) ? 'English' : 'Japanese');
            const level = metadata.level;
            const isDone = status === 'completed';
            const isCompleted = completedIds.has(m.id);
            const dueCount = isDone ? countDueInMaterial(m) : 0;
            const titleMeta = parseTitle(m.title);
            const seriesTotal = (titleMeta.level && titleMeta.series)
              ? seriesTotals.get(`${titleMeta.level}|${titleMeta.series}`) || 0
              : 0;
            const seriesPosition = (titleMeta.num != null && seriesTotal > 0)
              ? `${titleMeta.num}/${seriesTotal}`
              : null;

            const previewText = (() => {
              const dict = m.processed_json?.dictionary || {};
              const seq = m.processed_json?.sequence || [];
              if (seq.length === 0) return '';
              return seq.slice(0, 40).map(id => dict[id]?.text || '').filter(Boolean).join('').slice(0, 120);
            })();
            return (
              <div
                key={m.id}
                className="card card--clickable"
                onClick={() => router.push(`/viewer/${m.id}`)}
                title={previewText || undefined}
              >
                <div>
                  <div className="card__row card__row--between">
                    <div className="card__row card__row--gap">
                      <span className="card__flag">{langNameKo(language)}</span>
                      {level && <span className="tag">{level}</span>}
                      {seriesPosition && (
                        <span className="tag" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }} title={`${titleMeta.series} 시리즈`}>
                          {seriesPosition}
                        </span>
                      )}
                      {dueCount > 0 && (
                        <span
                          className="tag"
                          style={{
                            background: 'rgba(212,150,42,0.15)',
                            color: 'var(--warning)',
                            fontWeight: 700,
                          }}
                          title="이 자료를 읽으면 복습 처리됨"
                        >
                          {dueCount} 복습
                        </span>
                      )}
                      {/* 우리 그룹이 이번 주 읽는 자료 (v2-F R3) — 고르기 신호.
                          무그룹·게스트는 빈 Set이라 자연히 안 뜬다.
                          렌더 실측(320·390·768px): 가로 넘침 0. 320px에서 복습+같이읽기+완독이
                          **동시에** 붙는 최악 조합일 때만 태그 줄이 2→3줄이 된다 — 그 조합은
                          드물고(완독이면 「안 읽은 것만」에서 숨겨진다) 라벨을 줄이면 뜻이
                          흐려져 그대로 둔다. 줄인 게 아니라 재고 끝에 남긴 것이다. */}
                      {groupReadIds.has(m.id) && (
                        <span
                          className="tag"
                          style={{
                            background: 'color-mix(in srgb, var(--primary) 14%, transparent)',
                            color: 'var(--primary-light)',
                            fontWeight: 600,
                          }}
                          title="우리 그룹의 이번 주 같이 읽기"
                        >
                          같이 읽기
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {testScores[String(m.id)] && (
                        <span className="badge" style={{ background: 'color-mix(in srgb, var(--warning) 12%, transparent)', color: 'var(--warning)', fontWeight: 600 }} title="리딩 테스트 최고 점수">
                          {testScores[String(m.id)].score}/{testScores[String(m.id)].total}
                        </span>
                      )}
                      {isCompleted ? (
                        <span className="badge" style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent-text)', fontWeight: 600 }}>
                          ✓ 완독
                        </span>
                      ) : (() => {
                        const lastIdx = progressMap.inProgress.get(m.id);
                        const total = m.processed_json?.sequence?.length || 0;
                        if (lastIdx && total > 0) {
                          const pct = Math.round((lastIdx / total) * 100);
                          return (
                            <span className="badge" style={{ background: 'var(--bg-secondary)', color: 'var(--primary-light)', fontWeight: 600 }} title="이어서 읽기">
                              {pct}%
                            </span>
                          );
                        }
                        if (!isDone) {
                          return (
                            <span className="badge" style={{
                              background: status === 'analyzing' ? 'var(--primary-glow)' : 'var(--bg-secondary)',
                              color: status === 'analyzing' ? 'var(--primary-light)' : 'var(--text-muted)',
                            }}>
                              {status === 'analyzing' ? '분석 중...' : '대기 중'}
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                  <h3 className="card__title">
                    <Link
                      href={`/viewer/${m.id}`}
                      style={{ color: 'inherit', textDecoration: 'none' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {m.title}
                    </Link>
                  </h3>
                  {/* 🎯 맞춤도 줄(rfc-material-fit 목업 A) — 게스트·미계산은 무표기(0 무표기 결) */}
                  {(() => {
                    const fit = fitById.get(m.id);
                    if (!fit || fit.coverage == null) return null;
                    return (
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '6px 0 0' }}>
                        아는 말 {Math.round(fit.coverage * 100)}% · 새 단어 {fit.unknown}
                        {fit.band === 'fit' && (
                          <span style={{ marginLeft: 8, color: 'var(--accent-text)', fontWeight: 600 }}>
                            지금 읽기 좋아요
                          </span>
                        )}
                      </p>
                    );
                  })()}
                </div>
                <div className="card__footer">
                  <span>
                    {new Date(m.created_at).toLocaleDateString('ko-KR')}
                    {(() => {
                      const tokens = m.processed_json?.sequence?.length || 0;
                      if (tokens < 50) return null;
                      const min = Math.max(1, Math.round(tokens / 200));
                      return <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>· {min}분</span>;
                    })()}
                  </span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {m.owner_id === user?.id ? (
                      <button
                        className="btn btn--ghost btn--sm"
                        style={{ fontSize: '0.75rem', padding: '5px 10px' }}
                        disabled={toggleVisibilityMutation.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleVisibilityMutation.mutate({
                            id: m.id,
                            newVisibility: m.visibility === 'public' ? 'private' : 'public',
                          });
                        }}
                      >
                        {m.visibility === 'public' ? '비공개로' : '공개로'}
                      </button>
                    ) : (
                      <span>{tab === 'public' ? '공용' : '비공개'}</span>
                    )}
                    {m.owner_id === user?.id && (
                      <button
                        className="btn btn--ghost btn--sm"
                        style={{ color: 'var(--danger)', padding: '5px 10px', fontSize: '0.75rem' }}
                        disabled={deleteMutation.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmAction({
                            message: `"${m.title}" 자료를 삭제하시겠습니까?`,
                            onConfirm: () => { deleteMutation.mutate(m.id); setConfirmAction(null); },
                          });
                        }}
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
            })];
          })()}
        </div>
        {visibleCount < filtered.length && (
          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <button
              onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
              className="btn btn--secondary btn--md"
            >
              더 보기 ({filtered.length - visibleCount}개 남음)
            </button>
          </div>
        )}
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-state__icon" />
          <p className="empty-state__msg">
            {searchQuery || langFilter !== 'all' || levelFilter !== 'all'
              ? '조건에 맞는 자료가 없습니다.'
              : !user
                ? '자료는 계정에 저장돼요.\n로그인하면 텍스트를 올려 해부하고 단어장에 모을 수 있어요.'
                : tab === 'public'
                  ? '아직 공유된 공용 자료가 없습니다.'
                  : '아직 보관된 개인 자료가 없습니다.'}
          </p>
          {/* 게스트에게 빈 목록만 보여 주지 않는다 — 왜 비어 있는지와 다음 행동을 함께 준다. */}
          {!user && !(searchQuery || langFilter !== 'all' || levelFilter !== 'all') ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <Link href="/auth" className="btn btn--primary btn--md">로그인하고 자료 올리기 →</Link>
              <Link href="/lessons" className="empty-state__link">로그인 없이 교재부터 보기 →</Link>
            </div>
          ) : (searchQuery || langFilter !== 'all' || levelFilter !== 'all') ? (
            <button
              className="empty-state__link"
              onClick={() => { setLangFilter('all'); setLevelFilter('all'); setSearchInput(''); }}
            >
              필터 초기화
            </button>
          ) : tab === 'public' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <Link href="/materials/add" className="btn btn--primary btn--md">
                첫 번째 자료 공유하기 →
              </Link>
              <Link href="/guide" className="empty-state__link">
                어떤 자료가 좋을지 모르겠다면 가이드 보기 →
              </Link>
            </div>
          ) : (
            <Link href="/materials/add" className="empty-state__link">
              첫 번째 자료 추가하기 →
            </Link>
          )}
        </div>
      )}

      {/* 오늘의 추천(크론 수집) — 있을 때만 보인다. 빈 날의 상시 안내 카드는
          상단 '새 자료 추가'·가이드 링크와 같은 문이라 없앴다. */}
      {(() => {
        const filteredSuggestions = filterSuggestionsByProfile(suggestions, profile);
        if (filteredSuggestions.length === 0) return null;
        return (
          <section className="suggestions-section" style={{ marginTop: '40px' }}>
            <h2 className="suggestions-section__title">오늘의 추천 자료</h2>
            <div className="suggestions-grid">
              {filteredSuggestions.map(s => (
                <SuggestionCard key={s.id} suggestion={s} router={router} />
              ))}
            </div>
          </section>
        );
      })()}

      <ConfirmModal
        open={!!confirmAction}
        message={confirmAction?.message}
        onConfirm={confirmAction?.onConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
