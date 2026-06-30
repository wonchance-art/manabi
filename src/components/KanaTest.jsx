'use client';
import { useState, useRef, useEffect } from 'react';
import { kanaList, acceptedRomaji, SET_LABELS, ALL_SETS } from '../lib/gojuon';
import { toRomaji } from '../lib/kanaRomaji';
import Button from './Button';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function KanaTest({ kind, slug, storageKey }) {
  const [sets, setSets] = useState(['basic']);
  const [deck, setDeck] = useState([]);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null); // null | 'ok' | 'no'
  const [right, setRight] = useState(0);
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const inputRef = useRef(null);

  const toggleSet = s => setSets(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const start = () => {
    const list = kanaList(kind, ALL_SETS.filter(s => sets.includes(s)));
    if (!list.length) return;
    setDeck(shuffle(list));
    setIdx(0); setInput(''); setResult(null); setRight(0); setDone(false); setStarted(true);
  };

  const current = deck[idx];

  useEffect(() => { if (started && !done) inputRef.current?.focus(); }, [idx, started, done]);

  const submit = () => {
    if (!current || result) return;
    const ans = input.trim().toLowerCase().replace(/\s+/g, '');
    if (!ans) return;
    const ok = acceptedRomaji(current).has(ans);
    setResult(ok ? 'ok' : 'no');
    if (ok) setRight(r => r + 1);
  };

  const finish = (finalRight) => {
    setDone(true);
    const total = deck.length;
    const passed = total > 0 && finalRight / total >= 0.8;
    if (slug && storageKey && typeof window !== 'undefined') {
      try {
        const cur = JSON.parse(localStorage.getItem(storageKey) || '{}');
        cur[slug] = { right: finalRight, total, passed, at: Date.now() };
        localStorage.setItem(storageKey, JSON.stringify(cur));
      } catch { /* ignore */ }
    }
  };

  const next = () => {
    if (idx + 1 >= deck.length) finish(right);
    else { setIdx(i => i + 1); setInput(''); setResult(null); }
  };

  const onKeyDown = e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (result) next(); else submit();
  };

  // ── 시작 전: 범위 선택 ──
  if (!started) {
    const count = kanaList(kind, ALL_SETS.filter(s => sets.includes(s))).length;
    return (
      <div className="card kana-test">
        <h2 className="kana-test__title">카나 → 로마자 테스트</h2>
        <p className="kana-test__lead">글자를 보고 <strong>발음(로마자)</strong>을 입력하세요. 발음을 알아야 풀 수 있어요.</p>
        <div className="chip-group" style={{ justifyContent: 'center', margin: '14px 0' }}>
          {ALL_SETS.map(s => (
            <button key={s} type="button" className={`chip ${sets.includes(s) ? 'chip--active' : ''}`} onClick={() => toggleSet(s)}>
              {SET_LABELS[s]}
            </button>
          ))}
        </div>
        <div style={{ textAlign: 'center' }}>
          <Button onClick={start} disabled={count === 0}>{count}자 테스트 시작 →</Button>
        </div>
      </div>
    );
  }

  // ── 완료 ──
  if (done) {
    const total = deck.length;
    const pct = total ? Math.round((right / total) * 100) : 0;
    const passed = pct >= 80;
    return (
      <div className="card kana-test kana-test--done">
        <h2 className="kana-test__title">{passed ? '합격! 🎉' : '조금 더 연습해요'}</h2>
        <div className="kana-test__score">
          <span className={`kana-test__pct ${passed ? 'is-ok' : 'is-no'}`}>{pct}%</span>
          <span className="kana-test__frac">{right} / {total}</span>
        </div>
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Button variant="secondary" onClick={() => setStarted(false)}>범위 다시 고르기</Button>
          <Button onClick={start} style={{ marginLeft: 8 }}>다시 풀기 →</Button>
        </div>
      </div>
    );
  }

  // ── 진행 중 ──
  return (
    <div className="card kana-test">
      <div className="kana-test__bar">
        <span>{idx + 1} / {deck.length}</span>
        <span>맞은 개수 {right}</span>
      </div>

      <div className="kana-test__prompt" lang="ja">{current}</div>

      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="로마자 입력 (예: ka)"
        className={`search-input kana-test__input${result === 'ok' ? ' is-correct' : result === 'no' ? ' is-wrong' : ''}`}
        autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck="false"
        disabled={!!result}
      />

      {result === 'ok' && <p className="kana-test__feedback is-ok">정답!</p>}
      {result === 'no' && <p className="kana-test__feedback is-no">정답: <strong>{toRomaji(current)}</strong></p>}

      <div style={{ textAlign: 'center', marginTop: 14 }}>
        {result
          ? <Button onClick={next}>{idx + 1 >= deck.length ? '결과 보기 →' : '다음 →'}</Button>
          : <Button onClick={submit} disabled={!input.trim()}>확인</Button>}
      </div>
    </div>
  );
}
