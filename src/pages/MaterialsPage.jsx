import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

export default function MaterialsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('public');
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchMaterials();
  }, [tab, user]);

  async function fetchMaterials() {
    setLoading(true);
    try {
      let query = supabase
        .from('reading_materials')
        .select('id, title, created_at, visibility, owner_id, processed_json')
        .order('created_at', { ascending: false });

      if (tab === 'public') {
        query = query.eq('visibility', 'public');
      } else {
        if (!user) {
          setMaterials([]);
          setLoading(false);
          return;
        }
        query = query.eq('visibility', 'private').eq('owner_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setMaterials(data || []);
    } catch (err) {
      console.error("자료 목록 로드 실패:", err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '20px', flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-header__title">📰 자료실</h1>
          <p className="page-header__subtitle">AI가 해부한 고품질 텍스트로 학습하세요</p>
        </div>
        <Link 
          to="/materials/add" 
          style={{ 
            background: 'var(--primary)', color: 'white', padding: '12px 24px', 
            borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.95rem',
            boxShadow: '0 4px 15px var(--primary-glow)', transition: 'all 0.2s'
          }}
          onMouseOver={e => e.target.style.transform = 'translateY(-2px)'}
          onMouseOut={e => e.target.style.transform = 'translateY(0)'}
        >
          ➕ 새 자료 추가
        </Link>
      </div>

      {/* Search & Filter */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '32px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, position: 'relative', minWidth: '280px' }}>
          <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>🔍</span>
          <input 
            type="text" 
            placeholder="제목으로 자료 찾기..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ 
              width: '100%', padding: '12px 12px 12px 42px', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              color: 'var(--text-primary)', outline: 'none', fontSize: '0.95rem'
            }}
          />
        </div>
        
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: 'var(--radius-full)', width: 'fit-content' }}>
          <button
            onClick={() => setTab('public')}
            style={{
              padding: '10px 24px', borderRadius: 'var(--radius-full)',
              fontSize: '0.9rem', fontWeight: 600,
              background: tab === 'public' ? 'var(--accent)' : 'transparent',
              color: tab === 'public' ? 'white' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            🌐 Public
          </button>
          <button
            onClick={() => setTab('private')}
            style={{
              padding: '10px 24px', borderRadius: 'var(--radius-full)',
              fontSize: '0.9rem', fontWeight: 600,
              background: tab === 'private' ? 'var(--primary)' : 'transparent',
              color: tab === 'private' ? 'white' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            🔒 Private
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>⏳ 자료를 불러오는 중...</div>
      ) : materials.length > 0 ? (
        <div className="feature-grid">
          {materials
            .filter(m => m.title.toLowerCase().includes(searchQuery.toLowerCase()))
            .map(m => {
            const status = m.processed_json?.status || 'idle';
            const isDone = status === 'completed';
            
            return (
              <div 
                key={m.id} 
                className="card" 
                onClick={() => navigate(`/viewer/${m.id}`)}
                style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '180px' }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <span style={{ fontSize: '1.5rem' }}>{tab === 'public' ? '📰' : '📝'}</span>
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
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '8px', lineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {m.title}
                  </h3>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '16px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{new Date(m.created_at).toLocaleDateString()}</span>
                  <span>{tab === 'public' ? '공용' : '비공개'}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ 
          padding: '80px 20px', textAlign: 'center', background: 'var(--bg-secondary)', 
          borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)' 
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '20px' }}>📦</div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
            {tab === 'public' ? '아직 공유된 공용 자료가 없습니다.' : '아직 보관된 개인 자료가 없습니다.'}
          </p>
          {tab === 'private' && (
            <Link to="/materials/add" style={{ color: 'var(--primary-light)', fontWeight: 600, textDecoration: 'underline' }}>
              첫 번째 자료 추가하기 →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
