import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'manabi — 읽고, 담고, 제때 다시 만나는 외국어 서재';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/* 브랜드 값 — docs/ui-conventions.md 「6. 브랜드」 정본. Satori는 CSS 변수를 읽지 못해 값으로 쓴다. */
const ROSE = '#994A5A';
const INK = '#322E30';
const MUTED = '#796D70';
const PAPER = '#FFFDF9';

/* public/icon.svg와 같은 원본(brandAssets 계약이 일치를 고정한다). */
const ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#994A5A"/><g transform="translate(-12 -8)"><path d="M120 356 L120 238 C120 198 148 178 177 178 C206 178 234 198 234 238 L234 356 M234 238 C234 198 262 178 291 178 C320 178 348 198 348 238 L348 356" fill="none" stroke="#FFF4E6" stroke-width="54" stroke-linecap="round" stroke-linejoin="round"/><circle cx="414" cy="350" r="32" fill="#FFD04D"/></g></svg>';
const ICON_SRC = `data:image/svg+xml;base64,${btoa(ICON_SVG)}`;

const NAME = 'manabi';
const TAGLINE = '읽고, 담고, 제때 다시 만나는 외국어 서재';
const LANGS = '日本語 · 中文 · Français · English';

/**
 * 글꼴을 명시해 싣는다 — Satori 기본 글꼴은 라틴 400 하나뿐이라 한글·한자는 두부가 되거나
 * 런타임 자동 대체(굵기 400 고정)에 기댄다. 쓰는 글자만 담은 부분 글꼴을 Google Fonts에서 받는다.
 * 한자는 일본어/중국어 표기에 맞는 글꼴을 따로 싣는다. 부분 글꼴마다 그 글자만 들어 있어서
 * 한 줄 안에서도 Satori가 글자별로 맞는 글꼴을 고른다(日本語 → JP, 中文 → SC, 나머지 → Manrope).
 * 하나라도 실패하면 그 글꼴만 빼고 렌더한다(자동 대체가 남은 글자를 맡는다).
 */
async function loadFont(family, weight, text) {
  const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(url, {
    // 옛 Safari UA면 TTF(Satori가 읽는 형식)를 돌려준다 — next/og 자동 대체와 같은 방식
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1' },
  })).text();
  const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
  if (!src) throw new Error(`font css: ${family}`);
  const res = await fetch(src[1]);
  if (!res.ok) throw new Error(`font ${family}: ${res.status}`);
  return { name: family, data: await res.arrayBuffer(), weight, style: 'normal' };
}

async function loadFonts() {
  const wanted = [
    ['Manrope', 800, NAME],
    ['Manrope', 700, LANGS.replace(/[^ -\u024F]/g, '')],
    ['Noto Sans KR', 500, TAGLINE],
    ['Noto Sans JP', 700, '日本語'],
    ['Noto Sans SC', 700, '中文'],
  ];
  const settled = await Promise.allSettled(wanted.map(([f, w, t]) => loadFont(f, w, t)));
  return settled.filter((r) => r.status === 'fulfilled').map((r) => r.value);
}

export default async function OGImage() {
  const fonts = await loadFonts();
  const sans = 'Manrope, "Noto Sans KR", "Noto Sans JP", "Noto Sans SC", sans-serif';
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          background: PAPER,
          padding: '0 110px',
          gap: 72,
          fontFamily: sans,
        }}
      >
        <img src={ICON_SRC} width={220} height={220} style={{ borderRadius: 49, flexShrink: 0 }} alt="" />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', color: INK, fontSize: 124, fontWeight: 800, letterSpacing: -6, lineHeight: 1 }}>
            <span style={{ fontFamily: 'Manrope' }}>{NAME}</span>
            {/* 마침표 자리: Satori가 빈 상자를 기준선보다 0.1em쯤 아래에 두어 그만큼 올린다(실렌더 측정 2026-10-08) */}
            <div style={{ width: 23, height: 23, borderRadius: 12, background: ROSE, marginLeft: 6, position: 'relative', top: -13 }} />
          </div>
          <div style={{ marginTop: 30, fontSize: 40, fontWeight: 500, color: MUTED }}>{TAGLINE}</div>
          <div style={{ marginTop: 54, fontSize: 32, fontWeight: 700, color: ROSE }}>{LANGS}</div>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
