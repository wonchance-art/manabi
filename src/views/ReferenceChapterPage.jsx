import Link from 'next/link';
import { getRefLang } from '../content/refLangs';
import { buildChapterQuiz } from '../lib/refQuiz';
import { refInline, refMain, refPron, Callout, CALLOUT_ORDER, RefParallel, RefHanjaBridge, LevelDot, JaText } from './refShared';
import RefReadMark from '../components/RefReadMark';
import RefSpeak from '../components/RefSpeak';
import RefPatternCheck from '../components/RefPatternCheck';
import GojuonChart from '../components/GojuonChart';
import KanaTest from '../components/KanaTest';
import LessonCompletionCta from '../components/LessonCompletionCta';
// 스토리 모듈(이야기로 확인) — 인터랙티브 채점은 클라이언트 경계로 분리(서버 페이지가 레지스트리를
// 클라이언트 번들로 끌어오지 않도록). story 는 순수 직렬화 데이터라 props 로 그대로 넘긴다.
import StoryCheck, { StoryLines } from './StoryCheck';
import ChapterAdminStrip from '../components/admin/ChapterAdminStrip';
import InlineEdit from '../components/admin/InlineEdit';
import { getChapterOverride, getOverridesForLang, mergeChapter } from '../lib/contentOverrides';
import { getCourseLessonContext } from '../lib/learn/courseMapData';

function ExampleList({ examples, langCode, lang, slug, secIndex }) {
  if (!examples?.length) return null;
  return (
    <ul className="fr-examples">
      {examples.map((ex, i) => {
        if (ex.dialogue) {
          return (
            <InlineEdit
              key={i}
              tag="li"
              className="fr-example"
              lang={lang}
              slug={slug}
              kind="json"
              path={`sections.${secIndex}.examples.${i}`}
            >
              <StoryLines
                body={ex.dialogue}
                lang={lang}
                langCode={langCode}
                translationAlwaysVisible
                compact
              />
              {ex.note && <div className="fr-example__note">└ {refInline(ex.note)}</div>}
            </InlineEdit>
          );
        }
        const pron = refPron(ex);
        return (
          <InlineEdit
            key={i}
            tag="li"
            className="fr-example"
            lang={lang}
            slug={slug}
            kind="example"
            path={`sections.${secIndex}.examples.${i}`}
          >
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
          </InlineEdit>
        );
      })}
    </ul>
  );
}

// 노래로 만나기(챕터 미디어) — 순수 서버 렌더. react-youtube 등 클라이언트 컴포넌트를 쓰지 않고
// youtube-nocookie iframe만 심어 First Load JS 증가를 0으로 유지한다. 저작권을 지켜 가사는 한 줄만.
function MediaSection({ media, langCode, lang }) {
  if (!media?.youtubeId) return null;
  const { youtubeId, songTitle, artist, line, point, culture } = media;
  return (
    <div className="fr-media">
      {/* 16:9 반응형 래퍼 — aspect-ratio로 어떤 폭에서도 비율 유지 */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 9',
          borderRadius: 10,
          overflow: 'hidden',
          background: '#000',
        }}
      >
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
          title={`${songTitle}${artist ? ` — ${artist}` : ''}`}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
        />
      </div>
      {(songTitle || artist) && (
        <div
          style={{
            fontSize: '0.82rem',
            color: 'var(--text-muted)',
            marginTop: 8,
            display: 'flex',
            alignItems: 'baseline',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          {songTitle && <strong style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{songTitle}</strong>}
          {artist && <span lang={langCode}>{artist}</span>}
        </div>
      )}

      {/* 가사 한 줄 — 기존 예문과 동일 톤(루비 + ko) */}
      {line?.ja && (
        <div className="fr-example" style={{ marginTop: 12 }}>
          <div className="fr-example__fr">
            {langCode === 'ja' ? (
              <JaText ja={line.ja} yomi={refPron(line)} />
            ) : (
              <span lang={langCode}>{line.ja}</span>
            )}
          </div>
          {line.ko && <div className="fr-example__ko">{line.ko}</div>}
        </div>
      )}

      {/* point · culture — 본문 스타일 */}
      {point && (
        <div className="fr-section__detail" style={{ marginTop: 12 }}>
          <p className="fr-section__para">{refInline(point)}</p>
        </div>
      )}
      {culture && (
        <div className="fr-section__detail">
          <p className="fr-section__para">{refInline(culture)}</p>
        </div>
      )}
    </div>
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

export function FormulaicChapterIntro({ formulaic }) {
  if (!formulaic) return null;

  return (
    <div
      role="note"
      data-formulaic-intro="true"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        marginBottom: 18,
        padding: '10px 12px',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--primary-glow)',
        color: 'var(--text-secondary)',
        fontSize: '0.84rem',
        lineHeight: 1.5,
      }}
    >
      <strong
        style={{
          flexShrink: 0,
          color: 'var(--primary-light)',
          fontSize: '0.72rem',
        }}
      >
        장면 고정구
      </strong>
      <span>여기 나온 문형은 통째로 익히는 고정구예요. 문법 분석은 후속 챕터에서 다룹니다.</span>
    </div>
  );
}

/**
 * 언어 레퍼런스 — 문법 챕터 상세 페이지 (프랑스어·일본어·영어 공용)
 */
export default async function ReferenceChapterPage({ lang, slug }) {
  const ref = getRefLang(lang);
  const data = ref?.getChapter(slug);
  const backHref = `/lessons?lang=${lang}&view=ref`;

  // 콘텐츠 오버라이드 — 원본 위에 오너 수정본을 병합(실패 시 조용히 원본 렌더).
  // 이전/다음 제목도 같은 언어의 오버라이드 맵으로 병합한다.
  const [override, overrideMap] = data
    ? await Promise.all([getChapterOverride(lang, slug), getOverridesForLang(lang)])
    : [null, new Map()];

  if (!data) {
    return (
      <div className="page-container" style={{ maxWidth: 760, textAlign: 'center', paddingTop: 80 }}>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>챕터를 찾을 수 없어요</h1>
        <Link href={backHref} className="btn btn--ghost btn--sm">{ref?.name || ''} 강의 목록으로 →</Link>
      </div>
    );
  }

  const { chapter: baseChapter, prev: basePrev, next: baseNext } = data;
  const chapter = mergeChapter(baseChapter, override);
  // 이전/다음은 제목만 오버라이드 병합(slug·level은 병합 유틸이 base로 강제).
  const prev = basePrev ? mergeChapter(basePrev, overrideMap.get(basePrev.slug)) : null;
  const next = baseNext ? mergeChapter(baseNext, overrideMap.get(baseNext.slug)) : null;
  const meta = ref.getLevelMeta(chapter.level);
  const courseLesson = getCourseLessonContext(lang, chapter.level, chapter.slug);
  // 인트로 레벨(OT/A0) — "간단히 알고 가면 좋을 것". 카나 외에는 관문(패턴 체크) 없이 읽으면 끝.
  const isIntro = ref.isIntroLevel?.(chapter.level);
  // 첫 정규 레벨 라벨 — 인트로 안내 카드에서 "본격 학습은 …부터" 문구에 사용
  const firstRegularLabel = ref.LEVEL_META?.[1]?.label || '다음 레벨';
  // 핵심 패턴 한눈에 — pattern이 있는 섹션만 모아 상단 요약
  const patternIndex = chapter.sections
    .map((sec, i) => ({ i, pattern: sec.pattern }))
    .filter(p => p.pattern);
  // 패턴 체크 v2 — 3단계 퀴즈 구성 (의미 매칭 → 적용 → 생산). 빌더는 refQuiz.js 공유.
  const quiz = buildChapterQuiz(chapter, ref);

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
        <InlineEdit lang={lang} slug={slug} path="title">
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.7rem', fontWeight: 700, lineHeight: 1.42, letterSpacing: '-0.01em', wordBreak: 'keep-all' }}>{chapter.title}</h1>
        </InlineEdit>
        {(() => {
          // topic이 원어 제목을 이미 포함하면 중복 표기 생략
          const titleFr = chapter.titleFr && !(chapter.topic || '').includes(chapter.titleFr)
            ? chapter.titleFr : null;
          if (!chapter.topic && !titleFr) return null;
          // topic·titleFr은 한 줄을 공유 — 하나의 연필로 두 스칼라를 함께 편집(콤마 경로)
          return (
            <InlineEdit lang={lang} slug={slug} path="topic,titleFr">
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: 5 }}>
                {chapter.topic}
                {chapter.topic && titleFr && ' · '}
                {titleFr && <span lang={ref.langCode} style={{ fontStyle: 'italic' }}>{titleFr}</span>}
              </p>
            </InlineEdit>
          );
        })()}
        {chapter.summary && (
          <InlineEdit lang={lang} slug={slug} path="summary">
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 10 }}>
              {chapter.summary}
            </p>
          </InlineEdit>
        )}
      </header>

      <FormulaicChapterIntro formulaic={chapter.formulaic === true} />

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
      {chapter.sections.map((sec, i) => {
        // RFC v2 섹션 타입 (실전 샌드위치)
        if (sec.type === 'authenticIntro') {
          return (
            <section key={i} id={`sec-${i + 1}`} className="card fr-section">
              <InlineEdit lang={lang} slug={slug} path={`sections.${i}.heading`}>
                <h2 className="fr-section__heading">
                  <span className="fr-section__num" style={{ background: meta?.bg, color: meta?.color }}>{i + 1}</span>
                  {sec.heading}
                </h2>
              </InlineEdit>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                {sec.presentationFraming}
              </p>
              {/* 오디오 플레이어 (실제 구현: audio 태그 또는 외부 플레이어) */}
              <div className="fr-audio-player" style={{ marginBottom: 16, padding: 12, background: 'var(--bg-muted)', borderRadius: 8 }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                  🔊 원음 대화 ({sec.audio?.duration || 'N/A'})
                </p>
                <div style={{ marginTop: 8 }}>
                  <p style={{ fontSize: '0.88rem', fontStyle: 'italic', marginBottom: 8, whiteSpace: 'pre-wrap' }}>
                    {sec.captions?.original}
                  </p>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                    {sec.captions?.translation}
                  </p>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
                  출처: {sec.audio?.attribution}
                </p>
              </div>
            </section>
          );
        }

        if (sec.type === 'vocabPreview') {
          return (
            <section key={i} id={`sec-${i + 1}`} className="card fr-section">
              <InlineEdit lang={lang} slug={slug} path={`sections.${i}.heading`}>
                <h2 className="fr-section__heading">
                  <span className="fr-section__num" style={{ background: meta?.bg, color: meta?.color }}>{i + 1}</span>
                  {sec.heading}
                </h2>
              </InlineEdit>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                {sec.vocabs?.map((vocab, j) => (
                  <div key={j} style={{ padding: 10, background: 'var(--bg-muted)', borderRadius: 6, fontSize: '0.9rem' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{vocab.word}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                      {vocab.meanings.join(', ')}
                    </div>
                    {vocab.exampleSentence && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 4 }}>
                        "{vocab.exampleSentence}"
                      </div>
                    )}
                    {vocab.note && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        ∟ {vocab.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        }

        if (sec.type === 'authenticReplay') {
          return (
            <section key={i} id={`sec-${i + 1}`} className="card fr-section">
              <InlineEdit lang={lang} slug={slug} path={`sections.${i}.heading`}>
                <h2 className="fr-section__heading">
                  <span className="fr-section__num" style={{ background: meta?.bg, color: meta?.color }}>{i + 1}</span>
                  {sec.heading}
                </h2>
              </InlineEdit>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                {sec.presentationFraming}
              </p>
              {/* 원본 자료 */}
              <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--border-muted)' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 10 }}>원본 대화</h3>
                <div style={{ padding: 12, background: 'var(--bg-muted)', borderRadius: 8 }}>
                  <p style={{ fontSize: '0.88rem', fontStyle: 'italic', marginBottom: 8, whiteSpace: 'pre-wrap' }}>
                    {sec.original?.captions?.original}
                  </p>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                    {sec.original?.captions?.translation}
                  </p>
                </div>
              </div>
              {/* 변형 자료 */}
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 6 }}>다른 상황에서</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 10 }}>
                  {sec.variant?.transitionNote}
                </p>
                <div style={{ padding: 12, background: 'var(--bg-muted)', borderRadius: 8 }}>
                  <p style={{ fontSize: '0.88rem', fontStyle: 'italic', marginBottom: 8, whiteSpace: 'pre-wrap' }}>
                    {sec.variant?.captions?.original}
                  </p>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                    {sec.variant?.captions?.translation}
                  </p>
                </div>
              </div>
              {/* 자가 체크 버튼 */}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                {sec.selfCheckOptions?.map((opt, j) => (
                  <button key={j} style={{
                    flex: 1, padding: '8px 12px', fontSize: '0.85rem', borderRadius: 4,
                    border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                    cursor: 'pointer', fontWeight: 600
                  }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </section>
          );
        }

        if (sec.type === 'practiceAndRegistration') {
          return (
            <section key={i} id={`sec-${i + 1}`} className="card fr-section">
              <InlineEdit lang={lang} slug={slug} path={`sections.${i}.heading`}>
                <h2 className="fr-section__heading">
                  <span className="fr-section__num" style={{ background: meta?.bg, color: meta?.color }}>{i + 1}</span>
                  {sec.heading}
                </h2>
              </InlineEdit>
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 10 }}>쓰기 연습</h3>
                <ul style={{ paddingLeft: 20, margin: 0 }}>
                  {sec.writingPrompts?.map((prompt, j) => (
                    <li key={j} style={{ fontSize: '0.9rem', lineHeight: 1.5, marginBottom: 8 }}>
                      {prompt}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 10 }}>선택형 문제</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {sec.quizItems?.length || 0}개 문항
                </p>
              </div>
            </section>
          );
        }

        // 기존 v1 섹션 렌더
        return (
        <section key={i} id={`sec-${i + 1}`} className="card fr-section">
          <InlineEdit lang={lang} slug={slug} path={`sections.${i}.heading`}>
            <h2 className="fr-section__heading">
              <span className="fr-section__num" style={{ background: meta?.bg, color: meta?.color }}>{i + 1}</span>
              {sec.heading}
            </h2>
          </InlineEdit>

          {/* 패턴 공식 박스 — 섹션의 핵심을 가장 먼저, 가장 크게 (pattern·patternKo 각각 연필) */}
          {sec.pattern && (
            <div className="fr-pattern" style={{ borderColor: meta?.color }}>
              <InlineEdit lang={lang} slug={slug} path={`sections.${i}.pattern`}>
                <div className="fr-pattern__text">{refInline(sec.pattern)}</div>
              </InlineEdit>
              {sec.patternKo && (
                <InlineEdit lang={lang} slug={slug} path={`sections.${i}.patternKo`}>
                  <div className="fr-pattern__ko">{sec.patternKo}</div>
                </InlineEdit>
              )}
            </div>
          )}

          {/* 스토리 모듈(이야기로 확인) — 내레이션·대사 + 인터랙티브 문항 */}
          {sec.story && (
            <InlineEdit lang={lang} slug={slug} kind="json" path={`sections.${i}.story`}>
              <StoryCheck story={sec.story} slug={chapter.slug} lang={lang} langCode={ref.langCode} meta={meta} />
            </InlineEdit>
          )}

          {sec.table && (
            <InlineEdit lang={lang} slug={slug} kind="json" path={`sections.${i}.table`}>
              <SectionTable table={sec.table} />
            </InlineEdit>
          )}
          <ExampleList examples={sec.examples} langCode={ref.langCode} lang={lang} slug={slug} secIndex={i} />

          {/* 상세 설명 — 패턴·예문 아래의 부가 설명 (문단별 연필) */}
          {sec.body && (
            <div className="fr-section__detail">
              {sec.body.split(/\n\n/).map((para, j) => (
                <InlineEdit key={j} lang={lang} slug={slug} path={`sections.${i}.body.p${j}`}>
                  <p className="fr-section__para">{refInline(para)}</p>
                </InlineEdit>
              ))}
            </div>
          )}

          {/* 챕터 미디어 — 설명 흐름 안에 심는 노래/영상 한 컷 (별도 섹션 금지: 오너) */}
          {sec.media && (
            <InlineEdit lang={lang} slug={slug} kind="json" path={`sections.${i}.media`}>
              <MediaSection media={sec.media} langCode={ref.langCode} lang={lang} />
            </InlineEdit>
          )}

          {sec.enParallel && <RefParallel data={sec.enParallel} />}
          {sec.hanjaBridge && <RefHanjaBridge data={sec.hanjaBridge} />}

          {CALLOUT_ORDER.map(kind => (
            sec[kind] ? (
              <InlineEdit key={kind} lang={lang} slug={slug} path={`sections.${i}.${kind}`}>
                <Callout kind={kind} text={sec[kind]} />
              </InlineEdit>
            ) : null
          ))}

          {/* 카나 오십음표 — 설명을 먼저 읽은 뒤 표(버튼) */}
          {sec.gojuon && chapter.kana && <GojuonChart kind={chapter.kana} sets={sec.gojuon} />}
        </section>
        );
      })}

      {/* ── 챕터 마무리 ── */}
      {chapter.kana ? (
        /* 카나 챕터: 카나→로마자 테스트 (오십음표 학습 표는 위 섹션 안에) — 인트로여도 유지 */
        <KanaTest kind={chapter.kana} slug={chapter.slug} storageKey={`${ref.readKey}_check`} lang={lang} />
      ) : isIntro ? (
        /* 인트로 레벨(OT/A0) 비(非)카나 챕터: 관문 없이 가볍게 읽고 넘어가는 안내 카드 */
        <section className="card fr-section" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
            이 챕터는 가볍게 읽고 넘어가면 돼요 — 본격 학습은 <strong>{firstRegularLabel}</strong>부터예요.
          </p>
          {next && (
            <Link href={`${ref.base}/grammar/${next.slug}`} className="fr-check__next">
              다음 챕터 · {next.title} →
            </Link>
          )}
        </section>
      ) : (
        /* ── 패턴 체크 (3단계 퀴즈 + 통과 관문) ── */
        <RefPatternCheck
          quiz={quiz}
          lang={lang}
          langCode={ref.langCode}
          storageKey={`${ref.readKey}_check`}
          slug={chapter.slug}
          intro={isIntro}
          next={next ? { href: `${ref.base}/grammar/${next.slug}`, title: next.title } : null}
          reviewLinks={reviewLinks}
        />
      )}

      {/* 읽음 기록 — 여기(챕터 끝)까지 스크롤해야 읽음 처리 */}
      <RefReadMark storageKey={ref.readKey} slug={chapter.slug} />

      {courseLesson && (
        <LessonCompletionCta
          lessonRef={courseLesson.lessonRef}
          nextLesson={courseLesson.nextLesson}
        />
      )}

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

      {/* 관리자 전용 슬림 스트립 — 인라인 연필(InlineEdit)로 편집하고, 여기선 상태·복원만.
          isAdmin이 아니면 null 렌더. 챕터 데이터는 props로 넘기지 않는다(일반 유저 페이로드 보호). */}
      <ChapterAdminStrip lang={lang} slug={slug} overridden={!!override} />
    </div>
  );
}
