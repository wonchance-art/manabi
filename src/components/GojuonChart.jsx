'use client';
import { useState } from 'react';
import { GOJUON, SET_LABELS, ALL_SETS } from '../lib/gojuon';
import { toRomaji } from '../lib/kanaRomaji';
import KanaStroke from './KanaStroke';

export default function GojuonChart({ kind, sets = ALL_SETS }) {
  const table = GOJUON[kind];
  const setList = ALL_SETS.filter(s => sets.includes(s));
  // 기본 선택 = 세트의 첫 글자 (basic→あ, dakuten→が, yoon→きゃ)
  const firstKana = (() => {
    for (const s of setList) for (const row of table[s] || []) for (const k of row) if (k) return k;
    return null;
  })();
  const [sel, setSel] = useState(firstKana);
  const [playN, setPlayN] = useState(0);
  const pick = k => { setSel(k); setPlayN(n => n + 1); };

  return (
    <div className="gojuon">
      {setList.map(setKey => {
        const rows = table[setKey];
        const cols = rows[0].length;
        return (
          <div key={setKey} className="gojuon-set">
            {setList.length > 1 && <h3 className="gojuon-set__label">{SET_LABELS[setKey]}</h3>}
            <div className="gojuon-board">
              {sel && (
                <div className="gojuon-panel">
                  <div className="gojuon-panel__stroke">
                    <KanaStroke key={`${sel}-${playN}`} kana={sel} kind={kind} />
                  </div>
                  <div className="gojuon-panel__read">
                    <span className="gojuon-panel__roma">{toRomaji(sel)}</span>
                  </div>
                  <button type="button" className="gojuon-panel__replay" onClick={() => setPlayN(n => n + 1)}>다시 그리기 ↻</button>
                </div>
              )}
              <div className="gojuon-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                {rows.map((row, ri) => row.map((k, ci) => (
                  k
                    ? <Cell key={`${ri}-${ci}`} k={k} active={k === sel} onClick={() => pick(k)} />
                    : <span key={`${ri}-${ci}`} className="gojuon-cell gojuon-cell--empty" aria-hidden="true" />
                )))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Cell({ k, active, onClick }) {
  return (
    <button
      type="button"
      className={`gojuon-cell${active ? ' is-sel' : ''}`}
      onClick={onClick}
      aria-label={`${k} ${toRomaji(k)}`}
    >
      <span className="gojuon-cell__kana" lang="ja">{k}</span>
      <span className="gojuon-cell__sub">{toRomaji(k)}</span>
    </button>
  );
}
