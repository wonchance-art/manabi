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
import { groupByPdf, pageRangeLabel, readProgressLabel } from '../lib/pdfGroups';
import { useGroupReadIds } from '../lib/useGroupReadIds';
import { LEVELS, langNameKo, levelRank, profileLevel, isWriteMaterial } from '../lib/constants';
import { isOnDemandSuggestion } from '../lib/suggestionSources';
import ConfirmModal from '../components/ConfirmModal';
import { CardGridSkeleton } from '../components/Skeleton';
import MaterialGroupCard from '../components/MaterialGroupCard';


async function fetchTodaySuggestions() {
  const res = await fetch('/api/suggestions/today');
  if (!res.ok) return [];
  return res.json();
}

function SuggestionCard({ suggestion: s, router }) {
  // 영상 추천은 본문이 **없는 게 정상**이다 — 크론은 목록만 담고, 자막은 누르는 사람이
  // 자기 비공개 자료로 가져온다(v2-F R4). `transcript` 하나로 판정하면 영상 카드가
  // 전부 「자막 없음」으로 죽는다.
  const onDemand = isOnDemandSuggestion(s);
  const hasTranscript = !!s.transcript;
  const isReady = !!s.material_id; // 이미 분석된 자료(글 소스 전용 — 영상은 개인별이라 안 붙는다)
  const canStudy = onDemand || hasTranscript;

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
          {/* 언어명은 정본(constants.langNameKo)만 — 여기 삼항이 하드코딩돼 있어
              F R2가 연 프랑스어 카드가 「일본어」로 떴다. */}
          <span className="card__flag">{langNameKo(s.language)}</span>
          {s.level && <span className="tag">{s.level}</span>}
          <span className="suggestion-card__source">{s.channel_name}</span>
          {isReady && <span className="suggestion-card__ready">✓ 바로 읽기</span>}
        </div>
        <h3 className="suggestion-card__title">{s.title}</h3>
        <div className="suggestion-card__actions">
          <button
            className="btn btn--primary btn--sm"
            disabled={!canStudy}
            title={canStudy ? '' : '내용을 가져올 수 없습니다'}
            onClick={handleStudy}
          >
            {isReady ? '바로 읽기' : onDemand ? '내 자료로 가져오기' : '공부하기'}
          </button>
          {!canStudy && (
            <span className="suggestion-card__no-transcript">자막 없음</span>
          )}
        </div>
        {onDemand && (
          /* 실제로 일어나는 일을 그대로 말한다 — 내 계정에 비공개 사본이 생긴다.
             화면 문구와 저작권 모델이 어긋나면 둘 중 하나가 거짓말이 된다. */
          <p className="suggestion-card__note">가져오면 비공개 내 자료가 돼요</p>
        )}
      </div>
    </div>
  );
}

const MATERIAL_LIST_COLS = 'id, title, created_at, visibility, owner_id, processed_json, source_pdf_id, page_start, page_end';

function fetchMaterialsWithoutDirection(args) { return fetchMaterials({ ...args, withDirection: false }); }

async function fetchMaterials({ tab, userId, langFilter, levelFilter, searchQuery, withDirection = true }) {
  let query = supabase
    .from('reading_materials')
    // direction(U R3) — 컬럼 미적용 환경은 PostgREST가 400을 내므로 아래 폴백이 direction 없이 다시 조회한다
    .select(withDirection ? `${MATERIAL_LIST_COLS}, direction` : MATERIAL_LIST_COLS)
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
  if (error) {
    // U R3: direction 컬럼 미적용 환경(마이그레이션은 오너 수동) — 컬럼 없이 같은 조회를 한 번 더.
    // etym/hanja·writing_practice 신규 컬럼 폴백과 같은 패턴. 그 환경엔 노트가 없으므로 결과는 같다.
    if (/column|schema|direction/i.test(error.message || '')) {
      const retry = await fetchMaterialsWithoutDirection({ tab, userId, langFilter, levelFilter, searchQuery });
      return retry;
    }
    throw error;
  }
  return data || [];
}

const PAGE_SIZE = 12;

// 언어 칩도 정본에서 파생한다. 손으로 적었더니 **프랑스어가 빠져 있었고**, F R2가
// 프랑스어 공급을 연 뒤에도 자료실에서 프랑스어만 골라 볼 방법이 없었다.
const LANG_FILTERS = [
  { key: 'all', label: '전체' },
  ...Object.keys(LEVELS).map((key) => ({ key, label: langNameKo(key) })),
];


// 유저 레벨 ±1 범위의 추천만 표시.
//
// 순서표도 프로필 컬럼 선택도 **지역 복본이었고 둘 다 ja/en만 알았다**. F R2가 프랑스어
// 공급을 연 순간 프랑스어 카드가 **사용자의 영어 수준으로** 걸러졌다(영어가 C1이면
// 프랑스어 B1 카드가 diff 2로 숨는다). 컬럼은 이미 4개가 다 있었고, 없던 건 정본이었다.
function filterSuggestionsByProfile(suggestions, profile) {
  if (!profile || !suggestions.length) return suggestions;
  return suggestions.filter(s => {
    if (!profile.learning_language?.includes(s.language)) return false;
    if (!s.level) return true;
    const userLevel = profileLevel(profile, s.language);
    if (!userLevel) return true;
    const cardRank = levelRank(s.language, s.level);
    const userRank = levelRank(s.language, userLevel);
    // 모르는 값은 **거르지 않는다** — 예전엔 99로 두어 diff가 커지며 조용히 숨었다.
    if (cardRank == null || userRank == null) return true;
    return Math.abs(cardRank - userRank) <= 1;
  });
}

export default function MaterialsPage() {
  const { user, profile, loading: authLoading } = useAuth();
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
  // 기본 탭(v2-P, 오너 지시 「내 자료가 먼저」) — 로그인 `private` / 비로그인 `public`.
  // ⚠ 게스트 분기가 **필수**다: `내 자료` 쿼리는 `if (!userId) return []`이라 게스트에게
  // 무조건 빈 목록이다. 그냥 뒤집으면 게스트 첫 화면이 빈다.
  // auth가 정해지기 전에는 고르지 않는다(`null`) — 로딩 중 `public`으로 그렸다가
  // 사용자가 확인되며 `private`으로 튀면 **자료 쿼리가 두 번** 난다(가드 없는 useQuery).
  const [tabOverride, setTabOverride] = useState(null);
  const tab = tabOverride ?? (authLoading ? null : (user ? 'private' : 'public'));
  const setTab = setTabOverride;
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
  // 받아둔 자료(v2-N R3). IndexedDB는 서버가 아니라 **이 기기**의 상태라 쿼리 캐시가
  // 아니라 지역 상태로 둔다 — 기기마다 다른 게 정상이고, 그래서 동기화 대상도 아니다.
  const [pinnedIds, setPinnedIds] = useState(() => new Set());
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [pinBusy, setPinBusy] = useState(null);
  useEffect(() => {
    let alive = true;
    import('../lib/offlineCache')
      .then(({ pinnedMaterialIds }) => pinnedMaterialIds())
      .then((ids) => { if (alive) setPinnedIds(ids); })
      .catch(() => { /* 큐를 못 쓰는 환경(사생활 모드) — 배지가 안 뜰 뿐 */ });
    return () => { alive = false; };
  }, []);

  // 받아두기 토글. 자료실 목록 행에는 뷰어가 읽는 raw_text·source_pdf_id·page_start·
  // page_end·status가 **없어서**(실측) 전체 행을 한 번 더 받아 담는다 — 목록 행을
  // 그대로 넣으면 오프라인 뷰어에 빈 칸이 생긴다.
  const togglePin = async (id) => {
    setPinBusy(id);
    try {
      const cache = await import('../lib/offlineCache');
      if (pinnedIds.has(id)) {
        await cache.unpinMaterial(id);
        setPinnedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
        toast('받아두기를 해제했어요.', 'info');
        return;
      }
      const { data, error } = await supabase
        .from('reading_materials').select('*').eq('id', id).maybeSingle();
      if (error || !data) throw error || new Error('NOT_FOUND');
      await cache.pinMaterial(data);
      setPinnedIds((prev) => new Set(prev).add(id));
      toast('받아뒀어요 — 연결이 없어도 열립니다.', 'success');
    } catch {
      toast('받아두지 못했어요. 연결을 확인해주세요.', 'error');
    } finally {
      setPinBusy(null);
    }
  };
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
        .select('id, title, page_count, created_at, thumbnail_path, last_page_read')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    // PDF 탭이 없어졌으므로 `내 자료`에서 돈다. 새 쿼리가 아니라 **도는 시점**이 바뀐
    // 것이다 — 그리고 그 탭이 이제 로그인 사용자의 기본값이다.
    enabled: !!user && tab === 'private',
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
    // 기본 탭이 로그인 여부로 갈리므로 auth 확정 전에 쏘면 버릴 쿼리가 된다.
    enabled: !!tab,
    refetchInterval: (query) => {
      const hasAnalyzing = query.state.data?.some(
        m => m.processed_json?.status === 'analyzing'
      );
      return hasAnalyzing ? 5000 : false;
    },
  });

  // 레벨 목록도 정본에서. 삼항 체인이라 프랑스어를 고르면 **전체 목록**이 나왔다.
  // '전체'는 네 언어를 합치되 중복을 지운다 — 영어와 프랑스어가 CEFR 급수를 공유해서,
  // 안 지우면 같은 항목이 두 번 뜨고 React key도 겹친다.
  const levelOptions = LEVELS[langFilter] || [...new Set(Object.values(LEVELS).flat())];

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
        // 순위는 **그 자료 자신의 언어** 학습 순서에서 나온다(정본 levelRank).
        // 여기서 모르는 값을 99로 두는 건 맞다 — **정렬에서는 뒤로 밀리는 것**이고,
        // 추천 필터에서 같은 99가 틀렸던 이유는 거기선 **카드가 사라졌기** 때문이다.
        const rank = (m) => {
          const meta = m.processed_json?.metadata;
          return levelRank(meta?.language, meta?.level) ?? 99;
        };
        const oa = rank(a);
        const ob = rank(b);
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
  const afterUnread = unreadOnly ? sorted.filter((m) => !completedIds.has(m.id)) : sorted;
  // 「받아둔 것만」(v2-N R3) — 오프라인일 때 열 수 없는 자료를 보여주는 건 해롭다.
  const filtered = pinnedOnly ? afterUnread.filter((m) => pinnedIds.has(m.id)) : afterUnread;

  // PDF 묶음에 적용할 필터(v2-P 계약 ④). 언어·레벨 같은 조건은 **자료**에 붙는 것이라
  // 자료 0개 PDF에는 대응물이 아예 없다 — 「일본어」로 좁혔는데 언어를 모르는 PDF가
  // 남아 있으면 그게 필터 위반이다. 그래서 조건이 하나라도 걸리면 **자료가 남은 PDF만**
  // 보여주고, 조건이 없을 때만 자료 0개 PDF까지 전부 보여준다(계약 ② 누락 금지).
  const anyFilter = !!searchQuery || langFilter !== 'all' || levelFilter !== 'all' || unreadOnly || pinnedOnly;
  const visiblePdfs = useMemo(() => {
    if (tab !== 'private') return [];
    if (!anyFilter) return pdfs;
    const live = new Set(filtered.map((m) => m.source_pdf_id).filter(Boolean));
    return pdfs.filter((x) => live.has(x.id));
  }, [tab, anyFilter, pdfs, filtered]);

  // 묶음 줄의 오른쪽 슬롯 — 책 챕터든 PDF 범위든 같은 것을 말한다(읽음·복습·분석 상태).
  // 컴포넌트를 하나로 합치니 책 챕터 줄도 복습 개수를 얻는다(낱개 자료 카드는 원래
  // 보여 주고 있었다 — 묶음 안에서만 빠져 있던 쪽이 이상했다).
  const STATUS_LABEL = { pending: '분석 전', analyzing: '분석 중', failed: '실패', partial: '일부 완료' };
  const STATUS_TONE = { pending: 'muted', analyzing: 'due', failed: 'danger' };
  const chapterTags = (c) => {
    const st = c.processed_json?.status || 'idle';
    const due = st === 'completed' ? countDueInMaterial(c) : 0;
    return (
      <>
        {completedIds.has(c.id) && <span className="group-card__tag group-card__tag--done">✓ 읽음</span>}
        {due > 0 && <span className="group-card__tag group-card__tag--due">복습 {due}개</span>}
        <span className={`group-card__tag group-card__tag--${STATUS_TONE[st] || 'done'}`}>
          {STATUS_LABEL[st] || '완료'}
        </span>
      </>
    );
  };

  // 묶음 커버리지 줄 — 「책 전체 단어 중 몇 개를 아는가」. 표본 미달·게스트·미분석은 무표기.
  // 단위만 갈린다(책은 「과」, PDF는 「개」).
  const fitLineOf = (bf, unit) => {
    const showFit = bf && bf.coverage != null && bf.total >= FIT_MIN_TYPES;
    if (!showFit) return null;
    return (
      <>
        {bf.analyzed < bf.chapters && `분석한 ${bf.analyzed}${unit} 기준 · `}
        {bf.total.toLocaleString()}단어 중{' '}
        <strong className="group-card__fitnum">{Math.round(bf.coverage * 100)}% 앎</strong>
        {' '}· 새 단어 {bf.unknown.toLocaleString()}개
      </>
    );
  };

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

        {/* 탭은 둘뿐이다(v2-P) — PDF는 탭이 아니라 `내 자료` 안의 묶음 카드로 들어왔다.
            순서도 오너 지시대로 뒤집었다: 내 자료가 먼저, 공용이 그 다음. */}
        <div className="tab-pills">
          <button onClick={() => setTab('private')}
            aria-pressed={tab === 'private'}
            className={`tab-pills__item ${tab === 'private' ? 'tab-pills__item--primary' : ''}`}>
            내 자료
          </button>
          <button onClick={() => setTab('public')}
            aria-pressed={tab === 'public'}
            className={`tab-pills__item ${tab === 'public' ? 'tab-pills__item--accent' : ''}`}>
            공용
          </button>
        </div>
      </div>

      {/* Language + Level filter — 이제 두 탭에 똑같이 적용된다(PDF 탭 가드 폐지) */}
      <div className="materials-filters">
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
          {/* 「받아둔 것만」(v2-N R3) — 받아둔 게 하나도 없으면 칩 자체가 없다
              (누를 수 있는데 결과가 늘 0인 칩은 고장으로 읽힌다). */}
          {pinnedIds.size > 0 && (
            <button
              onClick={() => setPinnedOnly(v => !v)}
              aria-pressed={pinnedOnly}
              className={`chip ${pinnedOnly ? 'chip--active' : ''}`}
              title="연결이 없어도 열리는 자료만 봅니다"
            >
              받아둔 것만
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
      </div>

      {(!tab || isLoading) ? (
        <CardGridSkeleton />
      ) : materialsError ? (
        <div className="empty-state">
          <div className="empty-state__icon">×</div>
          <p className="empty-state__msg">자료 목록을 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.</p>
          <button type="button" className="btn btn--primary btn--md" onClick={() => refetchMaterials()}>다시 시도</button>
        </div>
      ) : (filtered.length > 0 || visiblePdfs.length > 0) ? (
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
            // 책 묶음(P1) — metadata.book이 있는 자료는 책 카드 하나로 묶어 챕터 목록을 보여준다.
            // PDF 묶음(v2-P)은 그 다음 — 손으로 매긴 `metadata.book`이 자동 파생인
            // `source_pdf_id`를 이기도록 **호출 순서로** 우선순위를 세운다.
            const { books, singles: bookless } = groupByBook(filtered);
            const { groups: pdfGroupsHere, rest: singles } = groupByPdf(bookless, visiblePdfs);
            const bookCards = books.map((b) => {
              const analyzed = b.chapters.filter((c) => ['completed', 'partial'].includes(c.processed_json?.status)).length;
              const readDone = b.chapters.filter((c) => completedIds.has(c.id)).length;
              // 책 단위 커버리지(R2) — 챕터 types 합집합. 어휘 교재의 진짜 지표는 챕터별 배지가
              // 아니라 "책 전체 단어 중 몇 개를 아는가"다. 표본 미달·게스트·미분석은 무표기.
              const bf = savedFitIndex ? bookFit(b.chapters, savedFitIndex) : null;
              return (
                <MaterialGroupCard
                  key={b.key}
                  icon="📖"
                  title={b.title || '제목 없는 책'}
                  meta={`챕터 ${b.chapters.length}개 · 분석 ${analyzed}/${b.chapters.length} · 읽음 ${readDone}/${b.chapters.length}`}
                  fitLine={fitLineOf(bf, '과')}
                  rows={b.chapters.map((c) => ({
                    key: c.id,
                    onClick: () => router.push(`/viewer/${c.id}`),
                    lead: c._bookOrder,
                    title: c.title.includes(' — ') ? c.title.split(' — ').slice(1).join(' — ') : c.title,
                    right: chapterTags(c),
                  }))}
                  // 이어 적기(#1077 5520128974) — 내 책에만 「다음 과 적기」(PDF 카드 「이어 읽기」와 같은 자리)
                  footer={b.chapters[0]?.owner_id === user?.id ? (
                    <Link href={`/materials/add?book=${encodeURIComponent(b.key)}`} className="btn btn--secondary btn--sm">+ 다음 과 적기</Link>
                  ) : null}
                />
              );
            });
            // PDF 묶음(v2-P) — 원본 하나 + 거기서 뽑은 범위 자료들. 책 카드와 **같은
            // 컴포넌트**를 쓴다(계약 ③). 자료가 0개인 PDF도 카드로 남는다 — 탭을
            // 없애면서 잃는 것이 있으면 통합이 아니라 삭제다.
            const pdfCards = pdfGroupsHere.map((g) => {
              const analyzed = g.chapters.filter((c) => ['completed', 'partial'].includes(c.processed_json?.status)).length;
              const readDone = g.chapters.filter((c) => completedIds.has(c.id)).length;
              const bf = savedFitIndex && g.chapters.length > 0 ? bookFit(g.chapters, savedFitIndex) : null;
              const progress = readProgressLabel(g.pdf);
              return (
                <MaterialGroupCard
                  key={g.key}
                  icon="📕"
                  title={g.pdf.title}
                  meta={[
                    `PDF ${g.pdf.page_count}쪽`,
                    progress,
                    g.chapters.length > 0
                      ? `자료 ${g.chapters.length}개 · 분석 ${analyzed}/${g.chapters.length} · 읽음 ${readDone}/${g.chapters.length}`
                      : '아직 뽑은 자료 없음',
                  ].filter(Boolean).join(' · ')}
                  fitLine={fitLineOf(bf, '개')}
                  rows={g.chapters.map((c) => ({
                    key: c.id,
                    onClick: () => router.push(`/viewer/${c.id}`),
                    lead: pageRangeLabel(c) || '',
                    title: c.title,
                    right: chapterTags(c),
                  }))}
                  footer={(
                    <Link href={`/pdf/${g.pdf.id}`} className="btn btn--secondary btn--sm">
                      {progress ? '이어 읽기' : '원본 PDF 보기'}
                    </Link>
                  )}
                />
              );
            });
            return [...bookCards, ...pdfCards, ...singles.slice(0, visibleCount).map(m => {
            // U R3: 노트(write)는 분석 상태가 없다 — 배지·복습 수·미리보기 대신 「내 노트」 한 표식
            const isNote = isWriteMaterial(m) || m.processed_json?.status === 'note';
            const status = isNote ? 'note' : (m.processed_json?.status || 'idle');
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
                      {isNote && <span className="tag" title="내가 쓴 노트 — 분석하지 않는 비공개 자료">✍ 내 노트</span>}
                      {level && <span className="tag">{level}</span>}
                      {seriesPosition && (
                        <span className="tag" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }} title={`${titleMeta.series} 시리즈`}>
                          {seriesPosition}
                        </span>
                      )}
                      {dueCount > 0 && (
                        <span
                          className="tag tag--due"
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
                    {/* 받아두기 버튼이 들어오면서 배지 무리가 한 줄에 안 들어가는
                        구간이 생겼다 — 실측: 320·360px에서 문서 폭이 386px로 넘쳤다
                        (버튼 제거 시 넘침 0이었으므로 원인은 이 버튼이 맞다).
                        무리를 감싸고 오른쪽 정렬을 유지해 줄이 늘 뿐 넘치지 않게 한다. */}
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {/* 받아두기(v2-N R3) — 태그 줄이 아니라 **배지 무리**에 둔다.
                          F R3 실측: 320px에서 태그 줄이 이미 최악 조합 때 3줄까지 간다.
                          카드 전체가 뷰어로 가는 클릭 대상이라 stopPropagation 필수 —
                          받아두려다 자료가 열리면 그건 다른 동작이다. */}
                      <button
                        type="button"
                        className={`mat-pin${pinnedIds.has(m.id) ? ' mat-pin--on' : ''}`}
                        onClick={(e) => { e.stopPropagation(); togglePin(m.id); }}
                        disabled={pinBusy === m.id}
                        aria-pressed={pinnedIds.has(m.id)}
                        title={pinnedIds.has(m.id) ? '받아둠 — 연결이 없어도 열립니다 (눌러서 해제)' : '받아두기 — 연결이 없어도 열립니다'}
                      >
                        {pinBusy === m.id ? '…' : pinnedIds.has(m.id) ? '✓ 받아둠' : '⬇ 받아두기'}
                      </button>
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
