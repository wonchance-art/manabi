'use client';
// 인쇄 학습지(PRINT-SHEET-001 — 오너 승인 목업 2026-11-16 KST). 뷰어 「학습」 창의 「인쇄」에서 온다.
// 「본문만」 · 「해석용」 두 판을 종이 모양으로 미리 보이고, window.print()가 같은 마크업을 @page 판으로 뽑는다.
// 읽는 기록은 뷰어와 같다(같은 쿼리 키 · 같은 판정): 자료(['material', id] · loadMaterial), 담은 단어 색인(['vocab-words', 계정]),
// 아는 단어 · 제외 묶음(useKnownWords · useVocabularyExclusions). 손님은 아무 단어도 익숙하지 않다.
// 번역은 교재 번역 맵과 이 기기에 남은 뷰어 번역만 — AI를 부르지 않는다(계약 printPage.test.js). 학습 기록(만남 · 복습)도 쓰지 않는다.
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import Spinner from '../components/Spinner';
import { useAuth } from '../lib/AuthContext';
import { loadMaterial } from '../lib/viewerMaterial';
import { fetchVocabularyLearningRows, yieldToMain } from '../lib/vocabularyLearningRows';
import { buildVocabularyWordIndex } from '../lib/vocabularyDueIndex';
import { VOCAB_WORDS_STALE_MS, vocabWordsFromLearningCache } from '../lib/viewerVocabularyCache';
import { useKnownWords } from '../lib/useKnownWords';
import { useVocabularyExclusions } from '../lib/useVocabularyExclusions';
import { knownWordsLang } from '../lib/knownWords';
import { knownWordSetOf } from '../lib/knownWordControl';
import { useCanonicalLiterature } from '../lib/useCanonicalLiterature';
import { useZhHskLevels } from '../lib/useZhHskLevels';
import { viewerLanguageInfo } from '../lib/viewerLanguage';
import { viewerCacheKey } from '../lib/viewerReliability';
import { splitRuby, kuruNextTexts } from '../lib/splitRuby';
import { pinyinPerChar } from '../lib/viewerHanjaPanel';
import { PINYIN_EM_WIDTH } from '../lib/pinyinLayout';
import { zhClosingCells, zhPieces } from '../lib/zhGrid';
import { siteUrl } from '../lib/seo';
import {
  CIRCLED, PRINT_KINDS, PRINT_PAPERS, PRINT_PAPER_CSS, PRINT_RUBY, PRINT_SIZES, PRINT_SIZE_PT,
  isLongBlock, paragraphTranslations, pickPrintOption, printAttributionLines, printLevelLabel, printParagraphs,
  printRubyShown, printWordState, selectGlosses, sentencesByLine, materialLevelRank, wordLevelRank,
} from '../lib/printSheet';
import '../components/viewer/print-sheet.css';

const EMPTY_WORDS = Object.freeze({ byKey: new Map(), surfaces: new Set(), bases: new Set() });
// 중국어 병음 칸 — 뷰어 격자(ZH-GRID-001)와 같은 식: 가장 넓은 음절(chuāng) 폭 = PINYIN_EM_WIDTH × 병음 크기. 병음 0.5em.
const PINYIN_EM = 0.5;
const ZH_CELL_EM = Math.max(1, Math.ceil((PINYIN_EM_WIDTH * PINYIN_EM + 0.06) * 100) / 100);
const OPENING = /^[「『（《〈【〔“‘(\[]+$/u;
const MEMO_LINES = 8;

const routeId = (raw) => { try { return decodeURIComponent(String(raw)); } catch { return String(raw); } };
const cssString = (s) => `"${String(s).replace(/[\\"]/g, '\\$&').replace(/[\n\r]/g, ' ')}"`;

// 뷰어 fetchUserVocabWords와 같은 조립(같은 쿼리 키라 뷰어에서 오면 캐시 그대로 — 새 조회 함수 없음).
async function fetchVocabWordIndex(userId, signal) {
  const projected = await fetchVocabularyLearningRows(userId, { signal, sliced: true });
  await yieldToMain();
  if (signal?.aborted) throw signal.reason || new DOMException('Aborted', 'AbortError');
  return buildVocabularyWordIndex(projected);
}

function Choice({ name, label, items, value, onChange }) {
  return <div className="print-choice">
    <span className="print-choice__label" id={`print-choice-${name}`}>{label}</span>
    <div role="group" aria-labelledby={`print-choice-${name}`}>
      {items.map(([v, text]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{text}</button>)}
    </div>
  </div>;
}

// 중국어 병음 격자 — 글자마다 같은 폭의 칸(병음 칸), 병음은 칸 위 가운데. 낱말 안팎 간격이 같아 낱말이 갈라져 보이지 않는다.
// 음절 수가 글자 수와 안 맞는 옛 분석은 낱말 칸들 위 가운데에 읽기 전체를 얹는다(나눠 추측하지 않는다).
function ZhCells({ text, segments = null }) {
  if (!segments) return zhPieces(text).map((piece, i) => piece.cell != null
    ? <span key={i} className="print-zh">{piece.cell}</span> : <span key={i}>{piece.run}</span>);
  return segments.map((seg, i) => {
    if (seg.kanji == null) return <ZhCells key={i} text={seg.plain} />;
    const chars = [...seg.kanji];
    if (seg.pinyin || chars.length === 1) return <span key={i} className="print-zh"><span className="print-zh__py">{seg.reading}</span>{seg.kanji}</span>;
    return <span key={i} className="print-zh-word"><span className="print-zh__py">{seg.reading}</span>
      {chars.map((ch, k) => <span key={k} className="print-zh">{ch}</span>)}</span>;
  });
}

function TokenText({ token, nextText, showRuby, chinese, zhGrid }) {
  const reading = showRuby && token.furigana && !String(token.furigana).startsWith('/') ? token.furigana : null;
  if (chinese && zhGrid) {
    return <ZhCells text={token.text} segments={reading ? splitRuby(token.text, pinyinPerChar(token.text, reading) ?? reading) : null} />;
  }
  if (!reading) return token.text;
  return splitRuby(token.text, reading, token.base_form, nextText).map((s, j) => s.kanji
    ? <ruby key={j}>{s.kanji}<rt>{s.reading}</rt></ruby>
    : <span key={j}>{s.plain}</span>);
}

/** 문단 — 토큰을 낱말 묶음으로(중국어: 닫는 부호는 앞 낱말, 여는 부호는 뒤 낱말과 함께 넘어간다 — 줄머리 · 줄끝 금칙).
 *  중국어 낱말 묶음 사이에는 <wbr>로 줄바꿈 자리를 둔다 — Firefox는 nowrap 묶음(칸 = inline-block)끼리 붙어 있으면 줄을 넘기지 않았다(실측). */
function Paragraph({ paragraph, ruby, refs, language, stateOf, kuruNext, zhGrid }) {
  const chinese = language === 'Chinese';
  const groups = [];
  let pendingOpen = [];
  for (const token of paragraph.tokens) {
    if (chinese && groups.length && !pendingOpen.length && zhClosingCells(token.text, 'Chinese') > 0) { groups.at(-1).push(token); continue; }
    if (chinese && OPENING.test(token.text)) { pendingOpen.push(token); continue; }
    groups.push([...pendingOpen, token]);
    pendingOpen = [];
  }
  if (pendingOpen.length) groups.push(pendingOpen);
  const Tag = paragraph.heading ? 'h3' : 'p';
  return <Tag className={paragraph.heading ? 'print-heading' : 'print-para'}>
    {groups.map((group, g) => <Fragment key={group[0].key}>
      {group[0].gap ? ' ' : chinese && g > 0 ? <wbr /> : null}
      <span className="print-token">
        {group.map((token, k) => {
          const refNo = refs?.get(token.key);
          const text = <TokenText token={token} nextText={kuruNext.get(token.key)} chinese={chinese} zhGrid={zhGrid}
            showRuby={printRubyShown(ruby, stateOf(token))} />;
          const ref = refNo ? <sup className="print-ref" aria-label={`뜻풀이 ${refNo}`}>{CIRCLED[refNo - 1]}</sup> : null;
          // 중국어 격자: 번호는 폭 0 상자에 담아 낱말 마지막 칸 경계 위에 얹는다(격자가 밀리지 않게).
          if (zhGrid && ref) return <Fragment key={token.key}>{text}<span className="print-zh-ref">{ref}</span></Fragment>;
          return <Fragment key={token.key}>{k > 0 && token.gap ? ' ' : null}{text}{ref}</Fragment>;
        })}
      </span>
    </Fragment>)}
  </Tag>;
}

// 안내 화면 — 자료를 열 수 없으면(없음 · 비공개) 뷰어도 같은 안내라 서재(손님은 산책)로, 그 밖은 자료로 돌아간다.
function StateScreen({ id, title, body, action, away = null }) {
  return <div className="page-container print-state">
    <h1>{title}</h1>
    {body && <p>{body}</p>}
    <div className="print-state__actions">
      {action}
      {away
        ? <Link className="btn btn--secondary btn--md" href={away.href} prefetch={false}>{away.label}</Link>
        : <Link className="btn btn--secondary btn--md" href={`/viewer/${encodeURIComponent(id)}`}>자료로 돌아가기</Link>}
    </div>
  </div>;
}

export default function PrintPage({ id: rawId }) {
  const id = routeId(rawId);
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const [kind, setKind] = useState(() => pickPrintOption(params.get('kind'), PRINT_KINDS, 'text'));
  const [ruby, setRuby] = useState(() => pickPrintOption(params.get('ruby'), PRINT_RUBY, 'all'));
  const [size, setSize] = useState(() => pickPrintOption(params.get('size'), PRINT_SIZES, 'm'));
  const [paper, setPaper] = useState(() => pickPrintOption(params.get('paper'), PRINT_PAPERS, 'A4'));
  const { data: material, isLoading, error, refetch } = useQuery({
    queryKey: ['material', id],
    queryFn: () => loadMaterial(id, { cached: queryClient.getQueryData(['material', id]) !== undefined }),
  });
  const json = material?.processed_json;
  const language = json?.metadata?.language || 'Japanese';
  const info = viewerLanguageInfo(language);
  const lang = language === 'Chinese' ? 'zh-Hans' : info?.code || 'ja';

  // 담은 단어 · 아는 단어 — 뷰어와 같은 키 · 같은 신선도. 계정이 없으면 받지 않는다(손님 = 모두 모르는 단어).
  const { data: savedData, isSuccess: savedOk, isError: savedFailed } = useQuery({
    queryKey: ['vocab-words', user?.id],
    queryFn: ({ signal }) => fetchVocabWordIndex(user.id, signal),
    enabled: !!user,
    staleTime: VOCAB_WORDS_STALE_MS,
    initialData: () => vocabWordsFromLearningCache(queryClient, user?.id),
    initialDataUpdatedAt: () => queryClient.getQueryState(['vocab', user?.id, 'learning'])?.dataUpdatedAt,
  });
  const exclusionState = useVocabularyExclusions();
  const knownLangCode = knownWordsLang(language);
  const knownState = useKnownWords(knownLangCode, !!knownLangCode && !!material);
  const savedWords = savedData || EMPTY_WORDS;
  const knownWordSet = useMemo(() => knownWordSetOf(knownState.data, exclusionState.data, knownLangCode),
    [knownState.data, exclusionState.data, knownLangCode]);
  const wordStateFailed = !!user && (savedFailed || exclusionState.isError || (!!knownLangCode && knownState.isError));
  const wordStateReady = !user || wordStateFailed
    || (savedOk && exclusionState.isSuccess && (!knownLangCode || knownState.isSuccess));

  const literature = useCanonicalLiterature(material);
  const paragraphs = useMemo(() => printParagraphs(json, material?.raw_text, { title: material?.title }), [json, material?.raw_text, material?.title]);
  const kuruNext = useMemo(() => kuruNextTexts(json?.sequence, json?.dictionary), [json]);
  const stateOf = useMemo(() => {
    const memo = new Map();
    return (token) => {
      const key = `${token.text}\u0000${token.base_form || ''}\u0000${token.sep_link || ''}`;
      if (!memo.has(key)) memo.set(key, printWordState(token, { savedWords, knownWordSet, language }));
      return memo.get(key);
    };
  }, [savedWords, knownWordSet, language]);
  // 급수 — 해석용에서만 받는다(중국어 HSK 2026 표 · 일본어 JLPT 찾기 색인 · 영어 · 프랑스어 CEFR 색인, 모두 단어 페이지와 같은 정적 자료).
  const study = kind === 'study';
  const zhLevels = useZhHskLevels(study && language === 'Chinese');
  const [jaLevels, setJaLevels] = useState(null);
  useEffect(() => {
    if (!study || language !== 'Japanese' || jaLevels) return undefined;
    let alive = true;
    import('../lib/levelExampleLookup').then((m) => m.japaneseLevels()).then((map) => { if (alive) setJaLevels(map); }, () => {});
    return () => { alive = false; };
  }, [study, language, jaLevels]);
  const latinLanguage = language === 'English' || language === 'French';
  const [latinLevels, setLatinLevels] = useState(null);
  useEffect(() => {
    if (!study || !latinLanguage || latinLevels) return undefined;
    let alive = true;
    fetch('/api/level-index/latin').then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body) => { if (alive) setLatinLevels({ en: new Map(body?.en || []), fr: new Map(body?.fr || []) }); }, () => {});
    return () => { alive = false; };
  }, [study, latinLanguage, latinLevels]);

  // 뜻풀이 — 자료 급수보다 쉬운 말은 싣지 않고, 문단 안에서는 어려운 순으로 고른다(PRINT-GLOSS-002). 급수 표기가 없는 자료는 가장 쉬운 단계만 거른다.
  // 급수 표가 아직 안 왔으면(받는 중 · 실패) 난이도 거름 없이 지금처럼 등장 순 — 빈 뜻풀이보다 낫다.
  const levelTables = useMemo(() => ({ zhLevels, jaLevels, latinLevels }), [zhLevels, jaLevels, latinLevels]);
  const tableReady = language === 'Chinese' ? !!zhLevels : language === 'Japanese' ? !!jaLevels : latinLanguage ? !!latinLevels : false;
  const minRank = materialLevelRank(language, json?.metadata?.level) ?? 2;
  const glosses = useMemo(() => selectGlosses(paragraphs, {
    language, isFamiliar: (token) => { const s = stateOf(token); return s.isKnown || s.isSaved; },
    ...(tableReady ? { rankOf: (_token, word) => wordLevelRank(language, word, levelTables), minRank } : {}),
  }), [paragraphs, language, stateOf, tableReady, levelTables, minRank]);

  // 번역 — 교재 맵, 그다음 이 기기의 뷰어 번역(같은 viewer_tx 키 — 뷰어 cacheScope와 같은 범위). 읽기만 한다.
  const [translations, setTranslations] = useState(null);
  useEffect(() => {
    if (!study || !json) return undefined;
    let alive = true;
    const scope = [user?.id || 'guest', id, language, material?.raw_text, json];
    let storage = null;
    try { storage = window.localStorage; } catch { storage = null; }
    const oneLocale = (info?.explanationLocales?.length ?? 1) <= 1;
    paragraphTranslations({
      paragraphs, units: sentencesByLine(json, material?.raw_text, language), translations: json.metadata?.translations,
      keyOf: oneLocale ? (sentence) => viewerCacheKey('viewer_tx', scope, sentence) : null, storage,
    }).then((map) => { if (alive) setTranslations(map); }, () => { if (alive) setTranslations(new Map()); });
    return () => { alive = false; };
  }, [study, json, material?.raw_text, paragraphs, language, id, user?.id, info]);

  // 고른 판을 주소에 남긴다(새로 고침 · 뒤로 가기에도 같은 판). 화면 이동은 하지 않는다.
  useEffect(() => {
    const next = new URLSearchParams({ kind, ruby, size, paper }).toString();
    if (window.location.search.slice(1) !== next) window.history.replaceState(window.history.state, '', `?${next}`);
  }, [kind, ruby, size, paper]);

  // 쪽 머리말 · 꼬리말(@page 여백 상자)은 CSS 변수를 못 읽는다 — 그려진 글꼴 이름 · 회색을 한 번 재서 문자열로 넣는다.
  const rootRef = useRef(null);
  const [marginStyle, setMarginStyle] = useState(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    setMarginStyle({ font: (cs.getPropertyValue('--font-noto-kr').trim() || "'Noto Sans KR'") + ', sans-serif', color: cs.getPropertyValue('--muted').trim() || 'currentColor' });
  }, [material]);

  const [printing, setPrinting] = useState(false);
  const print = async () => {
    setPrinting(true);
    try { await document.fonts?.ready; } catch { /* 글꼴 대기 실패여도 인쇄는 연다 */ }
    setPrinting(false);
    window.print();
  };

  const away = user ? { href: '/materials', label: '내 서재로' } : { href: '/discover', label: '산책으로' };
  if (isLoading) return <div className="page-container"><Spinner message="자료 불러오는 중…" /></div>;
  if (error || !material) {
    const notFound = error?.code === 'NOT_FOUND' || error?.code === 'LOCAL_MISSING';
    return <StateScreen id={id} title={notFound ? '자료를 찾을 수 없어요' : '자료를 불러오지 못했어요'}
      body={notFound ? '이 자료는 삭제됐거나 비공개로 바뀌었을 수 있어요.' : '잠시 후 다시 시도해 주세요.'}
      away={notFound ? away : null}
      action={notFound ? null : <button type="button" className="btn btn--primary btn--md" onClick={() => refetch()}>다시 시도</button>} />;
  }
  // 비공개 자료 — 뷰어와 같은 판정(팀 사본은 막지 않는다). 계정 확인 중에는 판정하지 않는다(주인이 잠깐 막힌 화면을 보지 않게).
  if (material.visibility === 'private' && material.owner_id !== user?.id && !material.__local) {
    if (authLoading) return <div className="page-container"><Spinner message="자료 불러오는 중…" /></div>;
    return <StateScreen id={id} title="비공개 자료예요" body="이 자료는 작성자만 볼 수 있어요." away={away} />;
  }
  const status = json?.status || material.status;
  if (status !== 'completed' && status !== 'partial') {
    return <StateScreen id={id} title="아직 인쇄할 수 없어요" body="자료 분석이 끝나면 인쇄할 수 있어요." />;
  }

  const title = material.title || '제목 없음';
  const sources = printAttributionLines(material, literature);
  const meta = [info?.labelKo || language, json?.metadata?.level].filter(Boolean).join(' · ');
  const shortUrl = `${siteUrl().replace(/^https?:\/\/(www\.)?/, '')}/viewer/${encodeURIComponent(id)}`;
  // 읽기 표시 — 가나 · 병음 언어만(영어 · 프랑스어 IPA는 종이에 얹지 않는다 — 고를 것이 없어 칸을 숨긴다).
  const hasReading = info?.readingType === 'kana' || info?.readingType === 'pinyin';
  const zhGrid = language === 'Chinese' && ruby !== 'none';
  const cellScale = zhGrid ? ZH_CELL_EM : 1;
  const sizeScale = PRINT_SIZE_PT[size] / PRINT_SIZE_PT.m;
  const box = (where, content, pad) => `@${where} { content: ${content}; font-family: ${marginStyle?.font || 'sans-serif'}; font-size: 8pt; color: ${marginStyle?.color || 'currentColor'}; ${pad} }`;
  const pageCss = `@page { size: ${PRINT_PAPER_CSS[paper]}; margin: 18mm 16mm 20mm;
  ${box('top-left', cssString(title), 'vertical-align: bottom; padding-bottom: 4mm;')}
  ${box('bottom-left', cssString(shortUrl), 'vertical-align: top; padding-top: 5mm;')}
  ${box('bottom-right', 'counter(page) " / " counter(pages)', 'vertical-align: top; padding-top: 5mm;')}
}
@page :first { @top-left { content: none; } }`;
  const ready = wordStateReady && (!study || translations !== null);
  const note = !wordStateReady ? '단어 기록 불러오는 중…'
    : study && translations === null ? '번역 불러오는 중…'
      : study ? '번역이 없는 문단은 빈 줄로 인쇄해요.' : '본문과 출처만 인쇄해요.';

  return <div ref={rootRef} className="print-page" data-kind={kind} data-ruby={ruby} data-paper={paper} data-language={language}
    style={{ '--print-body': `${PRINT_SIZE_PT[size]}pt`, '--print-zh-cell-n': ZH_CELL_EM }}>
    <style>{pageCss}</style>
    <div className="print-controls">
      <Link className="print-controls__back" href={`/viewer/${encodeURIComponent(id)}`}><span aria-hidden="true">←</span>자료로 돌아가기</Link>
      <div className="print-controls__head">
        <h1>인쇄</h1>
        <p>{title}</p>
      </div>
      <div className="print-controls__row">
        <Choice name="kind" label="종류" items={PRINT_KINDS} value={kind} onChange={setKind} />
        {hasReading && <Choice name="ruby" label="읽기 표시" items={PRINT_RUBY} value={ruby} onChange={setRuby} />}
        <Choice name="size" label="글자 크기" items={PRINT_SIZES} value={size} onChange={setSize} />
        <Choice name="paper" label="종이" items={PRINT_PAPERS} value={paper} onChange={setPaper} />
      </div>
      <div className="print-controls__foot">
        <p>{note}{wordStateFailed ? ' 단어 기록을 불러오지 못해 모든 단어를 모르는 단어로 인쇄해요.' : ''}</p>
        <button type="button" className="btn btn--primary btn--md print-controls__go" disabled={!ready || printing} onClick={print}>인쇄하기</button>
      </div>
    </div>

    <article className="print-sheet" lang={lang}>
      <header className="print-head">
        <h2>{title}</h2>
        {meta && <p className="print-meta" lang="ko">{meta}</p>}
        {sources.map((line) => <p key={line} className="print-meta print-meta--source" lang="ko">{line}</p>)}
      </header>

      {!study
        ? <div className="print-body">{paragraphs.map((paragraph) => <Paragraph key={paragraph.rawIdx} paragraph={paragraph} ruby={ruby}
          language={language} stateOf={stateOf} kuruNext={kuruNext} zhGrid={zhGrid} />)}</div>
        : <div className="print-body">
          {paragraphs.map((paragraph, i) => {
            if (paragraph.heading) return <Paragraph key={paragraph.rawIdx} paragraph={paragraph} ruby={ruby}
              language={language} stateOf={stateOf} kuruNext={kuruNext} zhGrid={zhGrid} />;
            const { items, refs } = glosses[i];
            const translation = translations?.get(paragraph.rawIdx);
            return <section key={paragraph.rawIdx} className="print-block" data-long={isLongBlock(paragraph, { cellScale, sizeScale }) ? '' : undefined}>
              <div className="print-block__main">
                <Paragraph paragraph={paragraph} ruby={ruby} refs={refs} language={language} stateOf={stateOf} kuruNext={kuruNext} zhGrid={zhGrid} />
              </div>
              {items.length > 0 && <ol className="print-gloss" lang="ko">
                {items.map((item, n) => {
                  const level = printLevelLabel(language, item.word, { zhLevels, jaLevels });
                  return <li key={item.key}>
                    <span className="print-gloss__no">{CIRCLED[n]}</span>
                    <span className="print-gloss__word" lang={lang}>{item.word}</span>
                    {item.reading && <span className="print-gloss__yomi" lang={lang}>{item.reading}</span>}
                    <span className="print-gloss__body">{item.meaning}
                      {(item.pos || level) && <span className="print-gloss__pos">{[item.pos, level].filter(Boolean).join(' · ')}</span>}
                    </span>
                  </li>;
                })}
              </ol>}
              <div className="print-translate" lang="ko">
                <span className="print-label">번역</span>
                {translation
                  ? <p className="print-translate__text">{translation.text}</p>
                  : <><span className="print-line" /><span className="print-line" /></>}
              </div>
            </section>;
          })}
          <section className="print-memo" lang="ko">
            <h3 className="print-label">단어 메모</h3>
            {Array.from({ length: MEMO_LINES }, (_, i) => <span key={i} className="print-line" />)}
          </section>
        </div>}
    </article>
  </div>;
}
