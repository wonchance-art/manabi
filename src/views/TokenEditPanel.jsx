'use client';
// 단어 뜻·발음 수동 편집(링큐식, 오너 요청) — 공유 사전의 후보 중에서 선택하거나 직접
// 입력해 이 자료의 토큰에 교정으로 저장한다(processed_json + token_corrections 이력 —
// 기존 correctTokenMutation 경로 재사용). 뜻 칩에 pos 태그가 있으면 품사도 함께 교정돼
// 품사 표시(TokenPosLabel)와 어긋나지 않는다. 중국어 1자 다음자는 pinyin-pro(multiple)로
// 발음 후보를 보강한다(클라 지연 로드 — 편집을 열 때만).
import { useEffect, useMemo, useState } from 'react';
import { buildMeaningOptions, buildReadingOptions, buildTokenCorrections } from '../lib/tokenEditOptions';

export default function TokenEditPanel({ token, language, dictEntry, saving, onSave, onClose }) {
  const [meaning, setMeaning] = useState(token?.meaning || '');
  const [meaningPos, setMeaningPos] = useState(null); // 칩 선택 시 동반 교정할 pos
  const [reading, setReading] = useState(token?.furigana || '');
  const [multiReadings, setMultiReadings] = useState([]);
  // 링큐식 전역 적용 — 켜면 공유 사전(user_verified 승격)과 내 단어장에도 반영
  const [applyGlobal, setApplyGlobal] = useState(false);

  // 중국어 1자 다음자 후보(还 hái/huán 등) — pinyin-pro 지연 로드, 실패해도 직접 입력 가능
  useEffect(() => {
    let alive = true;
    if (language !== 'Chinese' || !token?.text || [...token.text].length !== 1) {
      setMultiReadings([]);
      return undefined;
    }
    (async () => {
      try {
        const { pinyin } = await import('pinyin-pro');
        const arr = pinyin(token.text, { multiple: true, toneType: 'symbol', type: 'array' }) || [];
        if (alive) setMultiReadings(arr);
      } catch { /* 후보 보강 실패 무시 */ }
    })();
    return () => { alive = false; };
  }, [language, token?.text]);

  const meaningOptions = useMemo(() => buildMeaningOptions(dictEntry, token), [dictEntry, token]);
  const readingOptions = useMemo(
    () => buildReadingOptions(dictEntry, token, multiReadings),
    [dictEntry, token, multiReadings]
  );

  // 빈 뜻 무시 규칙 포함(마감 ③) — 저장 버튼 활성 판정도 같은 함수로 정합.
  const pending = buildTokenCorrections(token, { meaning, reading, meaningPos });

  const save = () => {
    if (!pending) { onClose(); return; }
    onSave(pending, { applyGlobal });
  };

  return (
    <div
      className="token-edit"
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}
    >
      <div className="token-edit__label">뜻</div>
      {meaningOptions.length > 0 && (
        <div className="token-edit__chips">
          {meaningOptions.map((opt) => (
            <button
              key={opt.meaning}
              type="button"
              className={`token-edit__chip ${meaning === opt.meaning ? 'token-edit__chip--on' : ''}`}
              onClick={() => { setMeaning(opt.meaning); setMeaningPos(opt.pos || null); }}
            >
              {opt.meaning}
              {opt.pos ? <span className="token-edit__chip-pos">{opt.pos}</span> : null}
            </button>
          ))}
        </div>
      )}
      <input
        className="token-edit__input"
        value={meaning}
        placeholder="직접 입력"
        onChange={(e) => { setMeaning(e.target.value); setMeaningPos(null); }}
      />

      <div className="token-edit__label">발음</div>
      {readingOptions.length > 0 && (
        <div className="token-edit__chips">
          {readingOptions.map((r) => (
            <button
              key={r}
              type="button"
              className={`token-edit__chip ${reading === r ? 'token-edit__chip--on' : ''}`}
              onClick={() => setReading(r)}
            >
              {r}
            </button>
          ))}
        </div>
      )}
      <input
        className="token-edit__input"
        value={reading}
        placeholder="직접 입력"
        onChange={(e) => setReading(e.target.value)}
      />

      <label className="token-edit__global">
        <input
          type="checkbox"
          checked={applyGlobal}
          onChange={(e) => setApplyGlobal(e.target.checked)}
        />
        이 단어 전체에 적용 (사전·단어장)
      </label>

      <div className="token-edit__actions">
        <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>취소</button>
        <button type="button" className="btn btn--primary btn--sm" disabled={saving || !pending} onClick={save}>
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  );
}
