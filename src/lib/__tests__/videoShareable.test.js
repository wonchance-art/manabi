import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import {
  CC_SOURCE, PD_SOURCE, LICENSE_CC_BY, LICENSE_PUBLIC_DOMAIN,
  attributionParts, isCreativeCommonsText, isShareableSource, licenseForSource,
} from '../videoAttribution';
import {
  MIN_BODY_CHARS, buildShareableArticle, readLicenseText, shareableSource,
} from '../server/youtubeShareable';
import { DEFAULT_SOURCES } from '../suggestionSources';

/**
 * 계약: v2-F R5 — **공유 가능한 영상**(퍼블릭 도메인 · CC BY). 오너 "A ㄱㄱ", 2026-09-01.
 *
 * F R4는 「서버는 목록만」이었다. 이 라운드는 **그 제약이 없는 자료**를 연다 —
 * 재배포가 허용된 것은 본문을 담아 공개 자료로 둘 수 있고, 분석도 1회면 된다.
 *
 * 오픈소스 조사가 이 라운드를 만들었다: `youtubei.js`의 `SearchFilters.features`가
 * `'creative_commons'`를 받는다는 것(실측: types/Misc.d.ts:9 → Innertube.js:157)과,
 * YouTube-Commons가 **CC-BY 영상 316만 편**을 모았다는 규모 증거.
 *
 * ── 이 파일의 무게중심은 **오공개 방지**다
 *
 * 잘못 공개하는 쪽이 놓치는 쪽보다 훨씬 비싸다. 그래서 판정은 전부 fail-closed이고,
 * 특히 라이선스는 **검색 필터를 믿지 않고 영상마다 재확인**한다.
 *
 * ⚠ 실측이 두 번 고쳐 준 것:
 *  ① `VideoInfo.license`를 찾았다고 여겼는데 그건 **`music_tracks` 안**(배경음악)이었다.
 *     영상 라이선스는 지역화된 문자열 행이라 판정이 그만큼 약하다 — 그래서 fail-closed.
 *  ② `metadata.source`는 **저장만 되고 어디에도 표시되지 않았다.** CC BY에서 표기는
 *     선택이 아니라 **조건**이다. 저장은 표기가 아니다.
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const rows = (list) => ({ secondary_info: { metadata: { rows: list } } });

describe('F R5 — 라이선스 판정은 fail-closed다', () => {
  it('CC는 **행에서 재확인**돼야 등급을 준다 — 검색 필터만으로는 안 된다', () => {
    expect(shareableSource({}, 'Creative Commons Attribution license (reuse allowed)')).toBe(CC_SOURCE);
    expect(shareableSource({}, null), '행을 못 읽으면 공개 불가').toBe(null);
    expect(shareableSource({}, 'Standard YouTube License')).toBe(null);
    expect(shareableSource({}, '')).toBe(null);
  });

  it('퍼블릭 도메인은 **설정이 근거**다 — VOA는 미국법에서 오지 YouTube 표식에서 오지 않는다', () => {
    // VOA 영상에 CC 표식이 없어도 퍼블릭 도메인이다. 표식만 보면 이 자료를 통째로 놓친다.
    expect(shareableSource({ license: 'public-domain' }, null)).toBe(PD_SOURCE);
    expect(shareableSource({ license: 'public-domain' }, 'Standard YouTube License')).toBe(PD_SOURCE);
  });

  it('License 행만 본다 — 다른 행의 「Creative Commons」에 속지 않는다', () => {
    // 이게 무너지면 설명·카테고리에 그 말이 있는 영상이 통째로 공개된다. 전체 텍스트를
    // 훑는 구현이었다면 여기서 바로 새어 나갔을 자리다.
    expect(readLicenseText(rows([{ title: 'Category', contents: 'Creative Commons 어쩌구' }]))).toBe(null);
    expect(readLicenseText(rows([
      { title: 'Category', contents: 'Education' },
      { title: 'License', contents: 'Creative Commons Attribution license (reuse allowed)' },
    ]))).toMatch(/Creative Commons/);
  });

  it('행 자체가 없으면 null — 미확인은 거부다', () => {
    expect(readLicenseText({})).toBe(null);
    expect(readLicenseText(rows([]))).toBe(null);
    expect(readLicenseText(null)).toBe(null);
  });

  it('텍스트 판정이 빈 값·표준 라이선스를 거부한다', () => {
    expect(isCreativeCommonsText('')).toBe(false);
    expect(isCreativeCommonsText(null)).toBe(false);
    expect(isCreativeCommonsText('Standard YouTube License')).toBe(false);
    expect(isCreativeCommonsText('Creative Commons Attribution license')).toBe(true);
  });

  it('공유 등급과 라이선스 코드가 짝을 이룬다', () => {
    expect(isShareableSource(CC_SOURCE)).toBe(true);
    expect(isShareableSource(PD_SOURCE)).toBe(true);
    expect(isShareableSource('youtube_ondemand'), 'F R4 개인 반입분은 공유 대상이 아니다').toBe(false);
    expect(licenseForSource(CC_SOURCE)).toBe(LICENSE_CC_BY);
    expect(licenseForSource(PD_SOURCE)).toBe(LICENSE_PUBLIC_DOMAIN);
    expect(licenseForSource('youtube_ondemand')).toBe(null);
  });
});

describe('F R5 — 본문을 담는 조건', () => {
  const info = (license, langs = ['en']) => ({
    ...rows([{ title: 'License', contents: license }]),
    captions: { caption_tracks: langs.map((c) => ({ language_code: c, base_url: 'https://x/y' })) },
    playability_status: { embeddable: true },
  });
  const video = { videoId: 'v1', title: 'T', channel: 'C', thumbnailUrl: 'u' };
  const okFetch = async () => ({
    ok: true,
    text: async () => JSON.stringify({
      events: Array.from({ length: 40 }, (_, i) => ({ tStartMs: i * 1000, dDurationMs: 900, segs: [{ utf8: `line ${i} of the transcript body` }] })),
    }),
  });

  it('라이선스가 미확인이면 자막이 있어도 안 담는다', async () => {
    const a = await buildShareableArticle(
      { video, info: info('Standard YouTube License'), config: {}, langCode: 'en' },
      { fetch: okFetch },
    );
    expect(a).toBe(null);
  });

  it('통과하면 본문과 라이선스를 함께 싣는다', async () => {
    const a = await buildShareableArticle(
      { video, info: info('Creative Commons Attribution license'), config: {}, langCode: 'en', level: 'B1 중급' },
      { fetch: okFetch },
    );
    expect(a?.source).toBe(CC_SOURCE);
    expect(a?.license).toBe(LICENSE_CC_BY);
    expect(a?.transcript?.length).toBeGreaterThan(MIN_BODY_CHARS);
    expect(a?.videoId, '실제 유튜브 id 그대로').toBe('v1');
  });

  it('그 언어 자막이 없으면 안 담는다', async () => {
    const a = await buildShareableArticle(
      { video, info: info('Creative Commons Attribution license', ['de']), config: {}, langCode: 'ja' },
      { fetch: okFetch },
    );
    expect(a).toBe(null);
  });

  it('임베드 불가 영상은 안 담는다 — isListable의 **고유** 역할이 여기다', async () => {
    // 자막 언어 요건은 selectCaptionTrack이 어차피 막는다(돌연변이 M5가 그래서 살아남았다).
    // isListable을 여기 두는 값은 임베드 판정 하나뿐이라, 그걸 직접 고정한다.
    const blocked = {
      ...info('Creative Commons Attribution license'),
      playability_status: { embeddable: false },
    };
    const a = await buildShareableArticle(
      { video, info: blocked, config: {}, langCode: 'en' },
      { fetch: okFetch },
    );
    expect(a).toBe(null);
  });

  it('본문이 짧으면 안 담는다 — 자막 조각은 학습 자료가 아니다', async () => {
    const shortFetch = async () => ({
      ok: true, text: async () => JSON.stringify({ events: [{ tStartMs: 0, dDurationMs: 900, segs: [{ utf8: '짧다' }] }] }),
    });
    const a = await buildShareableArticle(
      { video, info: info('Creative Commons Attribution license'), config: {}, langCode: 'en' },
      { fetch: shortFetch },
    );
    expect(a).toBe(null);
  });

  it('자막 요청이 실패(ok:false)하면 본문이 와도 안 담는다', async () => {
    // 처음엔 `{ ok: false }`만 준 픽스처였는데, 그러면 `res.text()`가 없어 **예외로** 죽는다 —
    // `if (!res.ok)` 가드를 지워도 통과했다(돌연변이 M8 생존). 본문이 멀쩡히 오는데도
    // 상태 코드만으로 버리는지를 봐야 가드가 판별력을 갖는다.
    const bodyOk = (await okFetch()).text;
    const a = await buildShareableArticle(
      { video, info: info('Creative Commons Attribution license'), config: {}, langCode: 'en' },
      { fetch: async () => ({ ok: false, text: bodyOk }) },
    );
    expect(a).toBe(null);
  });

  it('본문 정리는 F R1과 **같은 정본**을 탄다 — 두 문으로 들어온 같은 영상이 갈리면 안 된다', () => {
    const src = read('src/lib/server/youtubeShareable.js');
    expect(src).toContain("from '../linkImport.js'");
    expect(src).toContain('stripCueNoise');
    expect(src).toContain('paragraphize');
    expect(src, '자막 파서를 새로 짜지 않는다').toContain('parseCaptionData');
  });
});

describe('F R5 — 배선', () => {
  it('VOA가 퍼블릭 도메인으로 표시돼 본문을 담는다', () => {
    const voa = DEFAULT_SOURCES.find((s) => s.config?.handle?.includes('VOA'));
    expect(voa?.config?.license).toBe('public-domain');
  });

  it('CC 검색 소스가 있고 query·langCode를 갖춘다', () => {
    const cc = DEFAULT_SOURCES.filter((s) => s.source_type === 'youtube_cc');
    expect(cc.length).toBeGreaterThanOrEqual(2);
    for (const s of cc) {
      expect(s.config.query).toBeTruthy();
      expect(s.config.langCode, 'langCode가 없으면 자막 필터가 풀린다').toBeTruthy();
    }
  });

  it('검색이 CC·자막 필터를 실제로 건다', () => {
    const src = read('src/lib/server/youtubeShareable.js');
    expect(src).toContain("features: ['subtitles', 'creative_commons']");
  });

  it('세션 언어를 en으로 고정한다 — 판정이 지역화 문자열에 걸려 있다', () => {
    // 언어가 흔들리면 License 행 제목을 못 찾아 전부 fail-closed로 떨어진다(수확 0).
    expect(read('src/lib/server/youtubeShareable.js')).toMatch(/Innertube\.create\(\{[^}]*lang: 'en'/);
  });

  it('디스패처가 youtube_cc를 받고 무거운 모듈은 동적 import다', () => {
    const cs = read('src/lib/content-sources.js');
    expect(cs).toContain("case 'youtube_cc'");
    expect(cs).toContain("await import('./server/youtubeShareable.js')");
  });

  it('채널 수집이 license 설정을 만나면 공유 경로로 간다', () => {
    expect(read('src/lib/server/youtubeChannel.js')).toContain("config.license");
  });
});

describe('F R5 — 표기는 저장이 아니라 **표시**다', () => {
  it('뷰어가 출처를 실제로 렌더한다', () => {
    // metadata.source는 F R1부터 저장돼 있었지만 **어디에도 안 보였다**.
    // CC BY에서 표기는 선택이 아니라 조건이라, 이 계약이 그 구멍을 막는다.
    const v = read('src/views/ViewerPage.jsx');
    // 파일에 이름만 남아 있는 것으로는 부족하다 — 실제로 **자료의 출처를 읽어** 그리는지
    // 봐야 한다(돌연변이 M13이 `const at = null;`로 로직만 죽이고 통과했다).
    expect(v).toContain('attributionParts(material?.metadata?.source)');
    expect(v).toContain('viewer-attribution');
    expect(v, '원본 링크가 없으면 표기가 반쪽이다').toContain('원본 보기');
  });

  it('추천에서 온 공유 자료가 라이선스를 metadata.source에 싣는다', () => {
    const page = read('src/views/MaterialAddPage.jsx');
    const effect = sliceBetween(page, "const suggestionId = searchParams.get('suggestion')", '}, []);');
    expect(effect).toContain('isShareableSource');
    expect(effect).toContain('licenseForSource');
    expect(effect).toContain('setLinkSource');
  });

  it('라이선스를 모르면 라이선스 이름을 안 쓴다 — 없는 권리를 주장하지 않는다', () => {
    const at = attributionParts({ kind: 'youtube', channel: 'C', url: 'u' });
    expect(at.license).toBe('');
    expect(attributionParts({ kind: 'youtube', channel: 'C', url: 'u', license: LICENSE_CC_BY }).license).toBe('CC BY');
  });

  it('영상 출처가 아니면 표기 줄이 없다', () => {
    expect(attributionParts({ kind: 'pdf' })).toBe(null);
    expect(attributionParts(null)).toBe(null);
    expect(attributionParts({ kind: 'youtube' }), '채널·주소 둘 다 없으면 쓸 게 없다').toBe(null);
  });

  it('표기 줄 색은 토큰만 — 규약 §1', () => {
    const block = sliceBetween(read('src/index.css'), '.viewer-attribution {', '.suggestion-card__note {');
    expect(block).toContain('var(--');
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}|rgba?\(/);
  });
});
