'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { JP_LEVELS, EN_LEVELS } from '../lib/constants';
import ConfirmModal from '../components/ConfirmModal';


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
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [langFilter, setLangFilter] = useState(searchParams.get('lang') || 'all');
  const [levelFilter, setLevelFilter] = useState(searchParams.get('level') || 'all');
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

  const { data: completedIds = new Set() } = useQuery({
    queryKey: ['reading-progress-list', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('reading_progress')
        .select('material_id')
        .eq('user_id', user.id)
        .eq('is_completed', true);
      return new Set((data || []).map(r => r.material_id));
    },
    enabled: !!user,
    staleTime: 1000 * 60,
  });

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

  const filtered = materials;

  return (
    <div className="page-container">
      <div className="page-header page-header--row">
        <div>
          <h1 className="page-header__title">📰 자료실</h1>
          <p className="page-header__subtitle">AI가 해부한 고품질 텍스트로 학습하세요</p>
        </div>
        <Link href="/materials/add" className="btn btn--primary btn--md">
          ➕ 새 자료 추가
        </Link>
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
        </div>
      </div>

      {/* Language + Level filter */}
      <div className="materials-filters">
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
      </div>

      {isLoading ? (
        <div className="skeleton-grid">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="skeleton--card" style={{ height: 140 }}>
              <div className="skeleton-line--title skeleton-line" />
              <div className="skeleton-line--text skeleton-line" />
              <div className="skeleton-line--short skeleton-line" />
              <div className="skeleton-bar" />
            </div>
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <>
        <div className="feature-grid">
          {filtered.slice(0, visibleCount).map(m => {
            const status = m.processed_json?.status || 'idle';
            const metadata = m.processed_json?.metadata || {};
            const language = metadata.language || (m.title.match(/[a-zA-Z]/) ? 'English' : 'Japanese');
            const level = metadata.level;
            const isDone = status === 'completed';
            const isCompleted = completedIds.has(m.id);

            return (
              <div key={m.id} className="card card--clickable" onClick={() => router.push(`/viewer/${m.id}`)}>
                <div>
                  <div className="card__row card__row--between">
                    <div className="card__row card__row--gap">
                      <span className="card__flag">{language === 'English' ? '🇬🇧' : '🇯🇵'}</span>
                      {level && <span className="tag">{level}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {isCompleted ? (
                        <span className="badge" style={{ background: 'rgba(74,138,92,0.15)', color: 'var(--accent)', fontWeight: 600 }}>
                          ✓ 완독
                        </span>
                      ) : !isDone && (
                        <span className="badge" style={{
                          background: status === 'analyzing' ? 'var(--primary-glow)' : 'var(--bg-secondary)',
                          color: status === 'analyzing' ? 'var(--primary-light)' : 'var(--text-muted)',
                        }}>
                          {status === 'analyzing' ? '분석 중...' : '대기 중'}
                        </span>
                      )}
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
          })}
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
