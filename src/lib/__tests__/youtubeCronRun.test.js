import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { groupByLanguage, isVideoSource, planCronRun } from '../suggestionSources';
import { fetchYoutubeChannel } from '../server/youtubeChannel';

/**
 * 계약: 유튜브 추천 수집 복구 (2026-10-16, 오너 「권장하는대로 ㄱㄱ」).
 *
 * 운영 실측 두 가지가 이 파일의 근거다.
 *   ① 채널 카드의 channel_name에 「12K views」가 저장됐다 — 채널 탭 카드의 첫 메타 줄은
 *      조회수다. 채널 수집에서는 채널 자신의 제목이 정본이다.
 *   ② 9-15 이후 프랑스어 카드가 영상 2건뿐이었다 — 언어 하나를 다 모은 뒤 저장하던 크론에서
 *      뒤쪽 영상 수집이 시간을 넘기면 그 언어의 글 기사까지 함께 사라진다.
 */

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

/** 공식 Data API(YT-API-001) 가짜 응답 — 영상 카드의 채널명(snippet.channelTitle)과 채널 자신의 제목이 다를 수 있다. */
function fakeApi({ title = 'innerFrench' } = {}) {
  return async (url) => {
    const endpoint = new URL(url).pathname.split('/').pop();
    const body = {
      channels: { items: [{ snippet: { title }, contentDetails: { relatedPlaylists: { uploads: 'UU123' } } }] },
      playlistItems: { items: [{ contentDetails: { videoId: 'vid00000001' } }, { contentDetails: { videoId: 'vid00000002' } }] },
      videos: { items: ['vid00000001', 'vid00000002'].map((id) => ({
        id, snippet: { title: id, channelTitle: '12K views', defaultAudioLanguage: 'fr' }, contentDetails: { caption: 'true' }, status: { embeddable: true },
      })) },
    }[endpoint];
    return { ok: true, status: 200, json: async () => body };
  };
}

describe('① 채널명 — 조회수가 채널명 자리에 들어가지 않는다', () => {
  it('채널 수집 카드의 channelName은 채널 자신의 제목이다(영상 쪽 값이 아니라)', async () => {
    const out = await fetchYoutubeChannel(2, { handle: '@innerFrench', langCode: 'fr' }, {
      apiKey: 'test-key', fetch: fakeApi(), log: () => {},
    });
    expect(out.length).toBeGreaterThan(0);
    for (const a of out) expect(a.channelName).toBe('innerFrench');
  });

  it('채널 제목을 못 얻으면 영상 쪽 채널명으로 물러선다(빈 값으로 덮지 않는다)', async () => {
    const out = await fetchYoutubeChannel(1, { handle: '@x', langCode: 'fr' }, { apiKey: 'test-key', fetch: fakeApi({ title: '' }), log: () => {} });
    expect(out[0].channelName).toBe('12K views');
  });
});

describe('② 크론 순서 — 글 소스 전부가 영상보다 먼저 돈다', () => {
  const rows = [
    { language: 'English', source_type: 'wikinews' },
    { language: 'English', source_type: 'youtube_channel' },
    { language: 'French', source_type: 'wikinews_fr' },
    { language: 'French', source_type: 'youtube_cc' },
    { language: 'Japanese', source_type: 'nhk_rss' },
  ];

  it('영상 소스는 모든 언어의 글 소스 뒤에 온다', () => {
    const plan = planCronRun(groupByLanguage(rows));
    const kinds = plan.map((p) => isVideoSource(p.src));
    const firstVideo = kinds.indexOf(true);
    expect(firstVideo).toBe(3);
    expect(kinds.slice(firstVideo).every(Boolean)).toBe(true);
    expect(plan.map((p) => p.language).slice(0, 3)).toEqual(['English', 'French', 'Japanese']);
  });

  it('소스는 빠짐없이 한 번씩 돈다', () => {
    expect(planCronRun(groupByLanguage(rows))).toHaveLength(rows.length);
    expect(planCronRun(undefined)).toEqual([]);
  });

  it('크론이 계획 순서를 쓰고, 소스마다 저장하며, 영상은 시간 안에서만 시작한다', () => {
    const cron = read('src/app/api/cron/fetch-suggestions/route.js');
    expect(cron).toContain('planCronRun(byLang)');
    expect(cron).toMatch(/export const maxDuration = \d+;/);
    expect(cron).toMatch(/isVideoSource\(src\) && Date\.now\(\) - startedAt > VIDEO_START_DEADLINE_MS/);
    // 언어별로 모아 두었다가 저장하는 옛 모양이 되살아나면 ②가 재발한다.
    expect(cron, '언어별 일괄 저장 부활').not.toContain('articles.push(...fetched)');
  });
});
