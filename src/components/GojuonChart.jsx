'use client';
import { useState } from 'react';
import { GOJUON, SET_LABELS, ALL_SETS } from '../lib/gojuon';
import { toRomaji } from '../lib/kanaRomaji';
import { useTTS } from '../lib/useTTS';

export default function GojuonChart({ kind }) {
  const { speak, supported } = useTTS();
  const table = GOJUON[kind];
  const [sel, setSel] = useState(table.basic[0][0]); // あ / ア

  const say = k => { if (supported && k) speak(k, 'Japanese'); };

  return (
    <div className="gojuon">
      {/* 포커스 패널 — 획순 폰트로 크게 + 발음 + 따라쓰기 안내 */}
      <div className="card gojuon-focus">
        <div className="gojuon-focus__stroke kana-stroke" lang="ja" aria-label={`${sel} 획순`}>{sel}</div>
        <div className="gojuon-focus__info">
          <div className="gojuon-focus__romaji">{toRomaji(sel)}</div>
          {supported && (
            <button type="button" className="gojuon-focus__tts" onClick={() => say(sel)} title="발음 듣기">▷ 발음</button>
          )}
          <p className="gojuon-focus__hint">획 순서(숫자)대로 따라 써보세요</p>
        </div>
      </div>

      {ALL_SETS.map(setKey => (
        <div key={setKey} className="gojuon-set">
          <h3 className="gojuon-set__label">{SET_LABELS[setKey]}</h3>
          <div className="gojuon-grid" style={{ gridTemplateColumns: `repeat(${table[setKey][0].length}, 1fr)` }}>
            {table[setKey].map((row, ri) => row.map((k, ci) => (
              k ? (
                <button
                  key={`${ri}-${ci}`}
                  type="button"
                  lang="ja"
                  className={`gojuon-cell${sel === k ? ' is-sel' : ''}`}
                  onClick={() => { setSel(k); say(k); }}
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
