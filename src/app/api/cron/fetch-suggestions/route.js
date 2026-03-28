import { createClient } from '@supabase/supabase-js';
import {
  LEARNING_CHANNELS,
  searchChannelVideos,
  extractTranscript,
  fetchNHKEasyArticles,
} from '../../../../lib/youtube.js';

// 언어별 기본 난이도
const DEFAULT_LEVEL = { Japanese: 'N3 중급', English: 'B1 중급' };

// Vercel Cron에서 호출 (vercel.json 스케줄: 매일 자정 KST = 15:00 UTC)
export async function GET(request) {
  // CRON_SECRET 검증
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const youtubeKey = process.env.YOUTUBE_API_KEY;
  if (!youtubeKey) {
    return Response.json({ error: 'YOUTUBE_API_KEY not configured' }, { status: 500 });
  }

  // Service Role Key로 RLS 우회 (INSERT 권한)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const today = new Date().toISOString().split('T')[0];
  const results = { Japanese: [], English: [], errors: [] };

  // ── 1. Japanese: NHK Web Easy 우선 시도 ──────────────────────
  const nhkArticles = await fetchNHKEasyArticles(3);
  if (nhkArticles) {
    for (const article of nhkArticles) {
      const { error } = await supabase.from('daily_suggestions').upsert({
        date: today,
        language: 'Japanese',
        source: 'nhk_easy',
        video_id: article.videoId,
        title: article.title,
        channel_name: 'NHK Web Easy',
        thumbnail_url: article.thumbnail,
        transcript: article.transcript,
        level: 'N3 중급',
      }, { onConflict: 'date,video_id' });

      if (error) results.errors.push(`NHK insert: ${error.message}`);
      else results.Japanese.push(article.title);
    }
  }

  // NHK 실패 시 YouTube로 폴백
  if (results.Japanese.length === 0) {
    for (const channel of LEARNING_CHANNELS.Japanese) {
      const videos = await searchChannelVideos(channel.id, youtubeKey, {
        maxResults: 3,
        langCode: 'ja',
      });

      for (const video of videos.slice(0, 3 - results.Japanese.length)) {
        const transcript = await extractTranscript(video.videoId, 'ja');

        const { error } = await supabase.from('daily_suggestions').upsert({
          date: today,
          language: 'Japanese',
          source: 'youtube',
          video_id: video.videoId,
          title: video.title,
          channel_name: channel.name,
          thumbnail_url: video.thumbnail,
          transcript,
          level: channel.level,
        }, { onConflict: 'date,video_id' });

        if (error) results.errors.push(`JP YouTube insert: ${error.message}`);
        else results.Japanese.push(video.title);

        if (results.Japanese.length >= 3) break;
      }
      if (results.Japanese.length >= 3) break;
    }
  }

  // ── 2. English: YouTube ──────────────────────────────────────
  for (const channel of LEARNING_CHANNELS.English) {
    const videos = await searchChannelVideos(channel.id, youtubeKey, {
      maxResults: 3,
      langCode: 'en',
    });

    for (const video of videos.slice(0, 3 - results.English.length)) {
      const transcript = await extractTranscript(video.videoId, 'en');

      const { error } = await supabase.from('daily_suggestions').upsert({
        date: today,
        language: 'English',
        source: 'youtube',
        video_id: video.videoId,
        title: video.title,
        channel_name: channel.name,
        thumbnail_url: video.thumbnail,
        transcript,
        level: channel.level,
      }, { onConflict: 'date,video_id' });

      if (error) results.errors.push(`EN YouTube insert: ${error.message}`);
      else results.English.push(video.title);

      if (results.English.length >= 3) break;
    }
    if (results.English.length >= 3) break;
  }

  return Response.json({
    date: today,
    japanese: results.Japanese.length,
    english: results.English.length,
    errors: results.errors,
  });
}
