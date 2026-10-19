'use client';
// 찾기 결과(문서 「찾기 (전 레벨 사전)」) — 「N개 · HSK 1–7 전체에서」(JLPT N5–N1), 구역 「현재 레벨 · HSK n」 → 「다른 레벨」(구역마다 개수).
// 줄 형식 + 상태 칸 그대로라 ☆로 바로 담고, 누르면 단어 카드. 결과가 많으면 구역마다 처음 60줄만 그리고 「더 보기」.
import { useState } from 'react';
import { WordRow } from './WordParts';
import { useWordLang } from './wordLang';

const PAGE = 60;

function Section({ title, rows, statusOf, onSave, savingKey, popKey, onOpen, tone }) {
  const [limit, setLimit] = useState(PAGE);
  if (!rows.length) return null;
  return <section aria-label={title}>
    <h2>{title}<span>{rows.length}</span></h2>
    <ul>{rows.slice(0, limit).map((r) => <li key={`${r.level}:${r.word}`}>
      <WordRow word={r.word} reading={r.reading} meaning={r.meaning} level={r.level} status={statusOf(r.word)} tone={tone}
        onSave={() => onSave(r)} saving={savingKey === r.word} pop={popKey === r.word} onOpen={() => onOpen(r)} />
    </li>)}</ul>
    {rows.length > limit && <div className="lw-more"><button type="button" onClick={() => setLimit((n) => n + PAGE)}>더 보기 · {rows.length - limit}개</button></div>}
  </section>;
}

export function WordSearchResults({ query, result, level, loading, fallback, statusOf, onSave, savingKey, popKey, onOpen, tone }) {
  const L = useWordLang();
  if (!query.trim()) return <div className="lw-results"><p className="lw-results__status">{L.searchHint}</p></div>;
  if (loading && !result) return <div className="lw-results"><p className="lw-results__status" aria-busy="true">사전을 받는 중…</p></div>;
  if (!result?.total) {
    return <div className="lw-results" role="status"><div className="lw-results__none"><b>맞는 단어가 없어요</b>
      <span>{L.noneHint}</span></div></div>;
  }
  return <div className="lw-results">
    <p className="lw-results__status" role="status">{result.total}개 · {fallback ? `${L.tag(level)} 안에서` : `${L.scope}에서`}</p>
    <Section key={`c:${query}`} title={`현재 레벨 · ${L.tag(level)}`} rows={result.current} {...{ statusOf, onSave, savingKey, popKey, onOpen, tone }} />
    <Section key={`o:${query}`} title="다른 레벨" rows={result.other} {...{ statusOf, onSave, savingKey, popKey, onOpen, tone }} />
  </div>;
}
