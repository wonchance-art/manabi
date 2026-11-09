import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import nextConfig from '../../../next.config.mjs';
import { EXTRA_HTML_LIMITED_BOTS, htmlLimitedBotsRegex } from '../htmlBots';

// LH-BASELINE-001 — 메타데이터(description · og)를 <head>에 받을 봇. Next 기본 목록을 줄이지 않고 Googlebot · Daumoa · kakaotalk-scrap을 더한다.
const require = createRequire(import.meta.url);
const { HTML_LIMITED_BOT_UA_RE } = require('next/dist/shared/lib/router/utils/html-bots.js');
const UA = {
  googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  googlebotMobile: 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  daum: 'Mozilla/5.0 (compatible; Daum/4.1; +http://cs.daum.net/faq/15/4118.html?faqId=28966) Daumoa/4.0',
  kakao: 'facebookexternalhit/1.1; kakaotalk-scrap/1.0; +https://devtalk.kakao.com/t/scrap/33984',
  kakaoOnly: 'kakaotalk-scrap/1.0',
  naver: 'Mozilla/5.0 (compatible; Yeti/1.1; +https://naver.me/spd)',
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  kakaoInApp: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.4.0',
};

describe('htmlLimitedBots — 메타데이터를 head에 받을 봇', () => {
  const re = nextConfig.htmlLimitedBots;
  it('next.config가 Next 기본 목록 + 우리 봇을 싣는다(기본 목록을 줄이지 않는다)', () => {
    expect(re).toBeInstanceOf(RegExp);
    expect(re.source.startsWith(HTML_LIMITED_BOT_UA_RE.source)).toBe(true);
    expect(re.source).toBe(htmlLimitedBotsRegex(HTML_LIMITED_BOT_UA_RE.source).source);
    expect(re.flags).toContain('i');
    expect(EXTRA_HTML_LIMITED_BOTS).toEqual(['Googlebot', 'Daumoa', 'kakaotalk-scrap']);
  });
  it.each(['googlebot', 'googlebotMobile', 'daum', 'kakao', 'kakaoOnly', 'naver'])('%s → 메타데이터 blocking(head)', (k) => {
    expect(re.test(UA[k])).toBe(true);
  });
  it.each(['chrome', 'safari', 'kakaoInApp'])('사람 브라우저 %s → 그대로 흘려 받는다', (k) => {
    expect(re.test(UA[k])).toBe(false);
  });
});
