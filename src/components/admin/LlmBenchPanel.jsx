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
  const [quality, setQuality] = useState({}); // 품질 세트(LLM-BENCH-QUALITY-001) — 모델마다 따로 부른다(함수 시간 상한)
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
      setRunning(`${m.label} · 품질 세트`);
      try {
        const { result, at, commit } = await authed('/api/admin/llm-bench', { method: 'POST', body: JSON.stringify({ model: m.id, set: 'quality' }) });
        setQuality((r) => ({ ...r, [m.id]: { ...result, at, commit } }));
      } catch (e) {
        setQuality((r) => ({ ...r, [m.id]: { model: m.id, label: m.label, set: 'quality', error: e.message } }));
      }
    }
    setRunning('');
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(JSON.stringify({ id: 'LLM-BENCH-001', results: Object.values(results), quality: Object.values(quality) })); setCopied(true); } catch { setError('복사하지 못했어요. 브라우저 권한을 확인해 주세요.'); }
  };

  return (
    <main className="container" style={{ padding: '24px 16px', maxWidth: 1080 }}>
      <h1 style={{ fontSize: '1.3rem', fontWeight: 800 }}>모델 비교 측정</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.6 }}>
        같은 고정 입력(ZH 뜻 고르기 14문단 · 단어 뜻 생성 2묶음 · 문장 번역 3)을 모델마다 한 번씩 보내요. 학습 기록·사전에는 쓰지 않아요.
        모델당 약 19회 호출, 비용은 모델당 수 센트 이하예요(Sonnet 5.5는 수십 센트).
        품질 세트(회화 턴 5 · 작문 첨삭 5 · 오늘의 문단 3)도 모델마다 한 번씩 보내요. 운영 프롬프트와 같은 요청이고, 사례는 지은 문장이에요.
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
      {Object.keys(quality).length > 0 && <QualityTable quality={quality} />}
    </main>
  );
}

const passOf = (x) => (x ? `${x.pass}/${x.total}` : '—');
const failed = (item) => Object.entries(item.checks || {}).filter(([, v]) => v !== true).map(([k]) => k).join(' · ');

/** 품질 세트 표 — 기계 판정(통과 수 · 어긴 검사 이름) + 사람이 읽는 줄. */
function QualityTable({ quality }) {
  const rows = Object.values(quality);
  return (
    <div style={{ overflowX: 'auto', marginTop: 16 }}>
      <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>품질 세트</h2>
      <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
        <thead><tr>{['모델', '호출 성공', 'p50', 'p95', '회화 통과', '첨삭 통과', '문단 통과', '토큰 입·출', '추정 비용'].map((h) => <th key={h} style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid var(--border)' }}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.model}>
              <td style={{ padding: 6 }}>{r.label || r.model}</td>
              {r.error ? <td colSpan={8} style={{ padding: 6, color: 'var(--danger)' }}>{r.error}</td> : <>
                <td style={{ padding: 6 }}>{r.calls.ok}/{r.calls.total}</td>
                <td style={{ padding: 6 }}>{sec(r.calls.p50)}</td>
                <td style={{ padding: 6 }}>{sec(r.calls.p95)}</td>
                <td style={{ padding: 6 }}>{passOf(r.conversation)}</td>
                <td style={{ padding: 6 }}>{passOf(r.writing)}</td>
                <td style={{ padding: 6 }}>{passOf(r.paragraph)}</td>
                <td style={{ padding: 6 }}>{r.tokens.in.toLocaleString()} · {(r.tokens.out + r.tokens.thinking).toLocaleString()}</td>
                <td style={{ padding: 6 }}>${r.costUsd}</td>
              </>}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.filter((r) => !r.error).map((r) => (
        <details key={`${r.model}-quality`} style={{ marginTop: 8, fontSize: '0.82rem' }}>
          <summary>{r.label} 품질 세트 읽기</summary>
          {['conversation', 'writing', 'paragraph'].map((kind) => (
            <ul key={kind}>
              {r[kind].items.map((item) => (
                <li key={item.id} style={{ marginBottom: 6 }}>
                  <strong>{item.pass ? '통과' : '어긋남'}</strong> {item.id}{item.pass ? '' : ` — ${failed(item)}`}
                  <ul>{Object.entries(item.read || {}).map(([k, v]) => <li key={k}>{k}: {Array.isArray(v) ? v.join(' / ') : (v && typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—'))}</li>)}</ul>
                </li>
              ))}
            </ul>
          ))}
        </details>
      ))}
    </div>
  );
}
