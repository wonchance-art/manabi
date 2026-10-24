import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ViewerError from '../../app/(app)/viewer/error.jsx';

// OFFLINE-SWEEP-001 P8 · P9 — 끊김 화면 문구.
describe('뷰어 오류 경계 — 조각 오류는 연결 문제로(P9)', () => {
  const chunk = Object.assign(new Error('Loading chunk 89671 failed.\n(error: https://manabi.example/_next/static/chunks/89671.js)'), { name: 'ChunkLoadError' });
  it('끊긴 채 지연 부품을 못 받으면 「자료를 불러오지 못했어요」가 아니라 연결 안내', () => {
    const html = renderToStaticMarkup(createElement(ViewerError, { error: chunk, reset: () => {} }));
    expect(html).toContain('인터넷 연결을 확인해 주세요');
    expect(html).not.toContain('자료를 불러오지 못했어요');
  });
  it('원인을 모르는 오류는 그대로 「자료를 불러오지 못했어요」', () => {
    const html = renderToStaticMarkup(createElement(ViewerError, { error: new Error('boom'), reset: () => {} }));
    expect(html).toContain('자료를 불러오지 못했어요');
  });
});

describe('/offline 대체 화면 — 띠와 같은 말을 두 번 쓰지 않는다(P8)', () => {
  const page = fs.readFileSync('src/app/(app)/offline/page.jsx', 'utf8');
  const layout = fs.readFileSync('src/components/Layout.jsx', 'utf8');
  it('제목은 이 화면의 사정 · 연결 안내는 띠가 한다', () => {
    expect(page).toContain('>이 화면은 아직 받아 두지 않았어요</h1>');
    expect(page).not.toMatch(/>인터넷 연결을 확인해 주세요</);
    expect(layout).toContain('인터넷 연결을 확인해 주세요. 저장해 둔 자료·단어장은 그대로 볼 수 있어요.');
  });
});
