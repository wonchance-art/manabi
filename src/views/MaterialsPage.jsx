'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { JP_LEVELS, EN_LEVELS } from '../lib/constants';
import Spinner from '../components/Spinner';

async function fetchTodaySuggestions() {
  const res = await fetch('/api/suggestions/today');
  if (!res.ok) return [];
  return res.json();
}

function SuggestionCard({ suggestion: s, router }) {
  const hasTranscript = !!s.transcript;
  const isYoutube = s.source === 'youtube';
  const youtubeUrl = isYoutube ? `https://www.youtube.com/watch?v=${s.video_id}` : null;

  return (
    <div className="suggestion-card">
      {s.thumbnail_url && (
        <div className="suggestion-card__thumb-wrap">
          <img src={s.thumbnail_url} alt={s.title} className="suggestion-card__thumb" />
          {isYoutube && <span className="suggestion-card__play">▶</span>}
        </div>
      )}
      <div className="suggestion-card__body">
        <div className="suggestion-card__meta">
          <span className="card__flag">{s.language === 'English' ? '🇬🇧' : '🇯🇵'}</span>
          {s.level && <span className="tag">{s.level}</span>}
          <span className="suggestion-card__source">{s.channel_name}</span>
        </div>
        <h3 className="suggestion-card__title">{s.title}</h3>
        <div className="suggestion-card__actions">
          {hasTranscript ? (
            <button
              className="btn btn--primary btn--sm"
              onClick={() => router.push(`/materials/add?suggestion=${s.id}`)}
            >
              📖 공부하기
            </button>
          ) : (
            <span className="suggestion-card__no-transcript">자막 없음</span>
          )}
          {youtubeUrl && (
            <a
              href={youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--secondary btn--sm"
            >
              ▶ 영상 보기
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

async function fetchMaterials({ tab, userId }) {
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


export default function MaterialsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState('public');
  const [searchQuery, setSearchQuery] = useState('');
  const [langFilter, setLangFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // 필터 바뀌면 페이지 리셋
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [tab, searchQuery, langFilter, levelFilter]);

  const { data: suggestions = [] } = useQuery({
    queryKey: ['suggestions-today'],
    queryFn: fetchTodaySuggestions,
    staleTime: 60 * 60 * 1000, // 1시간 캐시
  });

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ['materials', tab, user?.id],
    queryFn: () => fetchMaterials({ tab, userId: user?.id }),
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

  const filtered = materials.filter(m => {
    const metadata = m.processed_json?.metadata || {};
    const language = metadata.language || (m.title.match(/[a-zA-Z]/) ? 'English' : 'Japanese');
    const level = metadata.level || '';

    if (searchQuery && !m.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (langFilter !== 'all' && language !== langFilter) return false;
    if (levelFilter !== 'all' && level !== levelFilter) return false;
    return true;
  });

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

      {/* 오늘의 추천 */}
      {suggestions.length > 0 && (
        <section className="suggestions-section">
          <h2 className="suggestions-section__title">✨ 오늘의 추천 자료</h2>
          <div className="suggestions-grid">
            {suggestions.map(s => (
              <SuggestionCard key={s.id} suggestion={s} router={router} />
            ))}
          </div>
        </section>
      )}

      {/* Search */}
      <div className="filter-row">
        <div className="search-wrap">
          <span className="search-wrap__icon">🔍</span>
          <input
            type="text"
            placeholder="제목으로 자료 찾기..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
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
        <Spinner message="자료를 불러오는 중..." />
      ) : filtered.length > 0 ? (
        <>
        <div className="feature-grid">
          {filtered.slice(0, visibleCount).map(m => {
            const status = m.processed_json?.status || 'idle';
            const metadata = m.processed_json?.metadata || {};
            const language = metadata.language || (m.title.match(/[a-zA-Z]/) ? 'English' : 'Japanese');
            const level = metadata.level;
            const isDone = status === 'completed';

            return (
              <div key={m.id} className="card card--clickable" onClick={() => router.push(`/viewer/${m.id}`)}>
                <div>
                  <div className="card__row card__row--between">
                    <div className="card__row card__row--gap">
                      <span className="card__flag">{language === 'English' ? '🇬🇧' : '🇯🇵'}</span>
                      {level && <span className="tag">{level}</span>}
                    </div>
                    <span className="badge" style={{
                      background: isDone ? 'var(--accent-glow)' : 'var(--primary-glow)',
                      color: isDone ? 'var(--accent)' : 'var(--primary-light)'
                    }}>
                      {isDone ? '분석 완료' : status === 'analyzing' ? '💡 분석 중' : '⏳ 대기 중'}
                    </span>
                  </div>
                  <h3 className="card__title">{m.title}</h3>
                </div>
                <div className="card__footer">
                  <span>{new Date(m.created_at).toLocaleDateString('ko-KR')}</span>
                  <span>{tab === 'public' ? '공용' : '비공개'}</span>
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
          <div className="empty-state__icon">📦</div>
          <p className="empty-state__msg">
            {searchQuery || langFilter !== 'all' || levelFilter !== 'all'
              ? '조건에 맞는 자료가 없습니다.'
              : tab === 'public' ? '아직 공유된 공용 자료가 없습니다.' : '아직 보관된 개인 자료가 없습니다.'}
          </p>
          {tab === 'private' && !searchQuery && (
            <Link href="/materials/add" className="empty-state__link">
              첫 번째 자료 추가하기 →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
