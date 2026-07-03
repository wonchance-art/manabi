'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import Spinner from '../components/Spinner';
import Button from '../components/Button';
import ConfirmModal from '../components/ConfirmModal';
import StudyPlanPanel from './StudyPlanPanel';

const SOURCE_TYPE_LABELS = {
  wikipedia_good:   'Wikipedia 우수 기사',
  wikinews:         'Wikinews (시사)',
  wikipedia_random: 'Wikipedia (랜덤)',
  nhk_easy:         'NHK Web Easy',
};

const LEVEL_OPTIONS = {
  Japanese: ['N5 기초', 'N4 기본', 'N3 중급', 'N2 상급', 'N1 심화'],
  English:  ['A1 기초', 'A2 초급', 'B1 중급', 'B2 상급', 'C1 고급'],
};

const DEFAULT_NEW_SOURCE = {
  language: 'Japanese',
  source_type: 'wikipedia_good',
  name: '',
  config: { lang: 'ja', level: 'N2 상급' },
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

// ── Component ─────────────────────────────────────
export default function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const [tab, setTab] = useState('users');
  const [newSource, setNewSource] = useState(DEFAULT_NEW_SOURCE);
  const [showAddForm, setShowAddForm] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
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
      // wikinews는 lang 불필요
      if (field === 'source_type') {
        next.config = value === 'wikinews'
          ? { level: prev.config?.level || 'B2 상급' }
          : { lang: prev.language === 'Japanese' ? 'ja' : 'simple', level: prev.config?.level || 'B1 중급' };
      }
      return next;
    });
  };

  const confirmDelete = (label, onConfirm) => {
    setConfirmAction({
      message: `정말 "${label}"을(를) 삭제하시겠습니까?`,
      onConfirm: () => { onConfirm(); setConfirmAction(null); },
    });
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-header__title">🛡️ 관리자 대시보드</h1>
        <p className="page-header__subtitle">유저·자료·콘텐츠를 관리하세요</p>
      </div>

      {/* Tabs */}
      <div className="tab-pills" style={{ marginBottom: '32px' }}>
        {[
          { key: 'myplan',    label: '📅 내 진도' },
          { key: 'users',     label: '👥 유저 관리' },
          { key: 'materials', label: '📰 자료 관리' },
          { key: 'sources',   label: '📡 콘텐츠 소스' },
          { key: 'features',  label: '🧪 신기능' },
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

      {/* ── 내 진도 (관리자 전용 학습 진도표) ── */}
      {tab === 'myplan' && <StudyPlanPanel />}

      {/* ── 신기능 — 관리자용 바로가기 (학습 기능은 네비 '학습' 탭에 정식 배치됨) ── */}
      {tab === 'features' && (
        <div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
            학습 기능은 네비게이션 «학습» 탭에 정식 배치됐어요. 여기는 관리자용 바로가기 —
            지표 대시보드와 개인 코스 진입로를 겸해요.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              {
                href: '/admin/metrics',
                icon: '📊',
                title: '학습 지표 — 본인 데이터 기준',
                desc: '관리자 본인의 학습 이벤트를 집계한 대시보드 — D1/D7 재인률, 불량 문항 후보, rung 분포·산출 게이트, 응답시간, 일별 정답률, 세션 완주율, 프리페치 전환율, 어시스트 상위. (own-only RLS라 본인 데이터만)',
              },
              {
                href: '/study',
                icon: '🎯',
                title: '오늘 학습 (공부 모드)',
                desc: '메인 학습 세션 — 매일 생성되는 이야기 한 편에서 어휘·문법·독해·듣기·격일 작문까지 ~10문항. 통과한 챕터는 자동으로 복습 큐에.',
              },
              {
                href: '/study/library',
                icon: '📚',
                title: '다시 읽기 서재 + 성장 요약',
                desc: '지난 «오늘의 문단»을 어시스트(요미가나) 없이 원문만으로 다시 읽으며 성장을 체감. 상단엔 아는 단어·통과 챕터·이번 주 세션 요약 타일.',
              },
              {
                href: '/review/grammar',
                icon: '🔁',
                title: '문법 SRS 복습',
                desc: '패턴 체크를 통과한 챕터가 FSRS 스케줄로 되돌아오는 복습 큐. 챕터별 미니 퀴즈로 재확인하고 정답률에 따라 다음 복습일이 조정돼요.',
              },
              {
                href: '/writing',
                icon: '✍️',
                title: '라이팅 스튜디오',
                desc: '배운 문법·주제·자유 작문을 AI가 한국인 학습자 눈높이로 첨삭. 오류는 약점 진단 데이터로 쌓여요. (4개 언어)',
              },
              {
                href: '/nihongo',
                icon: '🎌',
                title: '니혼고 42 코스',
                desc: '주소로만 접근하던 숨겨진 커뮤니티 일본어 코스 — 하루 3챕터 × 14일, 표현 42개.',
              },
            ].map(f => (
              <Link key={f.href} href={f.href} className="card" style={{ padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1.5rem' }} aria-hidden="true">{f.icon}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <strong style={{ fontSize: '0.95rem' }}>{f.title}</strong>
                  </span>
                  <span style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.desc}</span>
                  <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6, fontFamily: 'monospace' }}>{f.href}</span>
                </span>
                <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>→</span>
              </Link>
            ))}
          </div>
        </div>
      )}

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
                      <td className="admin-table__muted">
                        {{ idle: '⏳ 대기', analyzing: '🔄 분석 중', completed: '✅ 완료', failed: '❌ 실패' }[status] || status}
                      </td>
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
                      <option value="wikipedia_good">Wikipedia 우수 기사</option>
                      <option value="wikinews">Wikinews (시사)</option>
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

      <ConfirmModal
        open={!!confirmAction}
        message={confirmAction?.message}
        onConfirm={confirmAction?.onConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
