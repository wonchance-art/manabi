'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import Spinner from '../components/Spinner';
import Button from '../components/Button';
import ConfirmModal from '../components/ConfirmModal';
import { STARTER_MATERIALS } from '../lib/starter-content';
import { analyzeText } from '../lib/analyzeText';

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

async function fetchAllPosts() {
  const { data, error } = await supabase
    .from('forum_posts')
    .select('id, content, created_at, likes_count, author:profiles(display_name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

const STARTER_TITLES = new Set(STARTER_MATERIALS.map(m => m.title));

async function fetchStarterMaterials() {
  const { data, error } = await supabase
    .from('reading_materials')
    .select('id, title, raw_text, processed_json, created_at')
    .in('title', [...STARTER_TITLES])
    .order('created_at');
  if (error) throw error;
  return data || [];
}

// ── Component ─────────────────────────────────────
export default function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const [tab, setTab] = useState('users');
  const [newSource, setNewSource] = useState(DEFAULT_NEW_SOURCE);
  const [showAddForm, setShowAddForm] = useState(false);
  const [analyzingId, setAnalyzingId] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const analyzeAbortRef = useRef(null);
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

  const { data: starterMaterials = [], isLoading: startersLoading } = useQuery({
    queryKey: ['admin-starters'],
    queryFn: fetchStarterMaterials,
    enabled: tab === 'starters',
    refetchInterval: analyzingId ? 5000 : false,
  });

  const { data: geminiStats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['admin-gemini-stats'],
    queryFn: async () => {
      const res = await fetch('/api/gemini');
      if (!res.ok) throw new Error('통계 로드 실패');
      return res.json();
    },
    enabled: tab === 'gemini',
    refetchInterval: tab === 'gemini' ? 10000 : false,
  });

  // 사전 시드 상태
  const [extraBaseFormsText, setExtraBaseFormsText] = useState('');
  const [jmdictUploadProgress, setJmdictUploadProgress] = useState(null);

  // 사전 관리 상태
  const [dictMgrQuery, setDictMgrQuery] = useState('');
  const [dictMgrSource, setDictMgrSource] = useState('');
  const [dictMgrLanguage, setDictMgrLanguage] = useState('Japanese');
  const [editingEntry, setEditingEntry] = useState(null); // { id, base_form, pos, reading, meanings }

  const { data: dictMgrData, refetch: refetchDictMgr } = useQuery({
    queryKey: ['admin-dict-mgr', dictMgrQuery, dictMgrSource, dictMgrLanguage],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const params = new URLSearchParams({ language: dictMgrLanguage, limit: '100' });
      if (dictMgrQuery) params.set('q', dictMgrQuery);
      if (dictMgrSource) params.set('source', dictMgrSource);
      const res = await fetch(`/api/admin/dictionary?${params}`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error((await res.json())?.error || 'Fetch failed');
      return res.json();
    },
    enabled: tab === 'dictmgr',
  });

  const saveDictEntryMutation = useMutation({
    mutationFn: async ({ id, updates }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/dictionary', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ id, updates }),
      });
      if (!res.ok) throw new Error((await res.json())?.error || 'Save failed');
      return res.json();
    },
    onSuccess: () => {
      refetchDictMgr();
      queryClient.invalidateQueries({ queryKey: ['admin-dict-stats'] });
      setEditingEntry(null);
      toast('항목을 저장했어요 (source: user_verified)', 'success');
    },
    onError: (err) => toast('저장 실패: ' + err.message, 'error'),
  });

  // 대시보드 종합 지표
  const { data: overview } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: async () => {
      const [
        usersRes,
        materialsRes,
        dictRes,
        vocabRes,
        readingsRes,
        writingRes,
        correctionsRes,
        pdfsRes,
        geminiStatsRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('reading_materials').select('*', { count: 'exact', head: true }),
        supabase.from('morpheme_dictionary').select('*', { count: 'exact', head: true }),
        supabase.from('user_vocabulary').select('*', { count: 'exact', head: true }),
        supabase.from('reading_progress').select('*', { count: 'exact', head: true }).eq('is_completed', true),
        supabase.from('writing_practice').select('*', { count: 'exact', head: true }),
        supabase.from('token_corrections').select('*', { count: 'exact', head: true }),
        supabase.from('uploaded_pdfs').select('*', { count: 'exact', head: true }),
        fetch('/api/gemini').then(r => r.ok ? r.json() : null).catch(() => null),
      ]);

      return {
        users: usersRes.count ?? 0,
        materials: materialsRes.count ?? 0,
        dictionary: dictRes.count ?? 0,
        vocab: vocabRes.count ?? 0,
        readings: readingsRes.count ?? 0,
        writing: writingRes.count ?? 0,
        corrections: correctionsRes.count ?? 0,
        pdfs: pdfsRes.count ?? 0,
        gemini: geminiStatsRes,
      };
    },
    enabled: tab === 'overview',
    refetchInterval: tab === 'overview' ? 15000 : false,
  });

  const deleteDictEntryMutation = useMutation({
    mutationFn: async (id) => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/admin/dictionary?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error((await res.json())?.error || 'Delete failed');
      return res.json();
    },
    onSuccess: () => {
      refetchDictMgr();
      queryClient.invalidateQueries({ queryKey: ['admin-dict-stats'] });
      toast('삭제했어요', 'info');
    },
    onError: (err) => toast('삭제 실패: ' + err.message, 'error'),
  });
  const { data: dictStats } = useQuery({
    queryKey: ['admin-dict-stats'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('morpheme_dictionary')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      const { data: bySource } = await supabase
        .from('morpheme_dictionary')
        .select('source')
        .limit(10000);
      const sourceCount = {};
      (bySource || []).forEach(r => { sourceCount[r.source] = (sourceCount[r.source] || 0) + 1; });
      return { total: count ?? 0, bySource: sourceCount };
    },
    enabled: tab === 'dict',
  });

  // JMdict JSON 파일 업로드 (청크 단위로 서버 전송)
  async function handleJmdictUpload(file) {
    if (!file) return;
    try {
      setJmdictUploadProgress({ stage: 'parse', detail: '파일 파싱 중...' });
      const text = await file.text();
      const parsed = JSON.parse(text);
      const words = parsed.words || parsed; // scriptin 포맷 or 직접 배열

      if (!Array.isArray(words)) {
        toast('올바른 JMdict JSON이 아닙니다 (words 배열 필요)', 'error');
        setJmdictUploadProgress(null);
        return;
      }

      // 서버 타임아웃 회피 — 2000개씩 청크로 전송
      const { data: { session } } = await supabase.auth.getSession();
      const CHUNK = 2000;
      let totalInserted = 0, totalKo = 0, totalEn = 0;

      for (let i = 0; i < words.length; i += CHUNK) {
        const slice = words.slice(i, i + CHUNK);
        setJmdictUploadProgress({
          stage: 'upload',
          detail: `${i + slice.length}/${words.length} 전송 중...`,
        });

        const res = await fetch('/api/admin/import-jmdict', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ words: slice, commonOnly: true, preferKorean: true }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || '업로드 실패');

        totalInserted += json.inserted || 0;
        totalKo += json.koreanGlossCount || 0;
        totalEn += json.englishGlossCount || 0;
      }

      setJmdictUploadProgress(null);
      queryClient.invalidateQueries({ queryKey: ['admin-dict-stats'] });
      toast(
        `📚 JMdict 임포트 완료! 총 ${totalInserted}개 (한국어 ${totalKo} · 영어 ${totalEn})`,
        'success', 10000,
      );
    } catch (err) {
      setJmdictUploadProgress(null);
      toast('임포트 실패: ' + err.message, 'error');
    }
  }

  const seedDictMutation = useMutation({
    mutationFn: async ({ includeCore = true, includeCommon = false, extraOnly = false } = {}) => {
      const { data: { session } } = await supabase.auth.getSession();
      const extraBaseForms = extraBaseFormsText.split('\n').map(s => s.trim()).filter(Boolean);
      const res = await fetch('/api/admin/seed-dictionary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          includeCore: extraOnly ? false : includeCore,
          includeCommon: extraOnly ? false : includeCommon,
          extraBaseForms,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '시드 실패');
      return json;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-dict-stats'] });
      toast(
        `시드 완료! 전체 ${data.total} · 기존 ${data.skipped} · 신규 ${data.inserted} · 실패 ${data.failed || 0}`,
        data.inserted === 0 ? 'warning' : 'success', 10000,
      );
      if (data.errors && data.errors.length > 0) {
        console.error('[seed errors]', data.errors);
        const first = data.errors[0];
        toast(
          `에러(${first.stage}): ${first.error?.slice(0, 200)}`,
          'error', 15000,
        );
      }
      setExtraBaseFormsText('');
    },
    onError: (err) => toast('시드 실패: ' + err.message, 'error'),
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

  // 스타터 콘텐츠 시딩
  const seedStartersMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/seed-starters', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '시딩 실패');
      return json;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-starters'] });
      toast(data.inserted > 0
        ? `${data.inserted}개 스타터 자료가 추가됐습니다.`
        : data.message, 'success');
    },
    onError: (err) => toast('시딩 실패: ' + err.message, 'error'),
  });

  // 일괄 분석 상태
  const [bulkProgress, setBulkProgress] = useState(null); // { current, total, currentTitle }

  async function handleBulkAnalyzeStarters() {
    if (analyzingId || bulkProgress) return;

    // 미완료(idle, failed, partial, analyzing) 스타터 필터
    const pending = starterMaterials.filter(m => {
      const s = m.processed_json?.status;
      return s !== 'completed';
    });

    if (pending.length === 0) {
      toast('분석 대기 중인 스타터가 없습니다.', 'info');
      return;
    }

    setBulkProgress({ current: 0, total: pending.length, currentTitle: '' });

    let completed = 0;
    let failed = 0;

    for (let i = 0; i < pending.length; i++) {
      const material = pending[i];
      const starterMeta = STARTER_MATERIALS.find(m => m.title === material.title);
      if (!starterMeta) continue;

      setBulkProgress({ current: i, total: pending.length, currentTitle: material.title });

      const controller = new AbortController();
      analyzeAbortRef.current = controller;
      setAnalyzingId(material.id);

      try {
        await supabase
          .from('reading_materials')
          .update({ processed_json: { ...material.processed_json, status: 'analyzing' } })
          .eq('id', material.id);

        await analyzeText(material.raw_text || starterMeta.raw_text, controller.signal, {
          metadata: { language: starterMeta.language, level: starterMeta.level, updated_at: new Date().toISOString() },
          onBatch: async ({ currentJson }) => {
            await supabase.from('reading_materials').update({ processed_json: currentJson }).eq('id', material.id);
          },
        });
        completed++;
      } catch {
        failed++;
      } finally {
        setAnalyzingId(null);
        analyzeAbortRef.current = null;
      }
    }

    queryClient.invalidateQueries({ queryKey: ['admin-starters'] });
    queryClient.invalidateQueries({ queryKey: ['admin-dict-stats'] });
    setBulkProgress(null);
    toast(
      `일괄 분석 완료: 성공 ${completed} / 실패 ${failed}. 사전도 자동 갱신됐어요.`,
      failed > 0 ? 'warning' : 'success',
      7000,
    );
  }

  // 개별 스타터 분석 실행
  async function handleAnalyzeStarter(material) {
    if (analyzingId) return;
    const starterMeta = STARTER_MATERIALS.find(m => m.title === material.title);
    if (!starterMeta) return;

    const controller = new AbortController();
    analyzeAbortRef.current = controller;
    setAnalyzingId(material.id);

    try {
      await supabase
        .from('reading_materials')
        .update({ processed_json: { ...material.processed_json, status: 'analyzing' } })
        .eq('id', material.id);

      await analyzeText(material.raw_text || starterMeta.raw_text, controller.signal, {
        metadata: { language: starterMeta.language, level: starterMeta.level, updated_at: new Date().toISOString() },
        onBatch: async ({ currentJson }) => {
          await supabase
            .from('reading_materials')
            .update({ processed_json: currentJson })
            .eq('id', material.id);
        },
      });

      queryClient.invalidateQueries({ queryKey: ['admin-starters'] });
      toast(`"${material.title}" 분석 완료`, 'success');
    } catch {
      toast(`"${material.title}" 분석 실패`, 'error');
    } finally {
      setAnalyzingId(null);
      analyzeAbortRef.current = null;
    }
  }

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
        <p className="page-header__subtitle">유저, 자료, 포럼을 관리하세요</p>
      </div>

      {/* Tabs */}
      <div className="tab-pills" style={{ marginBottom: '32px' }}>
        {[
          { key: 'overview',  label: '📊 대시보드' },
          { key: 'users',     label: '👥 유저 관리' },
          { key: 'materials', label: '📰 자료 관리' },
          { key: 'forum',     label: '💬 포럼 관리' },
          { key: 'sources',   label: '📡 콘텐츠 소스' },
          { key: 'starters',  label: '🌱 스타터 콘텐츠' },
          { key: 'gemini',    label: '✨ Gemini 통계' },
          { key: 'dict',      label: '📖 사전 시드' },
          { key: 'dictmgr',   label: '🔍 사전 관리' },
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

      {/* ── 대시보드 ── */}
      {tab === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: '👥 유저', value: overview?.users, color: 'var(--primary)' },
              { label: '📰 자료', value: overview?.materials, color: 'var(--primary)' },
              { label: '📚 PDF', value: overview?.pdfs, color: 'var(--primary)' },
              { label: '📖 사전 항목', value: overview?.dictionary, color: 'var(--accent)' },
              { label: '⭐ 수집 단어', value: overview?.vocab, color: 'var(--accent)' },
              { label: '✅ 완독 기록', value: overview?.readings, color: 'var(--accent)' },
              { label: '✍️ 쓰기 기록', value: overview?.writing, color: 'var(--accent)' },
              { label: '✏️ AI 교정', value: overview?.corrections, color: 'var(--warning)' },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: 14 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: s.color }}>
                  {s.value ?? '…'}
                </div>
              </div>
            ))}
          </div>

          {/* Gemini 건강도 */}
          {overview?.gemini && (
            <div className="card" style={{ padding: 16, marginBottom: 16 }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 12px' }}>✨ AI 엔진 상태</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                <div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>총 요청</div><div style={{ fontWeight: 700 }}>{overview.gemini.total}</div></div>
                <div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>에러율</div><div style={{ fontWeight: 700, color: overview.gemini.errorRatePct > 5 ? 'var(--danger)' : 'var(--accent)' }}>{overview.gemini.errorRatePct}%</div></div>
                <div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>평균 레이턴시</div><div style={{ fontWeight: 700 }}>{overview.gemini.avgLatencyMs}ms</div></div>
                <div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Groq 구원</div><div style={{ fontWeight: 700, color: overview.gemini.groqConfigured ? 'var(--accent)' : 'var(--text-muted)' }}>{overview.gemini.groqUsed ?? 0}{!overview.gemini.groqConfigured && ' (off)'}</div></div>
              </div>
            </div>
          )}

          {/* 건강도 진단 */}
          <div className="card" style={{ padding: 16 }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 12px' }}>🩺 상태 체크</h3>
            <ul style={{ fontSize: '0.88rem', lineHeight: 1.8, margin: 0, paddingLeft: 18 }}>
              {overview?.dictionary < 500 && (
                <li style={{ color: 'var(--warning)' }}>사전이 비어 있어요 ({overview?.dictionary}). '사전 시드'에서 Core + Common 추천</li>
              )}
              {overview?.dictionary >= 500 && overview?.dictionary < 5000 && (
                <li style={{ color: 'var(--text-primary)' }}>기본 사전 확보 ({overview?.dictionary}). JMdict 임포트로 대폭 확장 가능</li>
              )}
              {overview?.dictionary >= 5000 && (
                <li style={{ color: 'var(--accent)' }}>✅ 사전 풍부 ({overview?.dictionary})</li>
              )}

              {overview?.gemini && overview.gemini.errorRatePct > 10 && (
                <li style={{ color: 'var(--danger)' }}>AI 엔진 에러율 높음 ({overview.gemini.errorRatePct}%). Groq 폴백 활성화 권장</li>
              )}
              {overview?.gemini && !overview.gemini.groqConfigured && (
                <li style={{ color: 'var(--text-muted)' }}>Groq 폴백 미설정 (선택). GROQ_API_KEY 추가 시 Gemini 과부하 자동 전환</li>
              )}

              {overview?.users === 0 && (
                <li style={{ color: 'var(--warning)' }}>사용자 없음 — 실사용 전 단계</li>
              )}
              {overview?.materials === 0 && (
                <li style={{ color: 'var(--warning)' }}>자료 없음 — 스타터 시딩 필요</li>
              )}
            </ul>
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
      {/* ── 스타터 콘텐츠 ── */}
      {tab === 'starters' && (
        startersLoading ? <Spinner message="스타터 목록 로딩 중..." /> : (
          <div>
            <div className="admin-table-header" style={{ marginBottom: '20px' }}>
              <div>
                <span style={{ fontWeight: 600 }}>{starterMaterials.length} / {STARTER_MATERIALS.length}개 시딩됨</span>
                {starterMaterials.length < STARTER_MATERIALS.length && (
                  <span style={{ marginLeft: '12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {STARTER_MATERIALS.length - starterMaterials.length}개 미삽입
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  size="sm"
                  disabled={seedStartersMutation.isPending || starterMaterials.length >= STARTER_MATERIALS.length}
                  onClick={() => seedStartersMutation.mutate()}
                >
                  {seedStartersMutation.isPending ? '시딩 중...' : '🌱 스타터 시딩'}
                </Button>
                <Button
                  size="sm"
                  variant="accent"
                  disabled={!!analyzingId || !!bulkProgress || starterMaterials.length === 0}
                  onClick={handleBulkAnalyzeStarters}
                  title="미완료 스타터를 전부 분석하고 공유 사전에 자동 저장"
                >
                  {bulkProgress
                    ? `⚙ ${bulkProgress.current}/${bulkProgress.total}`
                    : '⚡ 전체 분석 + 사전 시드'}
                </Button>
              </div>
            </div>

            {/* 일괄 분석 진행률 */}
            {bulkProgress && (
              <div className="card" style={{ padding: 14, marginBottom: 16, background: 'var(--primary-glow)', border: '1px solid var(--primary)' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: 6 }}>
                  📖 {bulkProgress.currentTitle || '준비 중...'}
                </div>
                <div style={{ height: 6, background: 'var(--bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    width: `${(bulkProgress.current / bulkProgress.total) * 100}%`,
                    height: '100%',
                    background: 'var(--primary-light)',
                    transition: 'width 0.3s',
                  }} />
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  {bulkProgress.current} / {bulkProgress.total} 완료 · 각 자료 분석 중 공유 사전 자동 갱신
                </div>
              </div>
            )}

            {/* 분석 대기 중인 항목 요약 */}
            {(() => {
              const seededTitles = new Set(starterMaterials.map(m => m.title));
              const unseeded = STARTER_MATERIALS.filter(m => !seededTitles.has(m.title));
              const idleCount = starterMaterials.filter(m => {
                const s = m.processed_json?.status;
                return s === 'idle' || s === 'failed';
              }).length;
              const completedCount = starterMaterials.filter(m => m.processed_json?.status === 'completed').length;

              return (
                <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
                  {[
                    { label: '✅ 분석 완료', count: completedCount, color: 'var(--success)' },
                    { label: '⏳ 분석 대기', count: idleCount, color: 'var(--warning)' },
                    { label: '🔄 분석 중', count: starterMaterials.filter(m => m.processed_json?.status === 'analyzing').length, color: 'var(--info)' },
                    { label: '❌ 미삽입', count: unseeded.length, color: 'var(--text-muted)' },
                  ].map(({ label, count, color }) => count > 0 && (
                    <div key={label} style={{ fontSize: '0.85rem', color }}>
                      {label}: <strong>{count}</strong>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* 언어별 테이블 */}
            {['Japanese', 'English'].map(lang => {
              const langItems = STARTER_MATERIALS.filter(m => m.language === lang);
              return (
                <div key={lang} style={{ marginBottom: '32px' }}>
                  <h3 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {lang === 'Japanese' ? '🇯🇵 Japanese' : '🇬🇧 English'}
                  </h3>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>제목</th>
                        <th>레벨</th>
                        <th>상태</th>
                        <th>분석</th>
                      </tr>
                    </thead>
                    <tbody>
                      {langItems.map(starter => {
                        const dbMat = starterMaterials.find(m => m.title === starter.title);
                        const status = dbMat?.processed_json?.status || 'not_seeded';
                        const isThisAnalyzing = analyzingId === dbMat?.id;

                        const statusBadge = {
                          completed:  <span style={{ color: 'var(--success)', fontSize: '0.82rem' }}>✅ 완료</span>,
                          analyzing:  <span style={{ color: 'var(--info)', fontSize: '0.82rem' }}>🔄 분석 중</span>,
                          idle:       <span style={{ color: 'var(--warning)', fontSize: '0.82rem' }}>⏳ 대기</span>,
                          failed:     <span style={{ color: 'var(--danger)', fontSize: '0.82rem' }}>❌ 실패</span>,
                          not_seeded: <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>— 미삽입</span>,
                        }[status] || <span style={{ fontSize: '0.82rem' }}>{status}</span>;

                        return (
                          <tr key={starter.title}>
                            <td style={{ fontWeight: 500, maxWidth: '280px' }}>{starter.title}</td>
                            <td className="admin-table__muted" style={{ whiteSpace: 'nowrap' }}>{starter.level}</td>
                            <td>{statusBadge}</td>
                            <td>
                              {dbMat && status !== 'completed' && (
                                <Button
                                  size="sm"
                                  disabled={!!analyzingId}
                                  onClick={() => handleAnalyzeStarter(dbMat)}
                                >
                                  {isThisAnalyzing ? '분석 중...' : '분석'}
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── Gemini 통계 ── */}
      {tab === 'gemini' && (
        statsLoading ? <Spinner message="통계 로딩 중..." /> : (
          <div>
            <div className="admin-table-header" style={{ marginBottom: 20 }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                현재 서버리스 인스턴스 기준 (재시작 시 초기화) · 10초마다 자동 갱신
              </span>
              <Button size="sm" variant="ghost" onClick={() => refetchStats()}>🔄 새로고침</Button>
            </div>

            {geminiStats && (
              <>
                {/* 주요 지표 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
                  {[
                    { label: '총 요청', value: geminiStats.total, color: 'var(--primary)' },
                    { label: '성공', value: geminiStats.ok, color: 'var(--accent)' },
                    { label: '에러', value: geminiStats.errors, color: 'var(--danger)' },
                    { label: '레이트 리밋', value: geminiStats.rateLimited, color: 'var(--warning)' },
                    { label: 'Gemini 폴백', value: geminiStats.fallbackUsed, color: 'var(--warning)' },
                    {
                      label: `Groq 구원 ${geminiStats.groqConfigured ? '' : '(미설정)'}`,
                      value: geminiStats.groqUsed ?? 0,
                      color: geminiStats.groqConfigured ? 'var(--accent)' : 'var(--text-muted)',
                    },
                    { label: '평균 레이턴시', value: `${geminiStats.avgLatencyMs}ms`, color: 'var(--text-primary)' },
                    { label: '에러율', value: `${geminiStats.errorRatePct}%`, color: geminiStats.errorRatePct > 5 ? 'var(--danger)' : 'var(--text-primary)' },
                    { label: '인스턴스 가동', value: `${geminiStats.uptimeMinutes}분`, color: 'var(--text-muted)' },
                  ].map(s => (
                    <div key={s.label} className="card" style={{ padding: 14 }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* HTTP 상태별 에러 분포 */}
                {Object.keys(geminiStats.errorByStatus || {}).length > 0 && (
                  <div className="card" style={{ padding: 16 }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 12 }}>HTTP 상태별 에러</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      {Object.entries(geminiStats.errorByStatus).map(([status, count]) => (
                        <div key={status} style={{
                          padding: '6px 14px', borderRadius: 'var(--radius-full)',
                          background: 'var(--bg-secondary)',
                          fontSize: '0.85rem',
                        }}>
                          <strong style={{ color: status.startsWith('4') ? 'var(--warning)' : 'var(--danger)' }}>
                            {status}
                          </strong>
                          : {count}회
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 16, lineHeight: 1.6 }}>
                  💡 이 통계는 <strong>현재 서버리스 인스턴스 메모리</strong>에만 저장됩니다.
                  Vercel 등 서버리스 환경에서는 각 인스턴스가 독립적이며 재시작 시 초기화됩니다.
                  장기 추적이 필요하면 Vercel Logs나 외부 모니터링(Sentry, Axiom) 연동이 필요합니다.
                </p>
              </>
            )}
          </div>
        )
      )}

      {/* ── 사전 시드 ── */}
      {tab === 'dict' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <div className="card" style={{ padding: 14, flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>총 항목</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary)' }}>
                {dictStats?.total ?? '…'}
              </div>
            </div>
            {dictStats && Object.entries(dictStats.bySource).map(([src, count]) => (
              <div key={src} className="card" style={{ padding: 14, flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>{src}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{count}</div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 8px' }}>📖 일본어 핵심 어휘 시드</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>
              내장된 JLPT 핵심 어휘 약 180개를 Gemini로 번역해 공유 사전에 채웁니다.
              이미 있는 항목은 자동 스킵. 아래에 추가 단어를 줄바꿈으로 입력하면 함께 시드됩니다.
            </p>

            <label style={{ fontSize: '0.82rem', display: 'block', marginBottom: 6 }}>
              추가 단어 (선택, 줄바꿈으로 구분)
            </label>
            <textarea
              value={extraBaseFormsText}
              onChange={e => setExtraBaseFormsText(e.target.value)}
              placeholder="예:&#10;経済&#10;政治&#10;日常"
              style={{
                width: '100%', minHeight: 120, padding: 10,
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                fontFamily: 'monospace', fontSize: '0.85rem',
              }}
            />

            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button
                onClick={() => seedDictMutation.mutate({ includeCore: true, includeCommon: false })}
                disabled={seedDictMutation.isPending}
              >
                {seedDictMutation.isPending ? '🔄 진행 중...' : '🌱 Core 시드 (~180)'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => seedDictMutation.mutate({ includeCore: false, includeCommon: true })}
                disabled={seedDictMutation.isPending}
              >
                📘 Common 시드 (~400)
              </Button>
              <Button
                variant="accent"
                onClick={() => seedDictMutation.mutate({ includeCore: true, includeCommon: true })}
                disabled={seedDictMutation.isPending}
              >
                ⭐ 전체 시드 (Core + Common)
              </Button>
              {extraBaseFormsText.trim() && (
                <Button
                  variant="ghost"
                  onClick={() => seedDictMutation.mutate({ extraOnly: true })}
                  disabled={seedDictMutation.isPending}
                >
                  📝 추가 단어만
                </Button>
              )}
            </div>

            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 14, lineHeight: 1.6 }}>
              💡 <strong>Core</strong>: 조사·조동사·최다 빈도 단어 (먼저 하기 권장)<br />
              💡 <strong>Common</strong>: 가족·음식·장소·감정 등 일상 어휘 — Gemini 호출 400회 발생, 1~2분 소요<br />
              💡 이미 있는 항목은 자동 스킵 — 반복 실행해도 안전
            </p>
          </div>

          {/* JMdict-simplified 임포트 */}
          <div className="card" style={{ padding: 20, marginTop: 16 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 8px' }}>📚 JMdict 일괄 임포트</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.6 }}>
              <a href="https://github.com/scriptin/jmdict-simplified" target="_blank" rel="noopener" style={{ color: 'var(--primary-light)' }}>
                JMdict-simplified
              </a>의 JSON 파일을 업로드하면 공식 사전 데이터가 한번에 들어옵니다. <br />
              공용 단어(common: true)만 자동 필터 · 한국어 gloss 우선, 없으면 영어 · Gemini 호출 <strong>0회</strong>
            </p>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="file"
                accept=".json,application/json"
                disabled={!!jmdictUploadProgress}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleJmdictUpload(file);
                  e.target.value = '';
                }}
                style={{ fontSize: '0.85rem' }}
              />
              {jmdictUploadProgress && (
                <span style={{ fontSize: '0.82rem', color: 'var(--primary)' }}>
                  ⚙ {jmdictUploadProgress.detail}
                </span>
              )}
            </div>

            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.5 }}>
              💡 추천 파일: <code>jmdict-eng-common-*.json</code> (영어, 공용 단어만, ~3MB)<br />
              💡 한국어: <code>jmdict-kor-common-*.json</code> (있으면 우선 사용)<br />
              💡 라이선스: EDRDG License — 앱 사용 시 출처 표기 의무
            </p>
          </div>
        </div>
      )}

      {/* ── 사전 관리 ── */}
      {tab === 'dictmgr' && (
        <div>
          <div className="card" style={{ padding: 14, marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              value={dictMgrQuery}
              onChange={e => setDictMgrQuery(e.target.value)}
              placeholder="base_form 검색..."
              className="form-input"
              style={{ flex: 1, minWidth: 200 }}
            />
            <select
              value={dictMgrLanguage}
              onChange={e => setDictMgrLanguage(e.target.value)}
              className="settings-select"
            >
              <option value="Japanese">🇯🇵 Japanese</option>
              <option value="English">🇬🇧 English</option>
            </select>
            <select
              value={dictMgrSource}
              onChange={e => setDictMgrSource(e.target.value)}
              className="settings-select"
            >
              <option value="">모든 source</option>
              <option value="gemini">gemini</option>
              <option value="jmdict">jmdict (KR)</option>
              <option value="jmdict_en">jmdict_en (EN)</option>
              <option value="jmdict_seed">jmdict_seed</option>
              <option value="user_verified">user_verified</option>
            </select>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {dictMgrData?.total ?? 0}개 (최근 100개 표시)
            </span>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>단어</th>
                  <th>읽기</th>
                  <th>품사</th>
                  <th>의미</th>
                  <th>source</th>
                  <th>사용</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {(dictMgrData?.items || []).map(item => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600 }}>{item.base_form}</td>
                    <td className="admin-table__muted" style={{ maxWidth: 100 }}>{item.reading || '—'}</td>
                    <td className="admin-table__muted">{item.pos || '—'}</td>
                    <td style={{ fontSize: '0.82rem', maxWidth: 280 }}>
                      {(item.meanings || []).map(m => m.meaning).join(' · ') || '(없음)'}
                    </td>
                    <td>
                      <span className="role-badge" style={{
                        background: item.source === 'user_verified' ? 'rgba(74,138,92,0.15)'
                          : item.source === 'jmdict' ? 'rgba(228,120,72,0.15)'
                          : 'var(--bg-secondary)',
                        color: item.source === 'user_verified' ? 'var(--accent)'
                          : item.source === 'jmdict' ? 'var(--primary)'
                          : 'var(--text-muted)',
                      }}>
                        {item.source}
                      </span>
                    </td>
                    <td className="admin-table__muted">{item.usage_count}회</td>
                    <td>
                      <Button size="sm" variant="ghost" onClick={() => setEditingEntry({
                        ...item,
                        meaningsText: (item.meanings || []).map(m => m.meaning).join('\n'),
                      })}>
                        ✏️
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        style={{ color: 'var(--danger)' }}
                        onClick={() => confirmDelete(item.base_form, () => deleteDictEntryMutation.mutate(item.id))}
                      >
                        🗑️
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {dictMgrData?.items?.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                검색 결과 없음
              </div>
            )}
          </div>

          {/* 편집 모달 */}
          {editingEntry && (
            <div className="modal-overlay" onClick={() => setEditingEntry(null)}>
              <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                <h3 style={{ margin: '0 0 8px' }}>✏️ {editingEntry.base_form}</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                  저장 시 source가 user_verified로 승격됩니다.
                </p>

                <label style={{ fontSize: '0.82rem', display: 'block', marginBottom: 4 }}>품사</label>
                <input
                  type="text"
                  value={editingEntry.pos || ''}
                  onChange={e => setEditingEntry(s => ({ ...s, pos: e.target.value }))}
                  className="form-input"
                  style={{ marginBottom: 12 }}
                />

                <label style={{ fontSize: '0.82rem', display: 'block', marginBottom: 4 }}>읽기</label>
                <input
                  type="text"
                  value={editingEntry.reading || ''}
                  onChange={e => setEditingEntry(s => ({ ...s, reading: e.target.value }))}
                  className="form-input"
                  style={{ marginBottom: 12 }}
                />

                <label style={{ fontSize: '0.82rem', display: 'block', marginBottom: 4 }}>
                  의미 (한 줄당 하나, 위에서부터 우선순위)
                </label>
                <textarea
                  value={editingEntry.meaningsText}
                  onChange={e => setEditingEntry(s => ({ ...s, meaningsText: e.target.value }))}
                  style={{
                    width: '100%', minHeight: 100, padding: 10,
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)', fontFamily: 'monospace', fontSize: '0.85rem',
                  }}
                />

                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <Button variant="ghost" style={{ flex: 1 }} onClick={() => setEditingEntry(null)}>
                    취소
                  </Button>
                  <Button
                    style={{ flex: 2 }}
                    disabled={saveDictEntryMutation.isPending}
                    onClick={() => {
                      const meanings = editingEntry.meaningsText
                        .split('\n').map(s => s.trim()).filter(Boolean)
                        .map(m => ({ meaning: m }));
                      saveDictEntryMutation.mutate({
                        id: editingEntry.id,
                        updates: {
                          pos: editingEntry.pos,
                          reading: editingEntry.reading,
                          meanings,
                        },
                      });
                    }}
                  >
                    저장
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
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
