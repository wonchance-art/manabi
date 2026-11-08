import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { fetchYoutubeChannel } from '../server/youtubeChannel';
import { fetchYoutubeCc, isCreativeCommonsLicense } from '../server/youtubeShareable';
import { MAX_CAPTION_PROBES, YT_API_BASE, listableProbe, normalizeVideo, youtubeApiKey } from '../server/youtubeDataApi';

/**
 * 계약(YT-API-001 · 2026-11-08 KST, 오너 b안): 영상 수집은 공식 YouTube Data API v3로만 한다.
 *  ① 키(YOUTUBE_DATA_API_KEY)가 없으면 네트워크 0 · 0건 · 로그 한 줄(fail-closed, 오류 아님)
 *  ② 카드는 전부 목록만(transcript 키 없음 · source youtube_ondemand) — 본문은 클릭 때 /api/import/link
 *  ③ 그 언어 자막 · 임베드 판정(정본 isListable) · CC는 status.license로 재확인 · captions.list(50단위)는 소스당 상한
 *  ④ 비공식 클라이언트(youtubei.js)를 수집 경로에서 부르지 않는다 · 키를 로그/오류에 싣지 않는다
 * 응답 모양은 공식 문서 예시 구조(channels · playlistItems · search · videos · captions).
 */

const KEY = 'test-key-not-real';
function fakeApi(handlers) {
  const calls = [];
  const fetchFn = async (url) => {
    const u = new URL(url);
    const endpoint = u.pathname.split('/').pop();
    calls.push({ endpoint, params: Object.fromEntries(u.searchParams) });
    const body = handlers[endpoint]?.(Object.fromEntries(u.searchParams));
    if (body === undefined) return { ok: false, status: 404, json: async () => ({}) };
    if (body?.__status) return { ok: false, status: body.__status, json: async () => body.json || {} };
    return { ok: true, status: 200, json: async () => body };
  };
  return { fetchFn, calls };
}
const video = (id, { title = `T ${id}`, channelTitle = 'Uploader', caption = 'true', embeddable = true, license = 'youtube', lang = 'en' } = {}) => ({
  id,
  snippet: { title, channelTitle, defaultAudioLanguage: lang, thumbnails: { medium: { url: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` } } },
  contentDetails: { caption },
  status: { embeddable, license },
});

describe('YT-API-001 ① 키가 없으면 fail-closed', () => {
  it('키 없음 → 네트워크 0 · 0건 · 로그 한 줄(채널 · CC 둘 다)', async () => {
    const { fetchFn, calls } = fakeApi({});
    const logs = [];
    const log = (...a) => logs.push(a.join(' '));
    expect(await fetchYoutubeChannel(2, { handle: '@VOALearningEnglish', langCode: 'en' }, { apiKey: null, fetch: fetchFn, log })).toEqual([]);
    expect(await fetchYoutubeCc(2, { query: 'english lesson', langCode: 'en' }, { apiKey: null, fetch: fetchFn, log })).toEqual([]);
    expect(calls).toHaveLength(0);
    expect(logs).toHaveLength(2);
    for (const l of logs) expect(l).toMatch(/YOUTUBE_DATA_API_KEY 없음/);
  });

  it('환경 변수 이름은 YOUTUBE_DATA_API_KEY 하나 · 빈 값은 없음과 같다', () => {
    expect(youtubeApiKey({ YOUTUBE_DATA_API_KEY: ' abc ' })).toBe('abc');
    expect(youtubeApiKey({ YOUTUBE_DATA_API_KEY: '' })).toBeNull();
    expect(youtubeApiKey({})).toBeNull();
  });
});

describe('YT-API-001 ② 채널 수집 — 목록만', () => {
  const api = () => fakeApi({
    channels: (p) => (p.forHandle === '@innerFrench'
      ? { items: [{ snippet: { title: 'innerFrench' }, contentDetails: { relatedPlaylists: { uploads: 'UU123' } } }] } : { items: [] }),
    playlistItems: () => ({ items: ['vid00000001', 'vid00000002', 'vid00000003'].map((videoId) => ({ contentDetails: { videoId } })) }),
    videos: () => ({ items: [video('vid00000001', { lang: 'fr' }), video('vid00000002', { lang: 'fr', caption: 'false' }), video('vid00000003', { lang: 'fr', embeddable: false })] }),
  });

  it('그 언어 자막 · 임베드 가능만 카드로, channelName은 채널 자신의 제목, transcript 키 없음', async () => {
    const { fetchFn, calls } = api();
    const out = await fetchYoutubeChannel(2, { handle: '@innerFrench', langCode: 'fr', level: 'B1 중급' }, { apiKey: KEY, fetch: fetchFn, log: () => {} });
    expect(out.map((a) => a.videoId)).toEqual(['vid00000001']);   // 자막 없음 · 임베드 불가는 뺀다
    expect(out[0]).toMatchObject({ channelName: 'innerFrench', source: 'youtube_ondemand', level: 'B1 중급' });
    expect('transcript' in out[0]).toBe(false);
    expect(calls.map((c) => c.endpoint)).toEqual(['channels', 'playlistItems', 'videos']);   // 3단위
    for (const c of calls) expect(c.params.key).toBe(KEY);
  });

  it('퍼블릭 도메인 설정(VOA)이어도 본문을 담지 않는다 — 공식 API는 남의 자막 본문을 못 받는다', async () => {
    const { fetchFn } = api();
    const out = await fetchYoutubeChannel(2, { handle: '@innerFrench', langCode: 'fr', license: 'public-domain' }, { apiKey: KEY, fetch: fetchFn, log: () => {} });
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe('youtube_ondemand');
    expect('transcript' in out[0]).toBe(false);
  });

  it('핸들을 못 찾거나 API가 실패하면 0건 · 오류 문구에 키가 없다', async () => {
    const logs = [];
    const { fetchFn } = api();
    expect(await fetchYoutubeChannel(2, { handle: '@nobody', langCode: 'fr' }, { apiKey: KEY, fetch: fetchFn, log: (m) => logs.push(m) })).toEqual([]);
    const quota = fakeApi({ channels: () => ({ __status: 403, json: { error: { errors: [{ reason: 'quotaExceeded' }] } } }) });
    expect(await fetchYoutubeChannel(2, { handle: '@innerFrench', langCode: 'fr' }, { apiKey: KEY, fetch: quota.fetchFn, log: (m) => logs.push(m) })).toEqual([]);
    expect(logs.join('\n')).toMatch(/youtube_api_channels_403_quotaExceeded/);
    expect(logs.join('\n')).not.toContain(KEY);
  });
});

describe('YT-API-001 ③ 판정 — CC 재확인 · 자막 언어', () => {
  it('CC 검색: 검색 필터를 걸고, status.license가 creativeCommon인 것만 통과', async () => {
    const { fetchFn, calls } = fakeApi({
      search: () => ({ items: ['cc1', 'std1', 'cc2'].map((videoId) => ({ id: { videoId } })) }),
      videos: () => ({ items: [video('cc1', { license: 'creativeCommon' }), video('std1', { license: 'youtube' }), video('cc2', { license: 'creativeCommon' })] }),
    });
    const out = await fetchYoutubeCc(2, { query: 'english lesson', langCode: 'en', level: 'B1 중급' }, { apiKey: KEY, fetch: fetchFn, log: () => {} });
    expect(out.map((a) => a.videoId)).toEqual(['cc1', 'cc2']);
    for (const a of out) { expect(a.source).toBe('youtube_ondemand'); expect('transcript' in a).toBe(false); }
    const search = calls.find((c) => c.endpoint === 'search').params;
    expect(search).toMatchObject({ videoLicense: 'creativeCommon', videoCaption: 'closedCaption', videoEmbeddable: 'true', relevanceLanguage: 'en', type: 'video' });
    expect(isCreativeCommonsLicense('creativeCommon')).toBe(true);
    expect(isCreativeCommonsLicense('youtube')).toBe(false);
    expect(isCreativeCommonsLicense(null)).toBe(false);
  });

  it('오디오 언어가 다르거나 없으면 captions.list로 트랙 언어를 확인하고, 그 확인은 소스당 상한이 있다', async () => {
    const { fetchFn, calls } = fakeApi({ captions: (p) => ({ items: p.videoId === 'ja-track' ? [{ snippet: { language: 'ja' } }] : [{ snippet: { language: 'en' } }] }) });
    const opts = { key: KEY, fetch: fetchFn };
    const budget = { left: 2 };
    expect(await listableProbe(normalizeVideo(video('ja-track', { lang: null })), 'ja', opts, budget)).toMatchObject({ captionLangs: ['ja'] });
    expect(await listableProbe(normalizeVideo(video('en-only', { lang: 'en' })), 'ja', opts, budget)).toMatchObject({ captionLangs: ['en'] });
    expect(await listableProbe(normalizeVideo(video('over-budget', { lang: null })), 'ja', opts, budget)).toMatchObject({ captionLangs: [] });
    expect(calls.filter((c) => c.endpoint === 'captions')).toHaveLength(2);
    expect(MAX_CAPTION_PROBES).toBeLessThanOrEqual(5);    // 50단위 × 상한 — 쿼터 메모(docs/design/youtube-data-api-20261108.md)
    // 오디오 언어가 같으면 captions.list를 부르지 않는다(0단위)
    expect(await listableProbe(normalizeVideo(video('same', { lang: 'ja-JP' })), 'ja', opts, { left: 0 })).toMatchObject({ captionLangs: ['ja'] });
    // 자막이 아예 없으면 거절
    expect(await listableProbe(normalizeVideo(video('none', { caption: 'false' })), 'ja', opts, { left: 5 })).toMatchObject({ captionLangs: [] });
  });
});

describe('YT-API-001 ④ 배선', () => {
  const src = (f) => fs.readFileSync(f, 'utf8');
  it('수집 경로가 비공식 클라이언트를 부르지 않는다', () => {
    for (const f of ['src/lib/server/youtubeChannel.js', 'src/lib/server/youtubeShareable.js', 'src/lib/server/youtubeDataApi.js']) {
      const code = src(f).split('\n').filter((l) => !/^\s*(\/\/|\/?\*)/.test(l)).join('\n');
      expect(code, f).not.toMatch(/youtubei\.js|Innertube|getBasicInfo/);
    }
    expect(YT_API_BASE).toBe('https://www.googleapis.com/youtube/v3');
  });
  it('키는 서버 전용 이름이고 브라우저 노출 이름(NEXT_PUBLIC_)이 아니다', () => {
    expect(src('src/lib/server/youtubeDataApi.js')).toMatch(/YOUTUBE_DATA_API_KEY/);
    expect(src('src/lib/server/youtubeDataApi.js')).not.toMatch(/NEXT_PUBLIC_YOUTUBE/);
  });
});
