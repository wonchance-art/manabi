import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import {
  CC_SOURCE, PD_SOURCE, LICENSE_CC_BY, LICENSE_PUBLIC_DOMAIN,
  attributionParts, isCreativeCommonsText, isShareableSource, licenseForSource, materialSource, safeYoutubeUrl,
} from '../videoAttribution';
import { createSuggestionSave } from '../suggestionReading';
import { DEFAULT_SOURCES } from '../suggestionSources';

/**
 * 계약: v2-F R5 — **공유 가능한 영상**(퍼블릭 도메인 · CC BY). 오너 "A ㄱㄱ", 2026-09-01.
 *
 * ⚠ YT-API-001(2026-11-08 KST, 오너 b안): 수집은 공식 Data API로 옮겼고, 공식 API는 남의 자막 본문을 못 받으므로
 *   「본문을 담는 공개 자료」 갈래(buildShareableArticle · 라이선스 행 읽기)는 닫았다 — 새 수집 카드는 목록만(youtube_ondemand).
 *   이 파일에 남은 것은 **이미 저장된** CC · PD 공개 자료의 출처 표기와 설정 · 텍스트 판정이다. 새 판정 계약 = youtubeDataApi.test.js.
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

describe('F R5 — 라이선스 판정은 fail-closed다', () => {
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

describe('F R5 — 배선', () => {
  it('VOA가 퍼블릭 도메인으로 표시돼 있다(이미 저장된 공개 자료의 출처 표기 근거 — 새 수집은 목록만, YT-API-001)', () => {
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



  it('디스패처가 youtube_cc를 받고 무거운 모듈은 동적 import다', () => {
    const cs = read('src/lib/content-sources.js');
    expect(cs).toContain("case 'youtube_cc'");
    expect(cs).toContain("await import('./server/youtubeShareable.js')");
  });

});

describe('F R5 — 표기는 저장이 아니라 **표시**다', () => {
  it('뷰어가 출처를 실제로 렌더한다', () => {
    // metadata.source는 F R1부터 저장돼 있었지만 **어디에도 안 보였다**.
    // CC BY에서 표기는 선택이 아니라 조건이라, 이 계약이 그 구멍을 막는다.
    const v = read('src/views/ViewerPage.jsx');
    // 파일에 이름만 남아 있는 것으로는 부족하다 — 실제로 **자료의 출처를 읽어** 그리는지
    // 봐야 한다(돌연변이 M13이 `const at = null;`로 로직만 죽이고 통과했다).
    expect(v).toContain('attributionParts(materialSource(material))');
    // 행에 metadata 열은 없다 — 예전 계약이 박제했던 `material?.metadata?.source`는 늘 undefined였다(2026-10-13).
    expect(v).not.toMatch(/material\??\.metadata\??\.source/);
    expect(v).toContain('viewer-attribution');
    expect(v, '원본 링크가 없으면 표기가 반쪽이다').toContain('원본 보기');
  });

  it('추천에서 온 공유 자료가 라이선스를 metadata.source에 싣는다', () => {
    const save = read('src/lib/suggestionReading.js');
    expect(save).toContain('meta.source =');
    expect(save).toContain('license: licenseForSource(suggestion.source)');
    expect(read('src/components/materials/SuggestionReader.jsx')).toContain('{license && <span>{license}</span>}');
  });

  it('저장하는 쪽이 쓴 자리에서 읽는다 — 추천 읽기로 담은 CC BY 영상 행에 출처 줄이 생긴다', async () => {
    // 쓰는 쪽 실물(createSuggestionSave)이 만든 행을 그대로 읽는다. 쓰는 자리와 읽는 자리가 갈리면 여기서 깨진다.
    const save = await createSuggestionSave('owner', {
      id: '22222222-2222-4222-8222-222222222222', date: '2026-10-13', title: 'Clip', language: 'English',
      transcript: 'Hello.\n\nAnother paragraph.', source: CC_SOURCE, video_id: 'abcdefghijk', channel_name: 'Open Channel', level: 'B1',
    });
    const row = save.attempt.row;
    expect(row.metadata, '자료 행에는 metadata 열이 없다').toBeUndefined();
    expect(attributionParts(materialSource(row))).toEqual({
      channel: 'Open Channel', license: 'CC BY', url: 'https://www.youtube.com/watch?v=abcdefghijk',
    });
  });

  it('자료 추가의 링크 반입도 같은 자리(processed_json.metadata.source)에 쓴다', () => {
    const page = read('src/views/MaterialAddPage.jsx');
    const initJson = sliceBetween(page, 'const initJson = {', 'const materialRow = {');
    expect(initJson).toContain('metadata: {');
    expect(initJson).toContain('...(linkSource ? { source: linkSource } : {}),');
    expect(materialSource({ processed_json: { metadata: { source: { kind: 'youtube', channel: 'C', url: 'u' } } } }))
      .toEqual({ kind: 'youtube', channel: 'C', url: 'u' });
    expect(materialSource({ metadata: { source: { kind: 'youtube', channel: 'C' } } }), '없는 열은 읽지 않는다').toBe(null);
    expect(materialSource(null)).toBe(null);
  });

  it('라이선스를 모르면 라이선스 이름을 안 쓴다 — 없는 권리를 주장하지 않는다', () => {
    const at = attributionParts({ kind: 'youtube', channel: 'C', url: 'u' });
    expect(at.license).toBe('');
    expect(attributionParts({ kind: 'youtube', channel: 'C', url: 'u', license: LICENSE_CC_BY }).license).toBe('CC BY');
  });

  it('원본 링크는 https 유튜브 주소만 — 소유자가 쓴 값이 공개 자료에서 임의 링크가 되지 않는다', () => {
    expect(safeYoutubeUrl('https://www.youtube.com/watch?v=abcdefghijk')).toBe('https://www.youtube.com/watch?v=abcdefghijk');
    expect(safeYoutubeUrl('https://youtu.be/abcdefghijk')).toBe('https://youtu.be/abcdefghijk');
    expect(safeYoutubeUrl('https://m.youtube.com/watch?v=abcdefghijk')).toBe('https://m.youtube.com/watch?v=abcdefghijk');
    for (const bad of ['javascript:alert(1)', 'http://www.youtube.com/watch?v=x', 'https://youtube.com.evil.example/x',
      'https://evilyoutube.com/x', 'https://user:pw@www.youtube.com/x', 'data:text/html,hi', '', null, 'u']) {
      expect(safeYoutubeUrl(bad), String(bad)).toBe('');
    }
    expect(attributionParts({ kind: 'youtube', channel: 'C', url: 'javascript:alert(1)' })).toEqual({ channel: 'C', license: '', url: '' });
    expect(attributionParts({ kind: 'youtube', url: 'javascript:alert(1)' }), '채널도 안전한 주소도 없으면 줄이 없다').toBe(null);
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
