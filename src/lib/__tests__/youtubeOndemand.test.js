import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { sliceBetween } from './helpers/sliceBetween.js';
import {
  DEFAULT_SOURCES, ONDEMAND_SOURCE, isOnDemandSuggestion,
  suggestionSourceLabel, suggestionVideoUrl,
} from '../suggestionSources';
import {
  MAX_PROBES, isListable, probeBudget, toSuggestionArticle,
} from '../server/youtubeChannel';

/**
 * 계약: v2-F R4 — 영상 리스트업 + **클릭 시점 개인 반입** (오너 확정 2026-09-01).
 *
 * 오너 표현이 설계를 정했다 — 「리스트업은 우리가, 선택하는 순간 각각 개인의 private으로」.
 *
 * ── 선례가 이 자리를 가리켰다
 *
 * 조사에서 세 모델이 나왔다. 확장(Language Reactor·Migaku)은 서버가 콘텐츠를 아예 안
 * 만지고, 카탈로그(Lingopie·Yabla)는 계약하고, **LingQ는 사용자가 넣고 기본 비공개**다.
 * LingQ 문구가 F R1의 결정과 문장 단위로 같았다 — "all content you import is private
 * unless you explicitly share it". 우리는 이미 그 자리에 있었다.
 *
 * **아무도 안 하는 것**이 하나 있었는데, 그게 이 라운드의 첫 초안이었다 —
 * 서비스가 서버에서 자막을 미리 긁어 저장해 카탈로그로 제공하기. 셋 중 어디에도 없다.
 * 그래서 초안을 버리고 「목록만 담고, 복제는 누르는 사람이」로 뒤집었다.
 *
 * ⇒ 이 파일이 지키는 것은 **그 뒤집힘**이다. 되돌아가면 여기가 먼저 빨개진다.
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

describe('F R4 — 서버는 자막 본문을 담지 않는다 (이 라운드의 전부)', () => {
  it('크론이 만드는 기사에 transcript 키가 아예 없다', () => {
    // `transcript: null`도 아니고 **키 자체가 없다**. 나중에 누가 여기에 본문을 채우면
    // 그 순간 우리는 「남의 자막 DB를 만드는 서비스」가 된다.
    const a = toSuggestionArticle(
      { videoId: 'abc', title: 'T', channel: 'C', thumbnailUrl: 'u' },
      { source: ONDEMAND_SOURCE, level: 'N3 중급' },
    );
    expect('transcript' in a, '서버가 자막을 담기 시작했다').toBe(false);
    expect(a.source).toBe(ONDEMAND_SOURCE);
  });

  it('수집기가 자막 **본문**을 만지지 않는다 — 트랙 목록만 본다', () => {
    const src = read('src/lib/server/youtubeChannel.js');
    expect(src, '자막 언어 목록은 본문이 아니다').toContain('extractCaptionLangs');
    // 본문 취득 함수들이 여기 들어오면 설계가 뒤집힌 것이다.
    expect(src).not.toContain('getTranscript');
    expect(src).not.toContain('parseCaptionData');
    expect(src).not.toContain('normalizeTranscriptSegments');
  });

  it('videoId가 실제 유튜브 id다 — 접두사를 붙이면 클릭 시점에 주소를 못 만든다', () => {
    const a = toSuggestionArticle({ videoId: 'dQw4w9WgXcQ', title: 'T' }, { source: ONDEMAND_SOURCE });
    expect(a.videoId).toBe('dQw4w9WgXcQ');
    expect(suggestionVideoUrl({ video_id: a.videoId })).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(suggestionVideoUrl({}), 'id가 없으면 빈 문자열').toBe('');
  });
});

describe('F R4 — 자막 있는 영상만 리스트에 올린다 (fail-closed)', () => {
  it('그 언어 자막이 없으면 안 올린다 — 없으면 「클릭 하나」가 성립하지 않는다', () => {
    expect(isListable({ captionLangs: ['en'] }, 'ja')).toBe(false);
    expect(isListable({ captionLangs: [] }, 'ja')).toBe(false);
    expect(isListable({}, 'ja'), '판정 불가는 거부').toBe(false);
  });

  it('그 언어 자막이 있으면 올린다 — 게이트지 차단기가 아니다', () => {
    expect(isListable({ captionLangs: ['ja', 'en'] }, 'ja')).toBe(true);
    expect(isListable({ captionLangs: ['ja-JP'] }, 'ja'), '지역 변종도 같은 언어').toBe(true);
  });

  it('임베드 불가는 거부하되 **미확인은 통과**한다', () => {
    // media.js가 false와 undefined를 일부러 구분해 둔 이유를 여기서 쓴다 —
    // 미확인을 거부로 뭉치면 판정 못 한 영상이 전부 사라진다.
    expect(isListable({ captionLangs: ['ja'], embeddable: false }, 'ja')).toBe(false);
    expect(isListable({ captionLangs: ['ja'], embeddable: undefined }, 'ja')).toBe(true);
    expect(isListable({ captionLangs: ['ja'], embeddable: true }, 'ja')).toBe(true);
  });

  it('langCode가 없으면 자막 요건을 안 건다 — 요건은 언어별 설정에서 온다', () => {
    expect(isListable({ captionLangs: [] }, '')).toBe(true);
  });

  it('훑는 후보에 상한이 있다 — 영상당 왕복 1회라 상한이 곧 크론 벽시계다', () => {
    expect(probeBudget(2)).toBeGreaterThan(2);          // 필터가 떨구니 넉넉히
    expect(probeBudget(100)).toBe(MAX_PROBES);          // 그래도 상한 안
    expect(probeBudget(0)).toBeGreaterThan(0);          // 이상한 입력에도 죽지 않음
  });
});

describe('F R4 — 라벨과 판별', () => {
  it('소스가 스스로 라벨을 말하면 그걸 쓴다', () => {
    expect(suggestionSourceLabel({ source: ONDEMAND_SOURCE, videoId: 'abc' })).toBe(ONDEMAND_SOURCE);
  });

  it('기존 글 소스의 접두사 판정은 그대로다 — 회귀 방지', () => {
    expect(suggestionSourceLabel({ videoId: 'qiita_1' })).toBe('qiita');
    expect(suggestionSourceLabel({ videoId: 'devto_1' })).toBe('devto');
    expect(suggestionSourceLabel({ videoId: 'nhk_1' })).toBe('nhk');
    expect(suggestionSourceLabel({ videoId: 'wikinews_fr_x' })).toBe('wikinews');
    expect(suggestionSourceLabel({ videoId: '무엇이든' })).toBe('wikipedia');
  });

  it('on-demand 판별은 source로 한다 — transcript 유무로 보면 안 된다', () => {
    // 글 소스도 자막 취득 실패로 transcript가 NULL일 수 있다. 그걸 개인 반입으로
    // 착각하면 본문 없는 카드를 유튜브 주소로 열려다 실패한다.
    expect(isOnDemandSuggestion({ source: ONDEMAND_SOURCE })).toBe(true);
    expect(isOnDemandSuggestion({ source: 'nhk', transcript: null })).toBe(false);
    expect(isOnDemandSuggestion(null)).toBe(false);
  });
});

describe('F R4 — 편성', () => {
  it('기본 소스에 영상 채널이 있다 — 배포만으로 열린다(오너 DB 작업 0)', () => {
    const yt = DEFAULT_SOURCES.filter((s) => s.source_type === 'youtube_channel');
    expect(yt.length).toBeGreaterThanOrEqual(3);
    for (const s of yt) {
      expect(s.config.handle, '핸들 없이는 채널을 못 찾는다').toMatch(/^@/);
      expect(s.config.langCode, 'langCode가 없으면 자막 필터가 통째로 풀린다').toBeTruthy();
    }
  });

  it('중국어 영상은 없다 — 하드리밋 ⑷는 이 라운드에서도 그대로다', () => {
    expect(DEFAULT_SOURCES.filter((s) => s.language === 'Chinese')).toEqual([]);
  });
});

describe('F R4 — 배선', () => {
  it('크론이 접두사 체인을 되살리지 않는다', () => {
    const cron = read('src/app/api/cron/fetch-suggestions/route.js');
    expect(cron).toContain('suggestionSourceLabel');
    expect(cron, '체인 부활 = 영상 라벨이 wikipedia로 찍힌다').not.toMatch(/videoId\?\.startsWith\('qiita_'\)/);
  });

  it('크론이 본문 없는 기사를 NULL로 담는다 — undefined는 컬럼을 건너뛴다', () => {
    expect(read('src/app/api/cron/fetch-suggestions/route.js')).toContain('a.transcript ?? null');
  });

  it('읽기 라우트가 on-demand 행을 거르지 않는다 — 이 한 줄이 없으면 카드가 0건이다', () => {
    // 실측으로 찾은 유일한 차단 지점. 단독 `.not(transcript, is, null)`이 되살아나면
    // 크론이 아무리 담아도 화면에 아무것도 안 뜬다.
    const route = read('src/app/api/suggestions/today/route.js');
    expect(route).toContain('ONDEMAND_SOURCE');
    expect(route).toMatch(/\.or\(/);
    expect(route).not.toMatch(/^\s*\.not\('transcript', 'is', null\)/m);
  });

  it('디스패처가 youtube_channel을 받고, 무거운 모듈은 동적 import다', () => {
    const cs = read('src/lib/content-sources.js');
    expect(cs).toContain("case 'youtube_channel'");
    expect(cs, 'youtubei.js를 정적으로 물면 이 분기를 안 타는 곳까지 무거워진다')
      .toContain("await import('./server/youtubeChannel.js')");
  });
});

describe('F R4 — 화면이 저작권 모델과 어긋나지 않는다', () => {
  const materials = () => read('src/views/MaterialsPage.jsx');

  it('영상 카드가 transcript 하나로 죽지 않는다', () => {
    // `disabled={!hasTranscript}`가 남아 있으면 영상 카드가 전부 「자막 없음」이 된다.
    const card = sliceBetween(materials(), 'function SuggestionCard', 'function filterSuggestionsByProfile');
    expect(card).toContain('isOnDemandSuggestion');
    expect(card).toContain('disabled={!canStudy}');
  });

  it('버튼이 실제로 일어나는 일을 말한다 — 「공부하기」가 아니라 「내 자료로 가져오기」', () => {
    const card = sliceBetween(materials(), 'function SuggestionCard', 'function filterSuggestionsByProfile');
    expect(card).toContain('내 자료로 가져오기');
    expect(card, '고지가 없으면 화면과 저작권 모델이 어긋난다').toContain('가져오면 비공개 내 자료가 돼요');
  });

  it('언어명 하드코딩이 되살아나지 않는다 — 프랑스어 카드가 「일본어」로 떴던 자리', () => {
    for (const f of ['src/views/MaterialsPage.jsx', 'src/views/HomePage.jsx']) {
      expect(read(f), f).not.toContain("=== 'English' ? '영어' : '일본어'");
      expect(read(f), `${f}: 언어명 정본을 써야 한다`).toContain('langNameKo');
    }
  });

  it('추천에서 온 영상은 공개로 채워지지 않는다', () => {
    // 글 소스는 크론이 담은 공용 본문이라 public이 맞다. 영상은 **남의 자막**이라
    // 그 경로로 새면 안 된다 — handleLinkReady가 private으로 고정한다.
    const page = read('src/views/MaterialAddPage.jsx');
    const effect = sliceBetween(page, "const suggestionId = searchParams.get('suggestion')", '}, []);');
    expect(effect).toContain('isOnDemandSuggestion');
    // on-demand 분기는 setVisibility 없이 return 한다(그 뒤에만 public이 온다).
    const ondemand = sliceBetween(effect, 'if (isOnDemandSuggestion(s))', 'setRawText');
    expect(ondemand).not.toContain('public');
    expect(sliceBetween(page, 'const handleLinkReady', 'const handleEpubReady')).toContain("setVisibility('private')");
  });

  it('링크 입구가 인자로 받은 주소를 쓴다 — setUrl 직후 state를 읽으면 빈 값이다', () => {
    const sec = read('src/components/MaterialAddLinkSection.jsx');
    expect(sec).toContain('async function handleFetch(target)');
    expect(sec).toContain('String(target ?? url).trim()');
    // 그냥 넘기면 React 이벤트 객체가 target 자리에 들어와 조용히 안 가져온다.
    // 범위를 JSX로 좁힌다 — 파일 전체로 보면 위 배선을 설명하는 **주석 자체**가 걸린다
    // (처음에 그렇게 써서 계약이 내 주석을 잡았다).
    const jsx = sliceBetween(sec, '  return (', null);   // 렌더부터 끝까지
    expect(jsx, '이벤트 객체가 target으로 새는 배선').not.toContain('onClick={handleFetch}');
    expect(jsx).toContain('onClick={() => handleFetch()}');
    expect(sec).toContain('initialUrl');
  });

  it('고지 문구 스타일은 토큰만 — 규약 §1', () => {
    const block = sliceBetween(read('src/index.css'), '.suggestion-card__note {', '}');
    expect(block).toContain('var(--');
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}|rgba?\(/);
  });
});
