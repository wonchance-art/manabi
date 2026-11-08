// A11Y-AUTH-001 로그인 화면 접근성 훑기 도구의 부품(2026-11-08 KST) — axe(WCAG 2.1 A/AA + best-practice) · 키보드 탭 · 포커스 표시 · 대화상자 가둠/복귀 ·
// 낭독 영역 · axe가 판정 못 한 대비 칸 실측 · 터치 영역. 실행: e2e/a11y-auth.audit.mjs. 기록: docs/accessibility-audit.md 「로그인 화면 훑기」.
// 잴 때 주의: 포커스 표시는 애니메이션을 끝낸 뒤(transition 도중 프레임 — A11Y-LAUNCH-001 정정), ::before 고리(.line-pick)는 이 도구가 못 본다(손으로 확인),
// 대비 실측은 다른 요소가 덮은 칸(폰 카드 시트 아래)이나 루비 겹침에서 낮게 나온다 — 계산된 색 · 확대 캡처로 확인한다.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
export const PARAGRAPH = {
  paragraph: '今日は駅で友だちに会いました。いっしょに電車に乗りました。',
  translation: '오늘은 역에서 친구를 만났어요. 같이 전철을 탔어요.',
  sentences: [
    { text: '今日は駅で友だちに会いました。', tokens: ['今日は', '駅で', '友だちに', '会いました。'], ko: '오늘은 역에서 친구를 만났어요.', pron: 'きょうはえきでともだちにあいました。' },
    { text: 'いっしょに電車に乗りました。', tokens: ['いっしょに', '電車に', '乗りました。'], ko: '같이 전철을 탔어요.', pron: 'いっしょにでんしゃにのりました。' },
  ],
  questions: [
    { type: 'cloze', focus: 'review', key: 'で', prompt: '今日は駅＿友だちに会いました。', ko: '오늘은 역에서 친구를 만났어요.', answer: 'で', distractors: ['を', 'が', 'へ'] },
    { type: 'comprehension', prompt: '어디에서 친구를 만났나요?', answer: '역', distractors: ['학교', '집', '공원'] },
    { type: 'vocab', focus: 'reading', key: '電車', prompt: '電車', answer: '전철', distractors: ['버스', '자전거', '비행기'] },
  ],
};

export async function axe(page) {
  if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
  return page.evaluate(async (tags) => {
    const pack = (res) => res.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length,
      nodes: v.nodes.slice(0, 4).map((n) => ({ target: n.target.join(' ').slice(0, 140), html: n.html.slice(0, 160), why: (n.failureSummary || '').split('\n').slice(1, 3).join(' ').slice(0, 200) })) }));
    const wcag = await window.axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations', 'incomplete'] });
    const bp = await window.axe.run(document, { runOnly: { type: 'tag', values: ['best-practice'] }, resultTypes: ['violations'] });
    const inc = wcag.incomplete.find((i) => i.id === 'color-contrast')?.nodes || [];
    return { wcag: pack(wcag), bp: pack(bp), incompleteContrast: inc.length, incTargets: inc.map((n) => n.target.join(' ')) };
  }, AXE_TAGS);
}

// 지금 초점이 있는 요소 — 이름 · 역할 · 보이는지 · 포커스 표시(애니메이션을 끝낸 뒤 outline/box-shadow).
export async function focusInfo(page) {
  return page.evaluate(() => {
    for (const a of document.getAnimations()) { try { a.finish(); } catch {} }
    const el = document.activeElement;
    if (!el || el === document.body) return { tag: 'body' };
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const name = (el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('title') || el.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 ? `${cs.outlineWidth} ${cs.outlineStyle} ${cs.outlineColor}` : null;
    const shadow = cs.boxShadow !== 'none' ? cs.boxShadow.slice(0, 60) : null;
    const hidden = !!el.closest('[aria-hidden="true"],[inert]');
    const visible = r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && r.bottom > -1 && r.right > -1;
    const cls = typeof el.className === 'string' ? el.className.split(/\s+/).slice(0, 2).join('.') : '';
    return { tag: el.tagName.toLowerCase(), role: el.getAttribute('role'), cls, name, outline, shadow, hidden, visible, focusVisible: el.matches(':focus-visible'), w: Math.round(r.width), h: Math.round(r.height) };
  });
}

export async function tabWalk(page, n = 20) {
  const out = [];
  await page.evaluate(() => { document.activeElement?.blur?.(); window.scrollTo(0, 0); });
  await page.mouse.click(1, 1).catch(() => {});
  for (let i = 0; i < n; i++) { await page.keyboard.press('Tab'); await page.waitForTimeout(60); out.push(await focusInfo(page)); }
  return out;
}
export const tabProblems = (walk) => walk.filter((f) => f.tag !== 'body' && (f.hidden || !f.visible || (!f.outline && !f.shadow)));

// 낭독 영역(aria-live · role=status/alert)의 글 변화 기록
export async function watchLive(page) {
  await page.evaluate(() => {
    window.__liveObserver?.disconnect(); // 한 화면에서 두 번 걸면 같은 알림을 두 번 센다
    window.__live = [];
    const sel = '[aria-live],[role="status"],[role="alert"],[role="log"]';
    const seen = new WeakMap();
    const scan = () => { for (const el of document.querySelectorAll(sel)) { const t = el.textContent.replace(/\s+/g, ' ').trim(); if (t && seen.get(el) !== t) { seen.set(el, t); if (el.getAttribute('aria-live') !== 'off') window.__live.push({ live: el.getAttribute('aria-live') || el.getAttribute('role'), text: t.slice(0, 80) }); } } };
    scan(); window.__live = [];
    window.__liveObserver = new MutationObserver(scan);
    window.__liveObserver.observe(document.body, { subtree: true, childList: true, characterData: true });
  });
}
export const liveLog = (page) => page.evaluate(() => window.__live || []);

// 대화상자: 연 단추로 Enter → 초점이 안으로 · Tab 12번 안에 머무름 · Esc로 닫힘 · 초점이 연 단추로.
export async function dialogCheck(page, opener, { dialog = '[role="dialog"],[aria-modal="true"]', tabs = 12 } = {}) {
  await opener.evaluate((el) => el.setAttribute('data-a11y-opener', '1'));
  await opener.focus();
  await page.keyboard.press('Enter');
  const box = page.locator(dialog).last();
  const opened = await box.waitFor({ timeout: 5000 }).then(() => true, () => false);
  if (!opened) return { opened: false };
  await page.waitForTimeout(400);
  const inside = () => page.evaluate((sel) => { const d = [...document.querySelectorAll(sel)].pop(); return !!d && d.contains(document.activeElement); }, dialog);
  const focusIn = await inside();
  let escaped = 0;
  for (let i = 0; i < tabs; i++) { await page.keyboard.press('Tab'); await page.waitForTimeout(40); if (!(await inside())) escaped++; }
  const label = await box.evaluate((d) => d.getAttribute('aria-label') || (d.getAttribute('aria-labelledby') && document.getElementById(d.getAttribute('aria-labelledby'))?.textContent?.trim()) || null);
  const modal = await box.evaluate((d) => d.getAttribute('aria-modal'));
  const ax = await axe(page);
  await page.keyboard.press('Escape');
  const closed = await box.waitFor({ state: 'hidden', timeout: 3000 }).then(() => true, () => false);
  await page.waitForTimeout(300);
  const back = await page.evaluate(() => document.activeElement?.getAttribute('data-a11y-opener') === '1' || !!document.activeElement?.closest('[data-a11y-opener]'));
  const after = await focusInfo(page);
  await page.evaluate(() => document.querySelector('[data-a11y-opener]')?.removeAttribute('data-a11y-opener'));
  return { opened, focusIn, escapedTabs: escaped, label, modal, closed, focusBack: back, after, axe: ax };
}

const sharp = require('sharp');
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
// axe가 판정 못 한 대비 칸 실측 — 글자를 투명하게 한 캡처의 배경 극값(5% · 95%) vs 계산된 글자색(알파 합성), 나쁜 쪽.
export async function measureIncomplete(page, targets) {
  const rows = []; const seen = new Set();
  for (const sel of targets) {
    if (seen.has(sel)) continue; seen.add(sel);
    const info = await page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d'); cx.fillStyle = cs.color; cx.fillRect(0, 0, 1, 1); const [r0, g0, b0, a0] = cx.getImageData(0, 0, 1, 1).data;
      return { hidden: !!el.closest('[aria-hidden="true"]'), color: [r0, g0, b0, a0 / 255], size: parseFloat(cs.fontSize), weight: +cs.fontWeight, w: r.width, h: r.height, text: el.textContent.trim().slice(0, 20), cls: String(el.className || el.tagName).slice(0, 40) }; }, sel).catch(() => null);
    if (!info || info.w < 2 || info.h < 2) continue;
    await page.evaluate((sel) => { const el = document.querySelector(sel); el.dataset.a11yProbe = '1'; const st = document.createElement('style'); st.id = 'a11y-probe'; st.textContent = '[data-a11y-probe], [data-a11y-probe] *{color:transparent!important;text-shadow:none!important;-webkit-text-stroke:0!important}'; document.head.append(st); }, sel);
    await page.waitForTimeout(60);
    const r2 = await page.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, sel);
    const vw = page.viewportSize().width;
    const clip = { x: Math.max(0, r2.x), y: Math.max(0, r2.y), width: Math.max(2, Math.min(r2.w, vw - Math.max(0, r2.x))), height: Math.max(2, r2.h) };
    const buf = await page.screenshot({ clip }).catch(() => null);
    await page.evaluate((sel) => { document.getElementById('a11y-probe')?.remove(); delete document.querySelector(sel).dataset.a11yProbe; }, sel);
    if (!buf) continue;
    const { data } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const px = []; for (let i = 0; i < data.length; i += 3) px.push([data[i], data[i + 1], data[i + 2]]);
    px.sort((a, c) => lum(a) - lum(c)); const dark = px[Math.floor(px.length * 0.05)], light = px[Math.floor(px.length * 0.95)];
    const al = info.color[3]; const fg = (bg) => [0, 1, 2].map((k) => Math.round(info.color[k] * al + bg[k] * (1 - al)));
    const worst = Math.min(ratio(fg(dark), dark), ratio(fg(light), light));
    const large = info.size >= 24 || (info.size >= 18.66 && info.weight >= 700);
    rows.push({ cls: info.cls, text: info.text, size: info.size, hidden: info.hidden, need: large ? 3 : 4.5, ratio: +worst.toFixed(2) });
  }
  return rows;
}

// 터치 영역 — 보이는 조작 요소의 상자(px). 24 미만 · 44 미만을 센다(글 줄 안 링크는 WCAG 2.5.8 예외라 따로 표시).
export async function targets(page) {
  return page.evaluate(() => {
    const els = [...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=tab],[role=checkbox],[role=switch]')]
      .filter((el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !el.closest('[aria-hidden="true"],[inert]') && !el.disabled; });
    const out = { total: els.length, under24: [], under44: 0 };
    for (const el of els) {
      const r = el.getBoundingClientRect(); const w = Math.round(r.width), h = Math.round(r.height);
      const inline = el.tagName === 'A' && getComputedStyle(el).display === 'inline' && el.parentElement && /\S/.test(el.parentElement.textContent.replace(el.textContent, ''));
      if (w < 44 || h < 44) out.under44++;
      if ((w < 24 || h < 24) && !inline) out.under24.push(`${(el.getAttribute('aria-label') || el.textContent || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 18)} ${w}×${h}${el.dataset.sourceToken ? ' (본문 낱말)' : ''}`);
    }
    return out;
  });
}
