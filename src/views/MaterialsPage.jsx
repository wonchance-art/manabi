'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { parseTitle } from '../lib/seriesMeta';
import { JP_LEVELS, EN_LEVELS } from '../lib/constants';
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
          <span className="card__flag">{s.language === 'English' ? '🇬🇧' : '🇯🇵'}</span>
          {s.level && <span className="tag">{s.level}</span>}
          <span className="suggestion-card__source">{s.channel_name}</span>
          {isReady && <span className="suggestion-card__ready">✅ 바로 읽기</span>}
        </div>
        <h3 className="suggestion-card__title">{s.title}</h3>
        <div className="suggestion-card__actions">
          <button
            className="btn btn--primary btn--sm"
            disabled={!hasTranscript}
            title={hasTranscript ? '' : '내용을 가져올 수 없습니다'}
            onClick={handleStudy}
          >
            {isReady ? '📖 바로 읽기' : '📖 공부하기'}
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
  { key: 'all',      label: '🌍 전체' },
  { key: 'Japanese', label: '🇯🇵 일본어' },
  { key: 'English',  label: '🇬🇧 영어' },
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
  const [sortBy, setSortBy] = useState('newest'); // newest | level | title
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
      const { data } = await supabase
        .from('uploaded_pdfs')
        .select('id, title, page_count, created_at, thumbnail_path')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user && tab === 'pdf',
    staleTime: 1000 * 60,
  });

  const { data: progressMap = { completed: new Set(), inProgress: new Map() } } = useQuery({
    queryKey: ['reading-progress-list', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('reading_progress')
        .select('material_id, is_completed, last_token_idx')
        .eq('user_id', user.id);
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

  // 복습 대기 중인 단어 (Reading-as-Review용)
  const { data: dueVocabIndex } = useQuery({
    queryKey: ['due-vocab-index', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_vocabulary')
        .select('word_text, base_form, next_review_at')
        .eq('user_id', user.id)
        .lte('next_review_at', new Date().toISOString());
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

  const { data: materials = [], isLoading } = useQuery({
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
    : [...JP_LEVELS, ...EN_LEVELS];

  const filtered = (() => {
    if (sortBy === 'newest') return materials;
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

  return (
    <div className="page-container">
      <div className="page-header page-header--row">
        <div>
          <h1 className="page-header__title">📰 자료실</h1>
          <p className="page-header__subtitle">AI가 해부한 고품질 텍스트로 학습하세요</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            className="btn btn--ghost btn--md"
            onClick={async () => {
              try {
                const t = await navigator.clipboard.readText();
                if (t?.trim()) {
                  sessionStorage.setItem('pending_paste', t.trim());
                  router.push('/materials/add');
                } else {
                  toast('클립보드가 비어있어요', 'info');
                }
              } catch {
                toast('브라우저 클립보드 접근을 허용해 주세요', 'warning');
              }
            }}
          >
            📋 붙여넣어 시작
          </button>
          <Link href="/materials/add" className="btn btn--primary btn--md">
            ➕ 새 자료 추가
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="filter-row">
        <div className="search-wrap">
          <span className="search-wrap__icon">🔍</span>
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
            className={`tab-pills__item ${tab === 'public' ? 'tab-pills__item--accent' : ''}`}>
            🌐 Public
          </button>
          <button onClick={() => setTab('private')}
            className={`tab-pills__item ${tab === 'private' ? 'tab-pills__item--primary' : ''}`}>
            🔒 Private
          </button>
          {user && (
            <button onClick={() => setTab('pdf')}
              className={`tab-pills__item ${tab === 'pdf' ? 'tab-pills__item--primary' : ''}`}>
              📄 PDF
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
              className={`chip ${langFilter === f.key ? 'chip--active' : ''}`}
            >
              {f.label}
            </button>
          ))}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="chip chip--select"
            aria-label="정렬"
            style={{ marginLeft: 'auto' }}
          >
            <option value="newest">🕒 최신순</option>
            <option value="level">📊 쉬운순</option>
            <option value="title">🔤 제목순</option>
          </select>
        </div>

        {langFilter !== 'all' && (
          <div className="chip-group">
            <button
              onClick={() => setLevelFilter('all')}
              className={`chip ${levelFilter === 'all' ? 'chip--active' : ''}`}
            >
              전체 난이도
            </button>
            {levelOptions.map(lvl => (
              <button
                key={lvl}
                onClick={() => setLevelFilter(lvl)}
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
                  <span style={{ fontSize: '2rem' }}>📄</span>
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
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📄</div>
            <p>업로드된 PDF가 없습니다.</p>
            <Link href="/materials/add" className="btn btn--primary btn--sm" style={{ marginTop: 12 }}>PDF 업로드하기</Link>
          </div>
        )
      ) : isLoading ? (
        <CardGridSkeleton />
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
            return filtered.slice(0, visibleCount).map(m => {
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

            return (
              <div key={m.id} className="card card--clickable" onClick={() => router.push(`/viewer/${m.id}`)}>
                <div>
                  <div className="card__row card__row--between">
                    <div className="card__row card__row--gap">
                      <span className="card__flag">{language === 'English' ? '🇬🇧' : '🇯🇵'}</span>
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
                          🧠 {dueCount} 복습
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {testScores[String(m.id)] && (
                        <span className="badge" style={{ background: 'rgba(212,150,42,0.12)', color: 'var(--warning)', fontWeight: 600 }} title="리딩 테스트 최고 점수">
                          🏆 {testScores[String(m.id)].score}/{testScores[String(m.id)].total}
                        </span>
                      )}
                      {isCompleted ? (
                        <span className="badge" style={{ background: 'rgba(74,138,92,0.15)', color: 'var(--accent)', fontWeight: 600 }}>
                          ✓ 완독
                        </span>
                      ) : (() => {
                        const lastIdx = progressMap.inProgress.get(m.id);
                        const total = m.processed_json?.sequence?.length || 0;
                        if (lastIdx && total > 0) {
                          const pct = Math.round((lastIdx / total) * 100);
                          return (
                            <span className="badge" style={{ background: 'var(--bg-secondary)', color: 'var(--primary)', fontWeight: 600 }} title="이어서 읽기">
                              📖 {pct}%
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
                  <h3 className="card__title">{m.title}</h3>
                </div>
                <div className="card__footer">
                  <span>{new Date(m.created_at).toLocaleDateString('ko-KR')}</span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {m.owner_id === user?.id ? (
                      <button
                        className="btn btn--ghost btn--sm"
                        style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                        disabled={toggleVisibilityMutation.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleVisibilityMutation.mutate({
                            id: m.id,
                            newVisibility: m.visibility === 'public' ? 'private' : 'public',
                          });
                        }}
                      >
                        {m.visibility === 'public' ? '🔒 비공개로' : '🌐 공개로'}
                      </button>
                    ) : (
                      <span>{tab === 'public' ? '공용' : '비공개'}</span>
                    )}
                    {m.owner_id === user?.id && (
                      <button
                        className="btn btn--ghost btn--sm"
                        style={{ color: 'var(--danger)', padding: '2px 6px', fontSize: '0.75rem' }}
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
            });
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
          <div className="empty-state__icon">
            {searchQuery || langFilter !== 'all' || levelFilter !== 'all' ? '🔍' : '📖'}
          </div>
          <p className="empty-state__msg">
            {searchQuery || langFilter !== 'all' || levelFilter !== 'all'
              ? '조건에 맞는 자료가 없습니다.'
              : tab === 'public'
                ? '아직 공유된 공용 자료가 없습니다.\n관심 있는 텍스트를 업로드하면 모두가 함께 공부할 수 있어요!'
                : '아직 보관된 개인 자료가 없습니다.'}
          </p>
          {(searchQuery || langFilter !== 'all' || levelFilter !== 'all') ? (
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

      {/* 오늘의 추천 — 유저 레벨 ±1 필터링 */}
      {(() => {
        const filteredSuggestions = filterSuggestionsByProfile(suggestions, profile);
        if (filteredSuggestions.length > 0) {
          return (
            <section className="suggestions-section" style={{ marginTop: '40px' }}>
              <h2 className="suggestions-section__title">✨ 오늘의 추천 자료</h2>
              <div className="suggestions-grid">
                {filteredSuggestions.map(s => (
                  <SuggestionCard key={s.id} suggestion={s} router={router} />
                ))}
              </div>
            </section>
          );
        }
        // 추천이 없을 때 — 직접 추가 유도
        return (
          <section className="suggestions-section" style={{ marginTop: '40px' }}>
            <h2 className="suggestions-section__title">✨ 오늘의 추천 자료</h2>
            <div className="card" style={{ padding: '28px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>📚</div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: '0.9rem' }}>
                오늘의 추천이 아직 준비되지 않았어요.
                <br />직접 관심 있는 텍스트를 추가해보세요!
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link href="/materials/add" className="btn btn--primary btn--sm">➕ 자료 추가하기</Link>
                <Link href="/guide" className="btn btn--secondary btn--sm">📖 학습 로드맵 보기</Link>
              </div>
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
