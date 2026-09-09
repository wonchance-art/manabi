'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BOOK_SERIES } from '@/lib/bookNavigation';
import { discoverMatches } from '@/lib/libraryDiscovery';
import './library-discovery.css';

export default function DiscoveryExplorer({ documents, regions, topics }) {
  const params = useSearchParams();
  useEffect(() => {
    const saved = window.history.state?.manabiDiscoveryScroll;
    if (!Number.isFinite(saved) || saved < 0) return;
    let second;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => window.scrollTo({ top: saved, behavior: 'instant' }));
    });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, []);
  function rememberPlace(event) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    // Presentation state belongs to this history entry, never to learning progress.
    // Remove the section hash so it cannot override the saved position on Back.
    window.history.replaceState({ ...window.history.state, manabiDiscoveryScroll: window.scrollY }, '', window.location.pathname + window.location.search);
  }
  const region = regions.some(r => r.id === params.get('region')) ? params.get('region') : 'all';
  const topic = topics.some(t => t.id === params.get('topic')) ? params.get('topic') : 'all';
  const query = (params.get('q') || '').slice(0, 120);
  const [draft, setDraft] = useState(query);
  const matches = discoverMatches(documents, { region, topic, query });
  const requestedCount = Number(params.get('shown'));
  const count = Number.isSafeInteger(requestedCount) ? Math.min(documents.length, Math.max(8, requestedCount)) : 8;
  const narrowed = region !== 'all' || topic !== 'all' || !!query;
  function change(patch) {
    const next = new URLSearchParams(window.location.search);
    if (!Object.hasOwn(patch, 'shown')) next.delete('shown');
    for (const [key, value] of Object.entries(patch)) {
      if (value && value !== 'all') next.set(key, value); else next.delete(key);
    }
    const suffix = next.toString();
    window.history.replaceState(null, '', `/discover${suffix ? `?${suffix}` : ''}`);
  }
  return <>
    <section className="discovery-language-entry" aria-labelledby="foreign-reading-title"><div><p className="manabi-eyebrow">READ IN ANOTHER LANGUAGE</p><h2 id="foreign-reading-title">이번엔, 원어로.</h2><p>학습 언어와 난이도에 맞는 공개 자료를 찾아보세요.</p></div><div className="discovery-language-links">{BOOK_SERIES.map(series => <Link key={series.id} href={`/discover?view=reading&lang=${series.language}`} style={{ '--series-color': series.color }}><span>{series.language}</span><strong>{series.name}</strong><i aria-hidden="true">↗</i></Link>)}</div></section>
    <section className="discovery-index" id="reading-index" aria-labelledby="discovery-index-title">
      <div className="library-section-title"><div><p className="manabi-eyebrow">THE READING INDEX / 지역과 문화</p><h2 id="discovery-index-title">궁금한 곳부터, 한 편씩.</h2><p>한국어로 읽는 지역학. 지역과 주제를 함께 골라보세요.</p></div><span className="discovery-index-number" aria-hidden="true">{String(documents.length).padStart(2, '0')}</span></div>
      <div className="discovery-filter-bar"><form onSubmit={event => { event.preventDefault(); change({ q: draft.trim() }); }} role="search"><label htmlFor="discovery-search">제목·소개 검색</label><div><input id="discovery-search" type="search" maxLength={120} placeholder="예: 음식, 도시, 역사" value={draft} onChange={event => setDraft(event.target.value)} /><button type="submit">찾기 ↗</button></div></form><label>지역<select aria-label="지역" value={region} onChange={event => change({ region: event.target.value })}><option value="all">모든 지역</option>{regions.map(r => <option key={r.id} value={r.id}>{r.nameKo}</option>)}</select></label></div>
      <div className="discovery-topic-tabs" aria-label="읽기 주제"><button type="button" aria-pressed={topic === 'all'} onClick={() => change({ topic: 'all' })}>전체</button>{topics.map(t => <button type="button" key={t.id} aria-pressed={topic === t.id} onClick={() => change({ topic: t.id })}>{t.label}</button>)}</div>
      <div className="discovery-results-heading"><p role="status">{query && <span>‘{query}’ · </span>}{matches.length}편{narrowed && ` / 전체 ${documents.length}편`}</p>{narrowed && <button type="button" onClick={() => { setDraft(''); change({ region: 'all', topic: 'all', q: '' }); }}>필터 초기화</button>}</div>
      {matches.length ? <div className="discovery-reading-list">{matches.slice(0, count).map((doc, i) => <Link className="discovery-reading-item" href={doc.href} key={doc.href} onClick={rememberPlace}><span className="discovery-reading-item__number">{String(i + 1).padStart(2, '0')}</span><div><small>{doc.regionName} · {doc.topicName} · 한국어</small><h3>{doc.title}</h3><p>{doc.summary}</p><span className="discovery-reading-item__source">{doc.sourceLabel}{doc.updated && ` · ${doc.updated} 갱신`}</span></div><span aria-hidden="true">↗</span></Link>)}</div> : <div className="library-empty"><h3>이 조합의 글은 아직 없어요.</h3><p>주제를 바꾸거나 검색어를 줄여보세요.</p><button className="manabi-link" type="button" onClick={() => { setDraft(''); change({ region: 'all', topic: 'all', q: '' }); }}>전체 글 보기 →</button></div>}
      {matches.length > count && <button className="discovery-more" type="button" onClick={() => change({ shown: String(count + 8) })}>더 읽어보기 · {matches.length - count}편 남음 ↓</button>}
    </section>
  </>;
}
