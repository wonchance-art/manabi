import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import Spinner from '../components/Spinner';

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

export default function MaterialsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('public');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ['materials', tab, user?.id],
    queryFn: () => fetchMaterials({ tab, userId: user?.id }),
  });

  return (
    <div className="page-container">
      <div className="page-header page-header--row">
        <div>
          <h1 className="page-header__title">📰 자료실</h1>
          <p className="page-header__subtitle">AI가 해부한 고품질 텍스트로 학습하세요</p>
        </div>
        <Link to="/materials/add" className="btn btn--primary btn--md">
          ➕ 새 자료 추가
        </Link>
      </div>

      {/* Search & Filter */}
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
          <button
            onClick={() => setTab('public')}
            className={`tab-pills__item ${tab === 'public' ? 'tab-pills__item--accent' : ''}`}
          >
            🌐 Public
          </button>
          <button
            onClick={() => setTab('private')}
            className={`tab-pills__item ${tab === 'private' ? 'tab-pills__item--primary' : ''}`}
          >
            🔒 Private
          </button>
        </div>
      </div>

      {isLoading ? (
        <Spinner message="자료를 불러오는 중..." />
      ) : materials.length > 0 ? (
        <div className="feature-grid">
          {materials
            .filter(m => m.title.toLowerCase().includes(searchQuery.toLowerCase()))
            .map(m => {
              const status = m.processed_json?.status || 'idle';
              const metadata = m.processed_json?.metadata || {};
              const language = metadata.language || (m.title.match(/[a-zA-Z]/) ? 'English' : 'Japanese');
              const level = metadata.level;
              const isDone = status === 'completed';

              return (
                <div
                  key={m.id}
                  className="card card--clickable"
                  onClick={() => navigate(`/viewer/${m.id}`)}
                >
                  <div>
                    <div className="card__row card__row--between">
                      <div className="card__row card__row--gap">
                        <span className="card__flag">{language === 'English' ? '🇬🇧' : '🇯🇵'}</span>
                        {level && <span className="tag">{level}</span>}
                      </div>
                      <span
                        className="badge"
                        style={{
                          background: isDone ? 'var(--accent-glow)' : 'var(--primary-glow)',
                          color: isDone ? 'var(--accent)' : 'var(--primary-light)'
                        }}
                      >
                        {isDone ? '분석 완료' : status === 'analyzing' ? '💡 분석 중' : '⏳ 대기 중'}
                      </span>
                    </div>
                    <h3 className="card__title">{m.title}</h3>
                  </div>
                  <div className="card__footer">
                    <span>{new Date(m.created_at).toLocaleDateString()}</span>
                    <span>{tab === 'public' ? '공용' : '비공개'}</span>
                  </div>
                </div>
              );
            })}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state__icon">📦</div>
          <p className="empty-state__msg">
            {tab === 'public' ? '아직 공유된 공용 자료가 없습니다.' : '아직 보관된 개인 자료가 없습니다.'}
          </p>
          {tab === 'private' && (
            <Link to="/materials/add" className="empty-state__link">
              첫 번째 자료 추가하기 →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
