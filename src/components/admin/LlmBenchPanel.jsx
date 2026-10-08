'use client';
// 모델 비교 측정 화면(LLM-BENCH-001) — 모델을 하나씩 차례로 측정해 표로 보여 주고, 결과 JSON을 복사해 #1337에 붙일 수 있게 한다.
// 쓰기 0: 서버는 호출 결과를 응답으로만 돌려준다.
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

async function authed(path, init = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  return body;
}

const pass = (v) => (v ? `${v.PASS || 0}/${Object.values(v).reduce((a, b) => a + b, 0)}` : '—');
const sec = (ms) => (ms == null ? '—' : `${(ms / 1000).toFixed(1)}초`);

export default function LlmBenchPanel() {
  const [models, setModels] = useState([]);
  const [results, setResults] = useState({});
  const [running, setRunning] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => { authed('/api/admin/llm-bench').then((b) => setModels(b.models)).catch((e) => setError(e.message)); }, []);

  const run = async () => {
    setError(''); setCopied(false);
    for (const m of models.filter((x) => x.configured)) {
      setRunning(m.label);
      try {
        const { result, at, commit } = await authed('/api/admin/llm-bench', { method: 'POST', body: JSON.stringify({ model: m.id }) });
        setResults((r) => ({ ...r, [m.id]: { ...result, at, commit } }));
      } catch (e) {
        setResults((r) => ({ ...r, [m.id]: { model: m.id, label: m.label, error: e.message } }));
      }
    }
    setRunning('');
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(JSON.stringify({ id: 'LLM-BENCH-001', results: Object.values(results) })); setCopied(true); } catch { setError('복사하지 못했어요. 브라우저 권한을 확인해 주세요.'); }
  };

  return (
    <main className="container" style={{ padding: '24px 16px', maxWidth: 1080 }}>
      <h1 style={{ fontSize: '1.3rem', fontWeight: 800 }}>모델 비교 측정</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.6 }}>
        같은 고정 입력(ZH 뜻 고르기 14문단 · 단어 뜻 생성 2묶음 · 문장 번역 3)을 모델마다 한 번씩 보냅니다. 학습 기록·사전에는 쓰지 않습니다.
        모델당 약 19회 호출, 비용은 모델당 수 센트 이하입니다.
      </p>
      <ul style={{ fontSize: '0.85rem', margin: '12px 0' }}>
        {models.map((m) => <li key={m.id}>{m.configured ? '✅' : '⛔'} {m.label} <span style={{ color: 'var(--text-muted)' }}>{m.configured ? '' : `(${m.env} 없음 — 건너뜀)`}</span></li>)}
      </ul>
      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        <button type="button" className="btn btn--primary" disabled={!!running || !models.some((m) => m.configured)} onClick={run}>{running ? `측정 중… ${running}` : '측정 시작'}</button>
        <button type="button" className="btn btn--ghost" disabled={!Object.keys(results).length || !!running} onClick={copy}>{copied ? '복사했어요' : '결과 JSON 복사'}</button>
      </div>
      {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
      {Object.keys(results).length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
            <thead><tr>{['모델', '호출 성공', 'p50', 'p95', '뜻 고르기 PASS(후보 있음)', 'PASS(전체)', '단어 뜻 형식', '번역 형식', '토큰 입·출', '추정 비용'].map((h) => <th key={h} style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid var(--border)' }}>{h}</th>)}</tr></thead>
            <tbody>
              {Object.values(results).map((r) => (
                <tr key={r.model}>
                  <td style={{ padding: 6 }}>{r.label || r.model}</td>
                  {r.error ? <td colSpan={9} style={{ padding: 6, color: 'var(--danger)' }}>{r.error}</td> : <>
                    <td style={{ padding: 6 }}>{r.calls.ok}/{r.calls.total}</td>
                    <td style={{ padding: 6 }}>{sec(r.calls.p50)}</td>
                    <td style={{ padding: 6 }}>{sec(r.calls.p95)}</td>
                    <td style={{ padding: 6 }}>{pass(r.zhSense.verdicts.offered)}</td>
                    <td style={{ padding: 6 }}>{pass(r.zhSense.verdicts.all)}</td>
                    <td style={{ padding: 6 }}>{r.meanings.valid}/{r.meanings.total}</td>
                    <td style={{ padding: 6 }}>{r.translate.valid}/{r.translate.total}</td>
                    <td style={{ padding: 6 }}>{r.tokens.in.toLocaleString()} · {(r.tokens.out + r.tokens.thinking).toLocaleString()}</td>
                    <td style={{ padding: 6 }}>${r.costUsd}</td>
                  </>}
                </tr>
              ))}
            </tbody>
          </table>
          {Object.values(results).filter((r) => r.translate).map((r) => (
            <details key={`${r.model}-tx`} style={{ marginTop: 8, fontSize: '0.82rem' }}>
              <summary>{r.label} 번역 보기</summary>
              <ul>{r.translate.items.map((t) => <li key={t.sentence}>{t.sentence} → {t.translation || '(형식 밖)'}</li>)}</ul>
            </details>
          ))}
        </div>
      )}
    </main>
  );
}
