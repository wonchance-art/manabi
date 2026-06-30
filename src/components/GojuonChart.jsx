'use client';
import { useState } from 'react';
import { GOJUON, SET_LABELS, ALL_SETS, koReading } from '../lib/gojuon';
import { toRomaji } from '../lib/kanaRomaji';
import KanaStroke from './KanaStroke';

export default function GojuonChart({ kind, sets = ALL_SETS }) {
  const table = GOJUON[kind];
  const setList = ALL_SETS.filter(s => sets.includes(s));
  const [modal, setModal] = useState(null); // 선택 가나
  const [playN, setPlayN] = useState(0);

  const open = k => { setModal(k); setPlayN(0); };

  return (
    <div className="gojuon">
      {setList.map(setKey => {
        const rows = table[setKey];
        const cols = rows[0].length;
        const single = rows.filter(r => r.filter(Boolean).length === 1).flat().filter(Boolean); // ん 등
        const gridRows = rows.filter(r => r.filter(Boolean).length !== 1);
        return (
          <div key={setKey} className="gojuon-set">
            {setList.length > 1 && <h3 className="gojuon-set__label">{SET_LABELS[setKey]}</h3>}
            <div className="gojuon-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
              {gridRows.map((row, ri) => row.map((k, ci) => (
                k
                  ? <Cell key={`${ri}-${ci}`} k={k} onClick={() => open(k)} />
                  : <span key={`${ri}-${ci}`} className="gojuon-cell gojuon-cell--empty" aria-hidden="true" />
              )))}
            </div>
            {single.length > 0 && (
              <div className="gojuon-single">
                {single.map(k => <Cell key={k} k={k} onClick={() => open(k)} />)}
              </div>
            )}
          </div>
        );
      })}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)} role="dialog" aria-modal="true">
          <div className="modal kana-modal" onClick={e => e.stopPropagation()}>
            <button className="kana-modal__close" onClick={() => setModal(null)} aria-label="닫기">✕</button>
            <div className="kana-modal__stroke">
              <KanaStroke key={`${modal}-${playN}`} kana={modal} kind={kind} />
            </div>
            <div className="kana-modal__read">
              <span className="kana-modal__ko">{koReading(modal)}</span>
              <span className="kana-modal__roma">{toRomaji(modal)}</span>
            </div>
            <p className="kana-modal__hint">획 순서대로 따라 써보세요</p>
            <div className="kana-modal__actions">
              <button className="btn btn--ghost btn--sm" onClick={() => setPlayN(n => n + 1)}>다시 그리기 ↻</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Cell({ k, onClick }) {
  return (
    <button type="button" className="gojuon-cell" onClick={onClick} aria-label={`${k} ${koReading(k)} ${toRomaji(k)}`}>
      <span className="gojuon-cell__kana" lang="ja">{k}</span>
      <span className="gojuon-cell__sub">{koReading(k)} · {toRomaji(k)}</span>
    </button>
  );
}
