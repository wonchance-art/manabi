import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createArtBook } from '../artBook.js';
import { CANONICAL_LITERATURE_EDIT_BLOCKED } from '../literatureCanonical.js';
import { runPreservedReanalysis } from '../reanalysisPreservation.js';
import { VIEWER_MESSAGES, VIEWER_MESSAGE_LOCALES } from '../viewerMessages.js';
import { sliceBetween } from './helpers/sliceBetween';

// 「그림 한 장 읽기」 작품 정보 카드(ART-P0-3) — 배선 계약. 동작(실렌더)은 e2e 몫이고, 여기서는 「코드가 이렇게 쓰여 있다」를 묶는다.
//
// 기대 화면(오너 합의 목업, 본문 바로 위):
//   [그림]  (캡션: image.credit — 작게)
//   冨嶽三十六景 神奈川沖浪裏 · 후가쿠 36경 — 가나가와 앞바다 파도 아래
//   가쓰시카 호쿠사이(1760–1849) · 1830/33 · 에도 시대 · 가로로 긴 오반 크기 니시키에(다색 목판화)
//   소장  도쿄 국립박물관 ↗ · 시카고 미술관 ↗
//   그림 속 장소  도쿄만 · 후지산
//   찾아볼 것  ① … ② … ③ …
//   출처: ColBase(국립문화재기구) · … · 정부표준이용규약 2.0 · 원문 ↗

const read = (file) => readFileSync(path.join(process.cwd(), file), 'utf8');
const VIEWER = 'src/views/ViewerPage.jsx';
const CARD = 'src/components/viewer/ViewerArtCard.jsx';
const HOOK = 'src/lib/useArtBookChapter.js';
const CSS = 'src/components/viewer/art-card.css';

describe('뷰어 배선 — 카드는 대조를 통과한 장에서만', () => {
  const viewer = read(VIEWER);

  it('카드 값은 useArtBookChapter(카탈로그 해시 대조)에서만 온다 — 자료 metadata를 카드에 넘기지 않는다', () => {
    expect(viewer).toContain("import { useArtBookChapter } from '../lib/useArtBookChapter';");
    expect(viewer).toContain("import ViewerArtCard from '../components/viewer/ViewerArtCard';");
    expect(viewer).toContain('const artBookChapter = useArtBookChapter(material);');
    expect(viewer.match(/<ViewerArtCard\b[^>]*\/>/g)).toEqual(['<ViewerArtCard chapter={artBookChapter} vt={vt} />']);
    const card = read(CARD);
    expect(card, '카드가 자료(material)·processed_json을 직접 읽으면 가짜 metadata로 카드가 생긴다').not.toMatch(/\bmaterial\b|processed_json|raw_text/);
  });

  it('훅은 useCanonicalLiterature와 같은 모양 — verifiedArtChapter, 의존 배열, 늦은 대조 버림', () => {
    const hook = read(HOOK);
    expect(hook).toContain("import { ART_BOOK_PROVIDER, verifiedArtChapter } from './artBook';");
    expect(hook).toContain('useState(null)');
    expect(hook).toContain('if (provider !== ART_BOOK_PROVIDER) return undefined;');
    expect(hook).toContain('if (live) setChapter(value);');
    expect(hook).toContain('return () => { live = false; };');
    const deps = sliceBetween(hook, '}, [rawText', ']);');
    for (const dep of ['rawText', 'provider', 'key', 'order', 'work']) expect(deps, `의존 배열 누락: ${dep}`).toMatch(new RegExp(`\\b${dep}\\b`));
  });

  it('자리: 헤더 밖, 출처 줄(유튜브·아오조라·PDF) 다음, 읽기 진행 막대·본문 앞', () => {
    expect(sliceBetween(viewer, '<header className="page-header viewer-header">', '</header>')).not.toContain('ViewerArtCard');
    // 아오조라 출처 슬라이스(literatureAttribution.test.js)를 건드리지 않는다.
    expect(sliceBetween(viewer, '아오조라 정본 책 출처', 'PDF 출처 —')).not.toContain('ViewerArtCard');
    const afterPdf = sliceBetween(viewer, 'PDF 출처 —', '{/* Reading Progress Bar */}');
    expect(afterPdf).toContain('<ViewerArtCard chapter={artBookChapter} vt={vt} />');
    expect(afterPdf.match(/<ViewerArtCard\b/g)).toHaveLength(1);
  });
});

describe('카드 마크업 계약', () => {
  const card = read(CARD);

  it('원어(일본어) 제목에 lang="ja", 원문 표기 날짜는 가나·한자일 때만 lang="ja"', () => {
    expect(card).toContain('<span lang="ja">{card.title?.native}</span>');
    expect(card).toContain("lang={JAPANESE.test(card.date.text) ? 'ja' : undefined}");
  });

  it('바깥 링크는 모두 새 창 + rel="noopener noreferrer", 접근 이름은 보이는 이름으로 시작하고 무엇이 열리는지 말한다', () => {
    const blanks = card.match(/target="_blank"/g) || [];
    const rels = card.match(/target="_blank" rel="noopener noreferrer"/g) || [];
    expect(blanks.length).toBeGreaterThanOrEqual(2);
    expect(rels.length).toBe(blanks.length);
    expect(card).toContain("aria-label={vt('{name} 소장품 기록 보기(새 창)', { name: placeName(place) })}");
    expect(card).toContain("aria-label={vt('원문 보기(새 창)')}>{vt('원문')}");
    // 소장처 링크는 카탈로그의 소장품 기록 HTTPS 주소만.
    expect(card).toContain('<a href={httpsUrl(place.url)} target="_blank" rel="noopener noreferrer"');
  });

  it('그림 속 장소는 지역학 핀이 있을 때만 지도로 잇는다', () => {
    expect(card).toContain('const studiesMapHref = (pin) => `/studies/japan/map?pin=${encodeURIComponent(pin)}`;');
    expect(card).toContain('place.links?.studiesPin');
  });

  it('그림: 평범한 <img> — 데이터의 alt, 늦은 로딩, 불러오기 실패 시 그림만 숨기고 글 카드는 남긴다', () => {
    expect(card).not.toMatch(/from ['"]next\/image['"]/);
    const img = sliceBetween(card, '<img className="viewer-art-card__img"', '/>');
    for (const attr of ['alt={image.alt}', 'loading="lazy"', 'decoding="async"', 'onError={() => setFailedImage(imageUrl)}']) {
      expect(img, `img 속성 누락: ${attr}`).toContain(attr);
    }
    expect(card).toContain('const image = imageUrl && failedImage !== imageUrl ? card.image : null;');
    // 찾아볼 것은 그림을 보며 하는 질문 — 그림이 안 보이면 같이 숨는다. 비어 있으면 줄이 없다.
    expect(card).toContain('const lookFor = image ?');
    expect(card).toContain('{lookFor.length > 0 && (');
  });

  it('인라인 style·색 리터럴 없음 — 색은 CSS의 뷰어 별칭으로', () => {
    expect(card).not.toMatch(/style=\{/);
    expect(card).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    expect(card).toContain("import './art-card.css';");
  });

  it('화면 문구는 vt로 — 쓰는 문구가 세 화면 언어에 모두 있다', () => {
    const literals = [...card.matchAll(/\bvt\('((?:[^'\\]|\\.)*)'/g)].map((match) => match[1]);
    expect(literals.length).toBeGreaterThanOrEqual(7);
    for (const key of literals) {
      for (const locale of VIEWER_MESSAGE_LOCALES) expect(Object.hasOwn(VIEWER_MESSAGES[locale], key), `${locale} 미번역: ${key}`).toBe(true);
    }
  });
});

describe('카드 CSS — 토큰·접힘·초점', () => {
  const css = read(CSS);

  it('색 리터럴 없음(#fff 예외 밖), 뷰어 별칭(--reader-*)을 쓴다', () => {
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
    expect(css).toContain('var(--reader-line)');
    expect(css).toContain('var(--reader-muted)');
  });

  it('뷰포트 쿼리 신설 없음 — 좁은 화면 접힘은 @container', () => {
    expect(css).not.toMatch(/@media/);
    expect(css).toContain('container: art-card / inline-size;');
    expect(css).toMatch(/@container art-card \(max-width: \d+px\)/);
  });

  it('링크·작가 소개(summary)에 키보드 초점 고리, 접기 버튼은 44px', () => {
    expect(css).toContain('.viewer-layout .viewer-art-card :is(a, summary):focus-visible');
    expect(sliceBetween(css, '.viewer-layout .viewer-art-card__about > summary {', '}')).toContain('min-height: 44px');
    expect(css, '애니메이션을 두면 prefers-reduced-motion 분기도 함께').not.toMatch(/animation|transition/);
  });
});

describe('원문 수정 차단 — 큐레이션 책도 정본처럼', () => {
  const viewer = read(VIEWER);
  const chapter = createArtBook('ukiyoe-landscape-hokusai-hiroshige').chapters[0];
  const material = { id: 'm1', raw_text: chapter.rawText, processed_json: { metadata: chapter.metadata } };

  it('runPreservedReanalysis(뷰어 원문 수정·책 정제 공용 경로)가 바뀐 원문을 저장 전에 거부한다', async () => {
    const analyze = async () => { throw new Error('분석까지 가면 안 된다'); };
    await expect(runPreservedReanalysis(null, material, new AbortController().signal, analyze, { rawTextOverride: `${chapter.rawText}\n\n追記` }))
      .rejects.toThrow(CANONICAL_LITERATURE_EDIT_BLOCKED);
  });

  it('뷰어: 저장 처리·「원문 수정」 항목·이유 문구에 artBookLocked가 들어간다', () => {
    expect(viewer).toContain("import { isArtBookMaterial } from '../lib/artBook';");
    expect(viewer).toContain('const artBookLocked = isArtBookMaterial(material);');
    expect(sliceBetween(viewer, 'const handleSourceEditSave = async (plan) => {', 'if (!plan || plan.noop)')).toContain('if (artBookLocked) return;');
    const manage = sliceBetween(viewer, 'className="reader-manage"', "reanalyzePanel === 'confirm-full'");
    expect(manage).toContain('!artBookLocked && !canonicalLiteratureLocked && <button className="reanalyze-panel__item"');
    expect(manage).toContain('{artBookLocked && <p className="reader-metadata">{vt("정본 책이라 원문은 고칠 수 없어요")}');
  });

  it('일본어 「뜻 확인 필요」 검수는 아오조라 정본만 — 큐레이션 책으로 넓히지 않는다', () => {
    const sense = sliceBetween(viewer, 'const senseReviewAllowed =', ';\n');
    expect(sense).toContain("materialLang === 'Japanese' && canonicalLiteratureLocked");
    expect(sense).not.toMatch(/artBook/);
  });
});
