import Link from 'next/link';
import { getRefLang } from '../content/refLangs';
import { refInline, refMain, refPron, Callout, CALLOUT_ORDER, LevelDot, JaText } from './refShared';
import RefReadMark from '../components/RefReadMark';
import RefSpeak from '../components/RefSpeak';
import RefPatternCheck from '../components/RefPatternCheck';

function ExampleList({ examples, langCode, lang }) {
  if (!examples?.length) return null;
  return (
    <ul className="fr-examples">
      {examples.map((ex, i) => {
        const pron = refPron(ex);
        return (
          <li key={i} className="fr-example">
            <div className="fr-example__fr">
              {langCode === 'ja' ? (
                <JaText ja={refMain(ex)} yomi={pron} />
              ) : (
                <>
                  <span lang={langCode}>{refMain(ex)}</span>
                  {pron && <span className="fr-example__ipa">{pron}</span>}
                </>
              )}
              <RefSpeak text={refMain(ex)} lang={lang} size="xs" />
            </div>
            <div className="fr-example__ko">{ex.ko}</div>
            {ex.note && <div className="fr-example__note">└ {refInline(ex.note)}</div>}
          </li>
        );
      })}
    </ul>
  );
}

function SectionTable({ table }) {
  if (!table?.rows?.length) return null;
  return (
    <div className="fr-table-wrap">
      <table className="fr-table">
        {table.caption && <caption>{table.caption}</caption>}
        {table.headers?.length > 0 && (
          <thead>
            <tr>{table.headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
          </thead>
        )}
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i}>{row.map((cell, j) => <td key={j}>{refInline(cell)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 언어 레퍼런스 — 문법 챕터 상세 페이지 (프랑스어·일본어·영어 공용)
 */
export default function ReferenceChapterPage({ lang, slug }) {
  const ref = getRefLang(lang);
  const data = ref?.getChapter(slug);
  const backHref = `/lessons?lang=${lang}&view=ref`;

  if (!data) {
    return (
      <div className="page-container" style={{ maxWidth: 760, textAlign: 'center', paddingTop: 80 }}>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>챕터를 찾을 수 없어요</h1>
        <Link href={backHref} className="btn btn--ghost btn--sm">{ref?.name || ''} 강의 목록으로 →</Link>
      </div>
    );
  }

  const { chapter, prev, next } = data;
  const meta = ref.getLevelMeta(chapter.level);
  // 핵심 패턴 한눈에 — pattern이 있는 섹션만 모아 상단 요약
  const patternIndex = chapter.sections
    .map((sec, i) => ({ i, pattern: sec.pattern }))
    .filter(p => p.pattern);
  // 패턴 체크 v2 — 3단계 퀴즈 구성 (의미 매칭 → 적용 → 생산)
  const exAll = chapter.sections
    .flatMap(sec => sec.examples || [])
    .filter(ex => ex && ex.ko && refMain(ex));

  // ① 빈칸 채우기 — 실제 예문에서 패턴 자리를 비우고, 문맥에 맞는 형태를 고른다.
  //    보기(오답)는 정답과 같은 종류(실제 단어형)만 — 한국어 슬롯·문법용어·구두점 조각은 배제.
  const isCJK = s => /[぀-ヿ一-鿿]/.test(String(s || ''));
  // 빈칸 후보 추출 — 패턴 속 '실제 형태'만 (한국어 슬롯/약어 제외, CJK는 1자도 허용, 라틴은 2자+)
  const clozeSegs = pat => String(pat || '')
    .split(/[〜～()/・+→…,、。]|\s+|\b(?:N|V|A|S|O|Adj|inf|p\.p\.)\b/i)
    .map(t => t.trim())
    .filter(t => t && !/[가-힣]/.test(t) && (isCJK(t) || t.length >= 2));
  // 보기 유효성 — 정답과 같은 문자종의 진짜 형태만 (한글·화살표·구두점 조각 제거)
  const validDistractor = (cand, answer) => {
    const c = String(cand || '').trim();
    if (!c) return false;
    if (/[가-힣]/.test(c)) return false;                    // 한국어 슬롯·문법용어 제거
    if (/[→…:;()/,、。]/.test(c)) return false;              // 화살표·구두점 조각 제거
    if (isCJK(c) !== isCJK(answer)) return false;           // 정답과 같은 문자종만
    if (c.toLowerCase() === String(answer).toLowerCase()) return false;
    return true;
  };
  const ownPatterns = chapter.sections.filter(s => s.pattern);
  const levelForms = [...new Set(
    ref.getGrammarChapters(chapter.level)
      .filter(c => c.slug !== chapter.slug)
      .flatMap(c => c.sections || [])
      .flatMap(s => [...clozeSegs(s.pattern), ...(s.distractors || [])])
  )];
  // seg 위치 찾기 — 라틴은 단어 경계로(부분문자열 오매칭 방지: these 속 the), CJK는 부분문자열
  const findSeg = (low, g) => {
    if (isCJK(g)) return low.indexOf(g.toLowerCase());
    const esc = g.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = low.match(new RegExp('(^|[^a-z])' + esc + '([^a-z]|$)'));
    return m ? m.index + m[1].length : -1;
  };
  const meaning = [];
  const usedCloze = new Set();
  for (const sec of ownPatterns) {
    if (meaning.length >= 4) break;
    const segs = clozeSegs(sec.pattern).sort((a, b) => b.length - a.length);
    for (const ex of (sec.examples || [])) {
      if (meaning.length >= 4) break;
      const main = refMain(ex);
      if (!ex || !ex.ko || !main || usedCloze.has(main)) continue;
      const low = main.toLowerCase();
      let seg = null, at = -1;
      for (const g of segs) { const i = findSeg(low, g); if (i >= 0) { seg = g; at = i; break; } }
      if (!seg) continue;
      const actual = main.slice(at, at + seg.length);
      // 보기 풀: 저작 distractors 우선 → 같은 챕터 다른 패턴 → 레벨 형태 (모두 정제)
      const pool = [
        ...(sec.distractors || []),
        ...ownPatterns.filter(o => o !== sec).flatMap(o => clozeSegs(o.pattern)),
        ...levelForms,
      ];
      const distractors = [...new Set(pool)]
        .filter(d => validDistractor(d, actual) && !low.includes(String(d).toLowerCase()))
        .slice(0, 3);
      if (distractors.length < 2) continue;
      meaning.push({
        sentence: main.slice(0, at) + '＿＿＿' + main.slice(at + seg.length),
        full: main,
        ko: ex.ko,
        correct: actual,
        distractors,
        pron: refPron(ex),
      });
      usedCloze.add(main);
    }
  }

  // ② 적용 — 어순 배열만 (공백 토큰 3~10). '번역 고르기'(의미 찍기)는 가치가 없어 폐기.
  const apply = [];
  const usedApply = new Set(usedCloze);
  for (const ex of exAll) {
    if (apply.length >= 4) break;
    const main = refMain(ex);
    const tokens = main.split(/[\s　]+/).filter(Boolean);
    if (tokens.length >= 3 && tokens.length <= 10 && !usedApply.has(main)) {
      apply.push({ type: 'order', tokens, answer: main, ko: ex.ko, pron: refPron(ex) });
      usedApply.add(main);
    }
  }

  // ③ 생산 — 적용에서 안 쓴 예문 우선, 부족하면 재사용 (생산은 다른 능력)
  const producePool = [
    ...exAll.filter(ex => !usedApply.has(refMain(ex))),
    ...exAll.filter(ex => usedApply.has(refMain(ex))),
  ];
  const produce = producePool.slice(0, 3).map(ex => ({
    ko: ex.ko, main: refMain(ex), pron: refPron(ex),
  }));

  const quiz = { meaning, apply, produce };

  // 통과 후 복습 추천 — 연관 문형·레벨 어휘 (있을 때만)
  const reviewLinks = [];
  {
    const bunkei = ref.getBunkei?.(chapter.level);
    if (bunkei) {
      const related = bunkei.themes.flatMap(t => t.items).filter(i => i.ch === chapter.slug).length;
      if (related > 0) {
        reviewLinks.push({
          href: `${ref.base}/bunkei/${chapter.level.toLowerCase()}?ch=${chapter.slug}`,
          label: `연관 문형 ${related}개 복습`,
        });
      }
    }
    if (ref.countVocab(chapter.level) > 0) {
      reviewLinks.push({
        href: `${ref.base}/vocab/${chapter.level.toLowerCase()}`,
        label: `${chapter.level} 어휘`,
      });
    }
  }

  return (
    <div className="page-container" style={{ maxWidth: 760 }}>
      {/* ── 브레드크럼 ── */}
      <nav style={{ marginBottom: 18 }} aria-label="브레드크럼">
        <Link href={backHref} style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          ← {ref.flag} {ref.name} 강의 목록
        </Link>
      </nav>

      {/* ── 헤더 ── */}
      <header style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <LevelDot meta={meta} size="sm" />
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            {meta?.label} · 문법 #{chapter.order}
          </span>
          {chapter.duration && (
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{chapter.duration}</span>
          )}
          {/* 문형 사전·어휘 빠른 진입 — 헤더에서 바로 */}
          {ref.getBunkei?.(chapter.level) && (
            <Link
              href={`${ref.base}/bunkei/${chapter.level.toLowerCase()}`}
              className="fr-header-bunkei"
            >
              {chapter.level} 문형 사전
            </Link>
          )}
          {ref.countVocab(chapter.level) > 0 && (
            <Link
              href={`${ref.base}/vocab/${chapter.level.toLowerCase()}`}
              className="fr-header-bunkei"
            >
              {chapter.level} 어휘
            </Link>
          )}
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.7rem', fontWeight: 700, lineHeight: 1.42, letterSpacing: '-0.01em', wordBreak: 'keep-all' }}>{chapter.title}</h1>
        {(() => {
          // topic이 원어 제목을 이미 포함하면 중복 표기 생략
          const titleFr = chapter.titleFr && !(chapter.topic || '').includes(chapter.titleFr)
            ? chapter.titleFr : null;
          if (!chapter.topic && !titleFr) return null;
          return (
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: 5 }}>
              {chapter.topic}
              {chapter.topic && titleFr && ' · '}
              {titleFr && <span lang={ref.langCode} style={{ fontStyle: 'italic' }}>{titleFr}</span>}
            </p>
          );
        })()}
        {chapter.summary && (
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 10 }}>
            {chapter.summary}
          </p>
        )}
      </header>

      {/* ── 핵심 패턴 한눈에 ── */}
      {patternIndex.length > 0 && (
        <div className="fr-pattern-summary" style={{ borderColor: meta?.line, background: meta?.bg }}>
          <div className="fr-pattern-summary__title" style={{ color: meta?.color }}>핵심 패턴 한눈에</div>
          <ol className="fr-pattern-summary__list">
            {patternIndex.map(p => (
              <li key={p.i}>
                <a href={`#sec-${p.i + 1}`} className="fr-pattern-summary__item">
                  <span className="fr-pattern-summary__num" style={{ color: meta?.color }}>{p.i + 1}</span>
                  <span className="fr-pattern-summary__text">{refInline(p.pattern)}</span>
                </a>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* ── 본문 섹션 ── */}
      {chapter.sections.map((sec, i) => (
        <section key={i} id={`sec-${i + 1}`} className="card fr-section">
          <h2 className="fr-section__heading">
            <span className="fr-section__num" style={{ background: meta?.bg, color: meta?.color }}>{i + 1}</span>
            {sec.heading}
          </h2>

          {/* 패턴 공식 박스 — 섹션의 핵심을 가장 먼저, 가장 크게 */}
          {sec.pattern && (
            <div className="fr-pattern" style={{ borderColor: meta?.color }}>
              <div className="fr-pattern__text">{refInline(sec.pattern)}</div>
              {sec.patternKo && <div className="fr-pattern__ko">{sec.patternKo}</div>}
            </div>
          )}

          <SectionTable table={sec.table} />
          <ExampleList examples={sec.examples} langCode={ref.langCode} lang={lang} />

          {/* 상세 설명 — 패턴·예문 아래의 부가 설명 */}
          {sec.body && (
            <div className="fr-section__detail">
              {sec.body.split(/\n\n/).map((para, j) => (
                <p key={j} className="fr-section__para">{refInline(para)}</p>
              ))}
            </div>
          )}

          {CALLOUT_ORDER.map(kind => (
            <Callout key={kind} kind={kind} text={sec[kind]} />
          ))}
        </section>
      ))}

      {/* ── 패턴 체크 (3단계 퀴즈 + 통과 관문) ── */}
      <RefPatternCheck
        quiz={quiz}
        lang={lang}
        langCode={ref.langCode}
        storageKey={`${ref.readKey}_check`}
        slug={chapter.slug}
        next={next ? { href: `${ref.base}/grammar/${next.slug}`, title: next.title } : null}
        reviewLinks={reviewLinks}
      />

      {/* 읽음 기록 — 여기(챕터 끝)까지 스크롤해야 읽음 처리 */}
      <RefReadMark storageKey={ref.readKey} slug={chapter.slug} />

      {/* ── 문형 사전으로 — 이 챕터와 연결된 문형 확장 학습 ── */}
      {(() => {
        const bunkei = ref.getBunkei?.(chapter.level);
        if (!bunkei) return null;
        const related = bunkei.themes.flatMap(t => t.items).filter(i => i.ch === chapter.slug).length;
        const base = `${ref.base}/bunkei/${chapter.level.toLowerCase()}`;
        return (
          <Link
            href={related > 0 ? `${base}?ch=${chapter.slug}` : base}
            className="fr-bunkei-cta"
          >
            <span className="fr-bunkei-cta__text">
              {related > 0
                ? <>이 챕터와 연결된 문형 <strong>{related}개</strong>를 {chapter.level} 문형 사전에서 모아 보기</>
                : <>{chapter.level} 문형 사전 전체 보기</>}
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        );
      })()}

      {/* ── 이전/다음 ── */}
      <nav className="fr-pager" aria-label="챕터 이동">
        {prev ? (
          <Link href={`${ref.base}/grammar/${prev.slug}`} className="fr-pager__link">
            <span className="fr-pager__dir">← 이전 · {ref.getLevelMeta(prev.level)?.label}</span>
            <span className="fr-pager__title">{prev.title}</span>
          </Link>
        ) : <span />}
        {next ? (
          <Link href={`${ref.base}/grammar/${next.slug}`} className="fr-pager__link fr-pager__link--next">
            <span className="fr-pager__dir">{ref.getLevelMeta(next.level)?.label} · 다음 →</span>
            <span className="fr-pager__title">{next.title}</span>
          </Link>
        ) : <span />}
      </nav>
    </div>
  );
}
