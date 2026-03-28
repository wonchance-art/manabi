'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import Spinner from '../components/Spinner';
import Button from '../components/Button';

const SOURCE_TYPE_LABELS = {
  nhk_easy:         'NHK Web Easy',
  wikipedia_random: 'Wikipedia (랜덤)',
};

const LEVEL_OPTIONS = {
  Japanese: ['N5 기초', 'N4 기본', 'N3 중급', 'N2 상급', 'N1 심화'],
  English:  ['A1 기초', 'A2 초급', 'B1 중급', 'B2 상급', 'C1 고급'],
};

const DEFAULT_NEW_SOURCE = {
  language: 'Japanese',
  source_type: 'wikipedia_random',
  name: '',
  config: { lang: 'ja', level: 'N3 중급' },
};

async function fetchContentSources() {
  const { data, error } = await supabase
    .from('content_sources')
    .select('*')
    .order('language')
    .order('created_at');
  if (error) throw error;
  return data || [];
}

// ── Fetchers ──────────────────────────────────────
async function fetchAllUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, role, streak_count, last_login_at')
    .order('last_login_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function fetchAllMaterials() {
  const { data, error } = await supabase
    .from('reading_materials')
    .select('id, title, visibility, created_at, owner_id, processed_json, owner:profiles(display_name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function fetchAllPosts() {
  const { data, error } = await supabase
    .from('forum_posts')
    .select('id, content, created_at, likes_count, author:profiles(display_name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// ── Component ─────────────────────────────────────
export default function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const [tab, setTab] = useState('users');
  const [newSource, setNewSource] = useState(DEFAULT_NEW_SOURCE);
  const [showAddForm, setShowAddForm] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();

  if (loading) return <div className="page-container"><Spinner /></div>;
  if (!isAdmin) return (
    <div className="page-container" style={{ textAlign: 'center', paddingTop: '80px' }}>
      <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🚫</div>
      <h2 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>접근 권한이 없습니다</h2>
      <Link href="/" className="btn btn--primary">홈으로</Link>
    </div>
  );

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: fetchAllUsers,
    enabled: tab === 'users',
  });

  const { data: materials = [], isLoading: matsLoading } = useQuery({
    queryKey: ['admin-materials'],
    queryFn: fetchAllMaterials,
    enabled: tab === 'materials',
  });

  const { data: sources = [], isLoading: sourcesLoading } = useQuery({
    queryKey: ['admin-sources'],
    queryFn: fetchContentSources,
    enabled: tab === 'sources',
  });

  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ['admin-posts'],
    queryFn: fetchAllPosts,
    enabled: tab === 'forum',
  });

  // 역할 변경
  const rolemutation = useMutation({
    mutationFn: async ({ userId, role }) => {
      const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
    onError: (err) => toast('역할 변경 실패: ' + err.message, 'error'),
  });

  // 자료 삭제
  const deleteMaterialMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('reading_materials').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-materials'] }),
    onError: (err) => toast('삭제 실패: ' + err.message, 'error'),
  });

  // 게시물 삭제
  const deletePostMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('forum_posts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-posts'] }),
    onError: (err) => toast('삭제 실패: ' + err.message, 'error'),
  });

  // 소스 토글
  const toggleSourceMutation = useMutation({
    mutationFn: async ({ id, is_active }) => {
      const { error } = await supabase.from('content_sources').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-sources'] }),
    onError: (err) => toast('변경 실패: ' + err.message, 'error'),
  });

  // 소스 추가
  const addSourceMutation = useMutation({
    mutationFn: async (source) => {
      const { error } = await supabase.from('content_sources').insert([source]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sources'] });
      setShowAddForm(false);
      setNewSource(DEFAULT_NEW_SOURCE);
      toast('소스가 추가되었습니다.', 'success');
    },
    onError: (err) => toast('추가 실패: ' + err.message, 'error'),
  });

  // 소스 삭제
  const deleteSourceMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('content_sources').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-sources'] }),
    onError: (err) => toast('삭제 실패: ' + err.message, 'error'),
  });

  const handleAddSource = () => {
    if (!newSource.name.trim()) { toast('소스 이름을 입력하세요.', 'warning'); return; }
    addSourceMutation.mutate(newSource);
  };

  const handleNewSourceChange = (field, value) => {
    setNewSource(prev => {
      const next = { ...prev, [field]: value };
      // 언어 바뀌면 config의 lang과 level도 맞춰 초기화
      if (field === 'language') {
        next.config = {
          lang: value === 'Japanese' ? 'ja' : 'simple',
          level: value === 'Japanese' ? 'N3 중급' : 'B1 중급',
        };
      }
      // source_type 바뀌면 nhk_easy는 lang 불필요
      if (field === 'source_type') {
        next.config = value === 'nhk_easy'
          ? { level: prev.config?.level || 'N3 중급' }
          : { lang: prev.language === 'Japanese' ? 'ja' : 'simple', level: prev.config?.level || 'B1 중급' };
      }
      return next;
    });
  };

  const confirmDelete = (label, onConfirm) => {
    if (window.confirm(`정말 "${label}"을(를) 삭제하시겠습니까?`)) onConfirm();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-header__title">🛡️ 관리자 대시보드</h1>
        <p className="page-header__subtitle">유저, 자료, 포럼을 관리하세요</p>
      </div>

      {/* Tabs */}
      <div className="tab-pills" style={{ marginBottom: '32px' }}>
        {[
          { key: 'users',     label: '👥 유저 관리' },
          { key: 'materials', label: '📰 자료 관리' },
          { key: 'forum',     label: '💬 포럼 관리' },
          { key: 'sources',   label: '📡 콘텐츠 소스' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`tab-pills__item ${tab === t.key ? 'tab-pills__item--primary' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 유저 관리 ── */}
      {tab === 'users' && (
        usersLoading ? <Spinner message="유저 목록 로딩 중..." /> : (
          <div className="admin-table-wrap">
            <div className="admin-table-header">
              <span>총 {users.length}명</span>
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>닉네임</th>
                  <th>역할</th>
                  <th>스트릭</th>
                  <th>마지막 접속</th>
                  <th>역할 변경</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>{u.display_name || '—'}</td>
                    <td>
                      <span className={`role-badge role-badge--${u.role}`}>
                        {u.role === 'admin' ? '🛡️ admin' : '👤 user'}
                      </span>
                    </td>
                    <td>🔥 {u.streak_count || 0}</td>
                    <td className="admin-table__muted">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString('ko-KR') : '—'}
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant={u.role === 'admin' ? 'secondary' : 'primary'}
                        disabled={rolemutation.isPending}
                        onClick={() => rolemutation.mutate({
                          userId: u.id,
                          role: u.role === 'admin' ? 'user' : 'admin'
                        })}
                      >
                        {u.role === 'admin' ? 'user로 변경' : 'admin으로 변경'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── 자료 관리 ── */}
      {tab === 'materials' && (
        matsLoading ? <Spinner message="자료 목록 로딩 중..." /> : (
          <div className="admin-table-wrap">
            <div className="admin-table-header">
              <span>총 {materials.length}건</span>
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>제목</th>
                  <th>작성자</th>
                  <th>공개 범위</th>
                  <th>분석 상태</th>
                  <th>등록일</th>
                  <th>삭제</th>
                </tr>
              </thead>
              <tbody>
                {materials.map(m => {
                  const status = m.processed_json?.status || 'idle';
                  return (
                    <tr key={m.id}>
                      <td className="admin-table__title">{m.title}</td>
                      <td>{m.owner?.display_name || '—'}</td>
                      <td>
                        <span className={`role-badge ${m.visibility === 'public' ? 'role-badge--public' : 'role-badge--private'}`}>
                          {m.visibility === 'public' ? '🌐 공개' : '🔒 비공개'}
                        </span>
                      </td>
                      <td className="admin-table__muted">{status}</td>
                      <td className="admin-table__muted">{new Date(m.created_at).toLocaleDateString('ko-KR')}</td>
                      <td>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={deleteMaterialMutation.isPending}
                          onClick={() => confirmDelete(m.title, () => deleteMaterialMutation.mutate(m.id))}
                        >
                          삭제
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ── 포럼 관리 ── */}
      {tab === 'forum' && (
        postsLoading ? <Spinner message="포럼 로딩 중..." /> : (
          <div className="admin-table-wrap">
            <div className="admin-table-header">
              <span>총 {posts.length}건</span>
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>내용</th>
                  <th>작성자</th>
                  <th>좋아요</th>
                  <th>작성일</th>
                  <th>삭제</th>
                </tr>
              </thead>
              <tbody>
                {posts.map(p => (
                  <tr key={p.id}>
                    <td className="admin-table__content">{p.content}</td>
                    <td>{p.author?.display_name || '익명'}</td>
                    <td>❤️ {p.likes_count || 0}</td>
                    <td className="admin-table__muted">{new Date(p.created_at).toLocaleDateString('ko-KR')}</td>
                    <td>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={deletePostMutation.isPending}
                        onClick={() => confirmDelete(p.content.slice(0, 20), () => deletePostMutation.mutate(p.id))}
                      >
                        삭제
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
      {/* ── 콘텐츠 소스 관리 ── */}
      {tab === 'sources' && (
        sourcesLoading ? <Spinner message="소스 목록 로딩 중..." /> : (
          <div>
            <div className="admin-table-header" style={{ marginBottom: '16px' }}>
              <span>총 {sources.length}개 소스</span>
              <Button size="sm" onClick={() => setShowAddForm(v => !v)}>
                {showAddForm ? '✕ 취소' : '＋ 소스 추가'}
              </Button>
            </div>

            {/* 추가 폼 */}
            {showAddForm && (
              <div className="card" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>새 소스 추가</h3>

                <div className="form-row">
                  <div className="form-field">
                    <label className="form-label">언어</label>
                    <select
                      className="form-input"
                      value={newSource.language}
                      onChange={e => handleNewSourceChange('language', e.target.value)}
                    >
                      <option value="Japanese">🇯🇵 Japanese</option>
                      <option value="English">🇬🇧 English</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label className="form-label">소스 타입</label>
                    <select
                      className="form-input"
                      value={newSource.source_type}
                      onChange={e => handleNewSourceChange('source_type', e.target.value)}
                    >
                      <option value="wikipedia_random">Wikipedia (랜덤)</option>
                      {newSource.language === 'Japanese' && (
                        <option value="nhk_easy">NHK Web Easy</option>
                      )}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label className="form-label">소스 이름 (표시용)</label>
                    <input
                      className="form-input"
                      placeholder="예: Simple English Wikipedia"
                      value={newSource.name}
                      onChange={e => handleNewSourceChange('name', e.target.value)}
                    />
                  </div>

                  <div className="form-field">
                    <label className="form-label">난이도</label>
                    <select
                      className="form-input"
                      value={newSource.config?.level || ''}
                      onChange={e => setNewSource(p => ({ ...p, config: { ...p.config, level: e.target.value } }))}
                    >
                      {(LEVEL_OPTIONS[newSource.language] || []).map(l => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {newSource.source_type === 'wikipedia_random' && (
                  <div className="form-field" style={{ maxWidth: '240px' }}>
                    <label className="form-label">Wikipedia 언어</label>
                    <select
                      className="form-input"
                      value={newSource.config?.lang || 'simple'}
                      onChange={e => setNewSource(p => ({ ...p, config: { ...p.config, lang: e.target.value } }))}
                    >
                      <option value="simple">Simple English (simple.wikipedia.org)</option>
                      <option value="en">English (en.wikipedia.org)</option>
                      <option value="ja">日本語 (ja.wikipedia.org)</option>
                    </select>
                  </div>
                )}

                <div>
                  <Button
                    onClick={handleAddSource}
                    disabled={addSourceMutation.isPending}
                  >
                    {addSourceMutation.isPending ? '추가 중...' : '추가'}
                  </Button>
                </div>
              </div>
            )}

            {/* 소스 목록 */}
            {['Japanese', 'English'].map(lang => {
              const langSources = sources.filter(s => s.language === lang);
              if (!langSources.length) return null;
              return (
                <div key={lang} style={{ marginBottom: '28px' }}>
                  <h3 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {lang === 'Japanese' ? '🇯🇵 Japanese' : '🇬🇧 English'}
                  </h3>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>이름</th>
                        <th>타입</th>
                        <th>난이도</th>
                        <th>Wiki 언어</th>
                        <th>상태</th>
                        <th>삭제</th>
                      </tr>
                    </thead>
                    <tbody>
                      {langSources.map(s => (
                        <tr key={s.id} style={{ opacity: s.is_active ? 1 : 0.45 }}>
                          <td style={{ fontWeight: 500 }}>{s.name}</td>
                          <td className="admin-table__muted">{SOURCE_TYPE_LABELS[s.source_type] || s.source_type}</td>
                          <td className="admin-table__muted">{s.config?.level || '—'}</td>
                          <td className="admin-table__muted">{s.config?.lang || '—'}</td>
                          <td>
                            <button
                              className={`source-toggle ${s.is_active ? 'source-toggle--on' : 'source-toggle--off'}`}
                              onClick={() => toggleSourceMutation.mutate({ id: s.id, is_active: !s.is_active })}
                              disabled={toggleSourceMutation.isPending}
                            >
                              {s.is_active ? '✅ 활성' : '⏸ 비활성'}
                            </button>
                          </td>
                          <td>
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={deleteSourceMutation.isPending}
                              onClick={() => confirmDelete(s.name, () => deleteSourceMutation.mutate(s.id))}
                            >
                              삭제
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
