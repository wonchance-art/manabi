'use client';
import { useState } from 'react';
import { GOJUON, SET_LABELS, ALL_SETS } from '../lib/gojuon';
import { toRomaji } from '../lib/kanaRomaji';

export default function GojuonChart({ kind, sets = ALL_SETS }) {
  const table = GOJUON[kind];
  const setList = ALL_SETS.filter(s => sets.includes(s));

  // 처음 선택 = 주어진 세트의 첫 글자
  const firstKana = (() => {
    for (const s of setList) for (const row of table[s] || []) for (const k of row) if (k) return k;
    return table.basic[0][0];
  })();
  const [sel, setSel] = useState(firstKana);

  return (
    <div className="gojuon">
      {/* 포커스 패널 — 획순 폰트로 크게 + 따라쓰기 안내 */}
      <div className="card gojuon-focus">
        <div className="gojuon-focus__stroke kana-stroke" lang="ja" aria-label={`${sel} 획순`}>{sel}</div>
        <div className="gojuon-focus__info">
          <div className="gojuon-focus__romaji">{toRomaji(sel)}</div>
          <p className="gojuon-focus__hint">획 순서(숫자)대로 따라 써보세요</p>
        </div>
      </div>

      {setList.map(setKey => (
        <div key={setKey} className="gojuon-set">
          {setList.length > 1 && <h3 className="gojuon-set__label">{SET_LABELS[setKey]}</h3>}
          <div className="gojuon-grid" style={{ gridTemplateColumns: `repeat(${table[setKey][0].length}, 1fr)` }}>
            {table[setKey].map((row, ri) => row.map((k, ci) => (
              k ? (
                <button
                  key={`${ri}-${ci}`}
                  type="button"
                  lang="ja"
                  className={`gojuon-cell${sel === k ? ' is-sel' : ''}`}
                  onClick={() => setSel(k)}
                  aria-label={`${k} ${toRomaji(k)}`}
                >
                  <span className="gojuon-cell__kana">{k}</span>
                  <span className="gojuon-cell__romaji">{toRomaji(k)}</span>
                </button>
              ) : (
                <span key={`${ri}-${ci}`} className="gojuon-cell gojuon-cell--empty" aria-hidden="true" />
              )
            )))}
          </div>
        </div>
      ))}
    </div>
  );
}
