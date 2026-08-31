/**
 * 콘텐츠 소스 — API 키 불필요, 최신 트렌드 기사 중심
 *
 * Japanese:
 *   - qiita      → Qiita 일본어 기술 트렌드 기사 (N2-N1)
 *   - nhk_rss    → NHK 뉴스 헤드라인 다이제스트 (N3-N4)
 *
 * English:
 *   - devto      → Dev.to 영어 기술 트렌드 기사 (B1-B2)
 *   - wikinews   → English Wikinews 최신 기사 (B2, fallback)
 *
 * French:
 *   - wikinews_fr → Wikinews français 최신 기사 (B1)
 *
 * Chinese:
 *   - wikinews_zh → 维基新闻 — **기본 비활성**. 하드리밋 「중화권 정치 서술 완전 배제」 때문에
 *                   개통은 오너 결정이다. 켤 때를 대비해 주제 게이트(`newsTopicGate.js`)를
 *                   달아 뒀다 — 안전 분류가 확인된 기사만 통과하고 미분류는 거부한다.
 */

import { GATES, passesTopicGate } from './newsTopicGate.js';

const UA = 'AnatomyStudio/1.0 (language-learning)';

async function jsonFetch(url, headers = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, ...headers },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function textFetch(url, headers = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, ...headers },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

// 마크다운 코드 블록 / 인라인 코드 제거 + 정리
function stripMarkdownCode(md) {
  return md
    .replace(/```[\s\S]*?```/g, '')   // 코드 블록
    .replace(/`[^`]+`/g, '')          // 인라인 코드
    .replace(/!\[.*?\]\(.*?\)/g, '')  // 이미지
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 링크 → 텍스트
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── 1. Qiita — 일본어 기술 트렌드 ──────────────────────────────
export async function fetchQiita(count = 3) {
  // stocks(좋아요) 10개 이상 인기글 최신순
  const items = await jsonFetch(
    `https://qiita.com/api/v2/items?per_page=${count * 4}&query=stocks%3A%3E10`,
    { Authorization: process.env.QIITA_TOKEN ? `Bearer ${process.env.QIITA_TOKEN}` : undefined },
  );
  if (!items?.length) return [];

  const results = [];
  for (const item of items) {
    if (results.length >= count) break;

    const raw = item.body || '';
    const text = stripMarkdownCode(raw);
    if (text.length < 300) continue;

    results.push({
      videoId: `qiita_${item.id}`,
      title: item.title,
      channelName: `Qiita · @${item.user?.id || '?'}`,
      thumbnail: null,
      transcript: text.slice(0, 3000),
      level: 'N2 상급',
    });
  }
  return results;
}

// ── 2. NHK RSS — 일본어 뉴스 헤드라인 다이제스트 ────────────────
export async function fetchNHKHeadlines(count = 1) {
  const xml = await textFetch('https://www3.nhk.or.jp/rss/news/cat0.xml');
  if (!xml) return [];

  // RSS XML에서 <item> 블록 추출
  const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  if (!itemMatches.length) return [];

  const items = itemMatches.slice(0, 10).map(m => {
    const block = m[1];
    const title = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() || '';
    const desc  = (block.match(/<description>([\s\S]*?)<\/description>/) || [])[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() || '';
    return { title, desc };
  }).filter(i => i.title && i.desc);

  if (!items.length) return [];

  // 헤드라인 5개를 하나의 뉴스 다이제스트로 묶기
  const selected = items.slice(0, 6);
  const transcript = `今日のニュース（NHK）\n\n` +
    selected.map((item, i) => `【${i + 1}】${item.title}\n${item.desc}`).join('\n\n');

  return [{
    videoId: `nhk_digest_${new Date().toISOString().split('T')[0]}`,
    title: `今日のNHKニュース — ${new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}`,
    channelName: 'NHK ニュース',
    thumbnail: 'https://www3.nhk.or.jp/common/img/common/sns_icon_nhk.png',
    transcript,
    level: 'N3 중급',
  }];
}

// ── 3. Dev.to — 영어 기술 트렌드 ───────────────────────────────
export async function fetchDevto(count = 3) {
  // 주간 인기글
  const list = await jsonFetch('https://dev.to/api/articles?per_page=20&top=7');
  if (!list?.length) return [];

  // 실제 본문은 개별 요청으로 가져와야 함
  const results = [];
  for (const item of list) {
    if (results.length >= count) break;

    const article = await jsonFetch(`https://dev.to/api/articles/${item.id}`);
    if (!article) continue;

    const text = stripMarkdownCode(article.body_markdown || '');
    if (text.length < 300) continue;

    results.push({
      videoId: `devto_${item.id}`,
      title: item.title,
      channelName: `DEV Community · @${item.user?.username || '?'}`,
      thumbnail: item.cover_image || item.social_image || null,
      transcript: text.slice(0, 3000),
      level: 'B1 중급',
    });
  }
  return results;
}

// ── 4. Wikinews — 영어 뉴스 (fallback) ─────────────────────────
async function wikiFetch(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return null;
  return res.json();
}

// 본문과 카테고리를 **한 번에** 가져온다 — 주제 게이트가 카테고리로 판정하는데, 이걸 따로
// 부르면 기사당 왕복이 하나 더 는다(게이트는 대부분을 거부하므로 그 비용이 그대로 곱해진다).
async function fetchWikinewsArticle(title, lang = 'en') {
  const params = new URLSearchParams({
    action: 'query', prop: 'extracts|categories', explaintext: 'true',
    exsectionformat: 'plain', cllimit: 'max', titles: title, format: 'json', origin: '*',
  });
  const data = await wikiFetch(`https://${lang}.wikinews.org/w/api.php?${params}`);
  const page = Object.values(data?.query?.pages || {})[0];
  const text = page?.extract?.trim() || '';
  if (text.length < 200) return null;
  return { text: text.slice(0, 3000), categories: (page?.categories || []).map((c) => c?.title) };
}

// Wikinews는 언어판마다 같은 MediaWiki API를 쓴다 — 서브도메인만 갈아끼우면 된다.
// 그래서 fr/zh 공급은 새 파서가 아니라 **이 함수의 매개변수화**로 열린다(신규 파싱 0).
const WIKINEWS_EDITIONS = {
  en: { channel: 'English Wikinews',  level: 'B2 상급' },
  fr: { channel: 'Wikinews français', level: 'B1 중급' },
  // zh만 주제 게이트를 단다 — 하드리밋은 중화권 정치에만 걸리고, en/fr에 같은 게이트를
  // 씌우면 이미 열린 공급이 조용히 말라붙는다(F R2에서 연 프랑스어가 첫 피해자가 된다).
  zh: { channel: '维基新闻',            level: 'H4 상급', gate: 'zhNonPolitical' },
};

export async function fetchWikinews(count = 3, lang = 'en') {
  const edition = WIKINEWS_EDITIONS[lang] || WIKINEWS_EDITIONS.en;
  const gate = edition.gate ? GATES[edition.gate] : null;
  const params = new URLSearchParams({
    action: 'query', list: 'recentchanges', rcnamespace: '0',
    // 게이트가 붙은 언어판은 후보를 더 넓게 긷는다 — allowlist라 대부분이 걸러지므로
    // 평소 폭(count*4)으로는 수확이 0에 수렴한다. 상한은 두어 크론 벽시계를 지킨다.
    rclimit: String(count * (gate ? 12 : 4)), rctype: 'new', format: 'json', origin: '*',
  });
  const data = await wikiFetch(`https://${lang}.wikinews.org/w/api.php?${params}`);
  const articles = data?.query?.recentchanges || [];
  const results = [];
  for (const article of articles) {
    if (results.length >= count) break;
    const got = await fetchWikinewsArticle(article.title, lang);
    if (!got) continue;
    // 하드리밋 집행 — 통과 못 하면 **조용히 버린다**(오류로 세우면 크론 전체가 멎는다).
    if (!passesTopicGate(got.categories, gate)) continue;
    const text = got.text;
    results.push({
      // 언어판을 id에 넣는다 — 같은 제목이 두 언어판에 있으면 upsert 키(date,video_id)가 충돌한다.
      videoId: `wikinews_${lang}_${encodeURIComponent(article.title)}`,
      title: article.title,
      channelName: edition.channel,
      thumbnail: null,
      transcript: text,
      level: edition.level,
    });
  }
  return results;
}

// ── source_type 디스패처 ────────────────────────────────────────
export async function fetchFromSource(source, count = 3) {
  const { source_type, config = {} } = source;

  switch (source_type) {
    case 'qiita': {
      const results = await fetchQiita(count);
      // Qiita rate-limit 시 NHK로 fallback
      if (results.length === 0) return fetchNHKHeadlines(count);
      return results;
    }
    case 'nhk_rss':     return fetchNHKHeadlines(count);
    case 'devto':       return fetchDevto(count);
    case 'wikinews':    return fetchWikinews(count, 'en');
    case 'wikinews_fr': return fetchWikinews(count, 'fr');
    // zh는 기본 소스에 넣지 않는다 — 하드리밋 「중화권 정치 서술 완전 배제」.
    // 뉴스 피드는 정치 기사를 자동으로 추천 카드에 올리게 되므로, 개통은 오너 결정이다.
    // 그 결정이 나면 DB 행 하나로 끝나도록, 선행 조건이던 **주제 게이트를 먼저 달았다**
    // (F R3). 게이트는 `WIKINEWS_EDITIONS.zh.gate`가 건다 — 여기 분기에는 없다.
    case 'wikinews_zh': return fetchWikinews(count, 'zh');

    // 구버전 호환
    case 'wikipedia_good':
    case 'wikipedia_random':
      return config.lang === 'ja' ? fetchFromSource({ source_type: 'qiita' }, count) : fetchDevto(count);

    default:
      return [];
  }
}

// 구버전 호환 export
export const fetchEnglishArticles  = fetchDevto;
export const fetchJapaneseArticles = fetchQiita;
