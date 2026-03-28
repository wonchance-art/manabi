import { createClient } from '@supabase/supabase-js';
import { fetchNHKEasyArticles } from '../../../../lib/youtube.js';
import { fetchEnglishArticles, fetchJapaneseArticles } from '../../../../lib/content-sources.js';

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const today = new Date().toISOString().split('T')[0];
  const saved = { Japanese: 0, English: 0, errors: [] };

  // DB에서 활성화된 소스 목록 조회
  const { data: sources = [] } = await supabase
    .from('content_sources')
    .select('*')
    .eq('is_active', true)
    .order('language')
    .order('created_at');

  // 소스가 없으면 기본값 사용
  const activeSources = sources.length > 0 ? sources : [
    { language: 'Japanese', source_type: 'nhk_easy',         config: { level: 'N3 중급' } },
    { language: 'Japanese', source_type: 'wikipedia_random', config: { lang: 'ja', level: 'N3 중급' } },
    { language: 'English',  source_type: 'wikipedia_random', config: { lang: 'simple', level: 'B1 중급' } },
  ];

  // 언어별로 그룹핑
  const byLang = { Japanese: [], English: [] };
  for (const s of activeSources) {
    if (byLang[s.language]) byLang[s.language].push(s);
  }

  // 각 언어별 콘텐츠 수집
  for (const [language, langSources] of Object.entries(byLang)) {
    const articles = [];

    for (const src of langSources) {
      if (articles.length >= 3) break;
      const needed = 3 - articles.length;

      let fetched = [];
      if (src.source_type === 'nhk_easy') {
        fetched = (await fetchNHKEasyArticles(needed)) || [];
      } else if (src.source_type === 'wikipedia_random') {
        const lang = src.config?.lang || (language === 'Japanese' ? 'ja' : 'simple');
        fetched = lang === 'ja'
          ? await fetchJapaneseArticles(needed)
          : await fetchEnglishArticles(needed);
      }

      articles.push(...fetched.slice(0, needed));
    }

    // Supabase에 저장
    for (const a of articles) {
      const { error } = await supabase.from('daily_suggestions').upsert({
        date: today,
        language,
        source: a.videoId?.startsWith('wiki_') ? 'wikipedia' : 'nhk_easy',
        video_id: a.videoId,
        title: a.title,
        channel_name: a.channelName,
        thumbnail_url: a.thumbnail,
        transcript: a.transcript,
        level: a.level,
      }, { onConflict: 'date,video_id' });

      if (error) saved.errors.push(`${language}: ${error.message}`);
      else saved[language]++;
    }
  }

  return Response.json({
    date: today,
    japanese: saved.Japanese,
    english: saved.English,
    errors: saved.errors,
  });
}
