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
 *
 * ── U R4 소스 확장(#1077 조사표 5509440618 → 오너 「좋은 안 있으면 그걸로 적용」, 2026-09-05)
 *
 * 기술·뉴스 6종 밖(사회·건강·과학·행정) 영역을 연다. 원칙 하나 — **주제 태그는 소스 자신의
 * 분류에서만** 얻는다(키워드 추측 금지, `newsTopicGate`의 fail-closed 선례). 태그는 스키마
 * 없이 `source` 라벨 접미로 싣는다(`nhk_society` · `wikinews_en_health` · `voa_health`).
 *   - nhk_rss   + config.feed     → NHK 카테고리 피드(URL이 곧 NHK의 분류). 정치·국제는 안 연다
 *   - wikinews* + config.category → MediaWiki `categorymembers`(카테고리가 곧 분류). zh 게이트 불변
 *   - rss_text                    → 본문을 담는 RSS 공용 문(VOA·service-public). 라이선스·출처
 *                                   표기는 코드의 계열 레지스트리(RSS_FAMILIES)가 든다 — 피드 URL은
 *                                   `content_sources` 행이 준다(이 세션은 egress가 막혀 URL 실측 불가)
 * 태그를 못 얻는 항목은 수집 단계에서 거부한다. 기존 6종의 결과는 바뀌지 않는다(설정 없으면 옛 경로).
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

/**
 * NHK RSS 카테고리 피드(U R4) — `https://www3.nhk.or.jp/rss/news/<feed>.xml`. **URL이 곧 NHK의
 * 분류**라 주제 태그를 소스 자신에게서 얻는다. 정치(cat4)·국제(cat6)는 넣지 않는다 — 어학연수의
 * 일상 영역이 아니고, 뉴스 정치는 추천 카드에 자동으로 오르면 안 되는 종류다(zh 게이트와 같은 결).
 * cat0(主要)은 현행 다이제스트 그대로 — 주제 없음, 라벨 'nhk' 불변.
 */
export const NHK_FEEDS = Object.freeze({
  cat0: Object.freeze({ ja: '主要', topic: null }),
  cat1: Object.freeze({ ja: '社会', topic: 'society' }),
  cat2: Object.freeze({ ja: '文化・エンタメ', topic: 'culture' }),
  cat3: Object.freeze({ ja: '科学・医療', topic: 'science' }),
  cat5: Object.freeze({ ja: '経済', topic: 'economy' }),
  cat7: Object.freeze({ ja: 'スポーツ', topic: 'sports' }),
});

/** 채널 `<title>`에 NHK 분류명이 실려 있으면 그것이 최우선 — 소스가 스스로 말한 분류다. */
function nhkTopicFromChannelTitle(channelTitle) {
  for (const meta of Object.values(NHK_FEEDS)) {
    if (meta.topic && channelTitle.includes(meta.ja)) return meta;
  }
  return null;
}

const stripCdata = (s) => String(s || '').replace(/<!\[CDATA\[|\]\]>/g, '').trim();

/**
 * @param {number} count
 * @param {{feed?: string, level?: string}} config — `feed`가 없으면 cat0(현행). 모르는 피드는 **거부**(빈 배열).
 */
export async function fetchNHKHeadlines(count = 1, config = {}) {
  const feed = String(config?.feed || 'cat0');
  const registered = NHK_FEEDS[feed];
  if (!registered) return [];   // fail-closed — 등록 안 된 피드(정치 등)는 긷지 않는다

  const xml = await textFetch(`https://www3.nhk.or.jp/rss/news/${feed}.xml`);
  if (!xml) return [];

  // 주제: 채널 제목의 분류명 > 피드 등록표. 둘 다 없으면(주제 피드인데 못 정하면) 거부.
  const head = xml.slice(0, xml.indexOf('<item>') === -1 ? xml.length : xml.indexOf('<item>'));
  const channelTitle = stripCdata((head.match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
  const meta = nhkTopicFromChannelTitle(channelTitle) || registered;
  if (feed !== 'cat0' && !meta.topic) return [];

  // RSS XML에서 <item> 블록 추출
  const itemMatches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  if (!itemMatches.length) return [];

  const items = itemMatches.slice(0, 10).map(m => {
    const block = m[1];
    const title = stripCdata((block.match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
    const desc  = stripCdata((block.match(/<description>([\s\S]*?)<\/description>/) || [])[1]);
    return { title, desc };
  }).filter(i => i.title && i.desc);

  if (!items.length) return [];

  // 헤드라인 5개를 하나의 뉴스 다이제스트로 묶기
  const selected = items.slice(0, 6);
  const heading = meta.topic ? `今日のニュース（NHK・${meta.ja}）` : '今日のニュース（NHK）';
  const transcript = `${heading}\n\n` +
    selected.map((item, i) => `【${i + 1}】${item.title}\n${item.desc}`).join('\n\n');
  const date = new Date().toISOString().split('T')[0];
  const dateLabel = new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' });

  return [{
    // 주제 피드는 id에 피드를 넣는다 — upsert 키(date, video_id)가 cat0 다이제스트와 충돌하지 않게.
    videoId: meta.topic ? `nhk_${feed}_digest_${date}` : `nhk_digest_${date}`,
    title: meta.topic ? `今日のNHKニュース（${meta.ja}） — ${dateLabel}` : `今日のNHKニュース — ${dateLabel}`,
    channelName: meta.topic ? `NHK ニュース（${meta.ja}）` : 'NHK ニュース',
    thumbnail: 'https://www3.nhk.or.jp/common/img/common/sns_icon_nhk.png',
    transcript,
    level: config?.level || 'N3 중급',
    // 주제 태그 = source 라벨 접미(스키마 0). cat0은 라벨을 안 실어 접두사 체인('nhk')이 그대로 판정한다.
    ...(meta.topic ? { source: `nhk_${meta.topic}` } : {}),
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

/**
 * 주제 슬러그 — `source` 라벨 접미. 악센트를 떼고 소문자·비문자를 `_`로(Santé → sante). 한자 등
 * 비라틴 문자는 그대로 둔다(科技 → 科技) — 떼면 zh 카테고리가 전부 빈 문자열이 된다.
 */
export function topicSlug(text) {
  return String(text || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * @param {number} count
 * @param {'en'|'fr'|'zh'} lang
 * @param {{category?: string, topic?: string}} opts — `category`가 있으면 그 카테고리의 최신 글만
 *   긷는다(`list=categorymembers`, U R4). 카테고리가 곧 위키 자신의 분류라 주제 태그는 거기서 온다.
 *   없으면 현행(최근 새 글) 그대로 — 라벨도 옛 접두사 체인('wikinews') 그대로.
 */
export async function fetchWikinews(count = 3, lang = 'en', opts = {}) {
  const edition = WIKINEWS_EDITIONS[lang] || WIKINEWS_EDITIONS.en;
  const gate = edition.gate ? GATES[edition.gate] : null;
  const category = String(opts?.category || '').trim();
  // 게이트가 붙은 언어판은 후보를 더 넓게 긷는다 — allowlist라 대부분이 걸러지므로
  // 평소 폭(count*4)으로는 수확이 0에 수렴한다. 상한은 두어 크론 벽시계를 지킨다.
  const limit = String(count * (gate ? 12 : 4));
  const params = category
    ? new URLSearchParams({
        action: 'query', list: 'categorymembers', cmtitle: `Category:${category}`, cmnamespace: '0',
        cmsort: 'timestamp', cmdir: 'desc', cmlimit: limit, format: 'json', origin: '*',
      })
    : new URLSearchParams({
        action: 'query', list: 'recentchanges', rcnamespace: '0',
        rclimit: limit, rctype: 'new', format: 'json', origin: '*',
      });
  const topic = category ? topicSlug(opts?.topic || category) : '';
  if (category && !topic) return [];   // 슬러그가 비면 태그를 못 싣는다 — 거부
  const data = await wikiFetch(`https://${lang}.wikinews.org/w/api.php?${params}`);
  const articles = (category ? data?.query?.categorymembers : data?.query?.recentchanges) || [];
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
      channelName: category ? `${edition.channel} · ${category}` : edition.channel,
      thumbnail: null,
      transcript: text,
      level: opts?.level || edition.level,
      // 주제 태그 — 카테고리 수집일 때만(현행 최근 글은 라벨 무변경).
      ...(topic ? { source: `wikinews_${lang}_${topic}` } : {}),
    });
  }
  return results;
}

// ── 5. rss_text — 본문을 담는 RSS 공용 문(U R4) ─────────────────────
/**
 * 계열 레지스트리 — **라이선스와 출처 표기가 코드에 산다**(F R5 관례: 라이선스는 설정 표식이 아니라
 * 근거에서). 계열에 없는 피드는 받지 않는다(fail-closed) — 저작물 본문 복제 금지(IP 정책)의 집행 지점.
 *   voa — 미국 정부 저작물 = 퍼블릭 도메인(youtube_channel VOA와 같은 근거)
 *   sp  — service-public.fr, Licence Ouverte 2.0(Etalab): 복제·재배포 가능, **출처 표기 조건**
 * 출처 줄은 본문 끝에 붙여 자료로 반입돼도 함께 간다(저장은 표기가 아니다 — F R5).
 */
export const RSS_FAMILIES = Object.freeze({
  voa: Object.freeze({
    channel: 'VOA Learning English', level: 'B1 중급', license: 'public-domain',
    credit: 'Source: VOA Learning English (U.S. government work, public domain)',
  }),
  sp: Object.freeze({
    channel: 'service-public.fr', level: 'B1 중급', license: 'etalab-2.0',
    credit: 'Source : service-public.fr — Licence Ouverte / Open Licence 2.0 (Etalab)',
  }),
});

/** HTML 조각 → 읽을 글. 줄바꿈 태그는 줄바꿈으로, 나머지 태그는 떼고, 엔티티를 되돌린다. */
export function htmlToText(html) {
  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return stripCdata(html)
    .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6])\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** RSS 2.0 `<item>` → { title, link, html, thumbnail }. content:encoded(전문)가 있으면 그것, 없으면 description. */
export function parseRssItems(xml) {
  const pick = (block, tag) => (block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')) || [])[1] || '';
  return [...String(xml || '').matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((m) => {
    const block = m[1];
    const media = block.match(/<(?:media:content|media:thumbnail|enclosure)[^>]*\burl="([^"]+)"/i);
    return {
      title: htmlToText(pick(block, 'title')),
      link: stripCdata(pick(block, 'link')) || stripCdata((block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i) || [])[1]),
      html: pick(block, 'content:encoded') || pick(block, 'description'),
      thumbnail: media ? media[1] : null,
    };
  });
}

/** 짧은 결정적 id — 링크(없으면 제목)에서. upsert 키가 (date, video_id)라 같은 글은 하루에 한 번만 담긴다. */
function shortHash(s) {
  let h = 5381;
  for (const ch of String(s)) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0;
  return h.toString(16).padStart(8, '0');
}

/**
 * @param {number} count
 * @param {{family: string, topic: string, url: string, level?: string}} config —
 *   `family`(레지스트리 키)·`topic`(피드 섹션 = 소스 자신의 분류)·`url`(그 섹션의 RSS) 셋이 다 있어야 긷는다.
 */
export async function fetchRssText(count = 3, config = {}) {
  const family = RSS_FAMILIES[String(config?.family || '')];
  const topic = topicSlug(config?.topic);
  const url = String(config?.url || '').trim();
  if (!family || !topic || !/^https?:\/\//.test(url)) return [];   // fail-closed: 계열·주제·피드 셋 다 필요

  const xml = await textFetch(url);
  if (!xml) return [];

  const results = [];
  for (const item of parseRssItems(xml)) {
    if (results.length >= count) break;
    const text = htmlToText(item.html);
    if (!item.title || text.length < 300) continue;   // 요약뿐인 항목은 읽기 자료가 못 된다(devto 선례 300자)
    results.push({
      videoId: `rss_${config.family}_${topic}_${shortHash(item.link || item.title)}`,
      title: item.title,
      channelName: family.channel,
      thumbnail: item.thumbnail,
      // 출처 줄은 본문의 일부 — 자료로 반입돼도 표기가 따라간다(Etalab은 표기가 조건).
      transcript: `${text.slice(0, 3000)}\n\n${family.credit}${item.link ? ` · ${item.link}` : ''}`,
      level: config?.level || family.level,
      source: `${config.family}_${topic}`,
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
    // config.feed(NHK 카테고리)·config.category(Wikinews 카테고리)는 U R4 — 없으면 현행 경로 그대로.
    case 'nhk_rss':     return fetchNHKHeadlines(count, config);
    case 'devto':       return fetchDevto(count);
    case 'wikinews':    return fetchWikinews(count, 'en', config);
    case 'wikinews_fr': return fetchWikinews(count, 'fr', config);
    // zh는 기본 소스에 넣지 않는다 — 하드리밋 「중화권 정치 서술 완전 배제」.
    // 뉴스 피드는 정치 기사를 자동으로 추천 카드에 올리게 되므로, 개통은 오너 결정이다.
    // 그 결정이 나면 DB 행 하나로 끝나도록, 선행 조건이던 **주제 게이트를 먼저 달았다**
    // (F R3). 게이트는 `WIKINEWS_EDITIONS.zh.gate`가 건다 — 여기 분기에는 없다.
    case 'wikinews_zh': return fetchWikinews(count, 'zh', config);

    // 본문을 담는 RSS 공용 문(U R4) — VOA(퍼블릭 도메인)·service-public(Etalab). 계열 밖은 거부.
    case 'rss_text':    return fetchRssText(count, config);

    // 영상(v2-F R4) — **목록만** 긷는다. 자막 본문은 사용자가 카드를 눌러 자기 계정의
    // 비공개 자료를 만들 때 `/api/import/link`(F R1)가 가져온다. 서버는 안 담는다.
    // 동적 import — youtubei.js는 무겁고 이 분기에서만 필요하다(link 라우트 선례).
    case 'youtube_channel': {
      const { fetchYoutubeChannel } = await import('./server/youtubeChannel.js');
      return fetchYoutubeChannel(count, config);
    }

    // CC BY 영상 검색(v2-F R5) — 재배포가 허용된 자료라 **본문까지 담아 공개 자료**로 둔다.
    // 라이선스는 검색 필터를 믿지 않고 영상마다 재확인한다(fail-closed).
    case 'youtube_cc': {
      const { fetchYoutubeCc } = await import('./server/youtubeShareable.js');
      return fetchYoutubeCc(count, config);
    }

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
