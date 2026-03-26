'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import Spinner from '../components/Spinner';
import Button from '../components/Button';

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
    </div>
  );
}
