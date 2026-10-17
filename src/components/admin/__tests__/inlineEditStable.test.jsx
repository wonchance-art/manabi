import { Fragment, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ isAdmin: false }));
vi.mock('../../../lib/AuthContext', () => ({ useAuth: () => ({ isAdmin: auth.isAdmin }) }));
vi.mock('next/dynamic', () => ({ default: () => function InlineEditFormStub() { return null; } }));
import InlineEdit from '../InlineEdit';

// ADMIN-EDIT-STABLE-001 — 관리자 여부(프로필이 늦게 온다)가 바뀌어도 내용은 같은 자리에 남아 다시 마운트되지 않는다.
// 예전: 비관리자 <>{children}</> → 관리자 <div class="admin-edit">{children}…</div> — 요소 종류가 바뀌어 스토리 문항의
// 고른 타일이 사라졌다(smoke 「관리자 보관함 N5 챕터 · 조립」). 비관리자 마크업은 예전과 바이트 단위로 같다.
const content = createElement('p', { className: 'fr-section__para' }, '본문 문단');
const render = (props = {}) => renderToStaticMarkup(createElement(InlineEdit, { lang: 'Japanese', slug: 'n5-x', path: 'summary', ...props }, content));
// 훅을 쓰는 함수 컴포넌트를 렌더러 밖에서 한 번 부른다 — useState만 쓰므로 대역으로 충분하다(구조 확인용).
vi.mock('react', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, useState: (initial) => (globalThis.__inlineEditDirect ? [initial, () => {}] : actual.useState(initial)) };
});
const tree = (props = {}) => { globalThis.__inlineEditDirect = true; try { return InlineEdit({ lang: 'Japanese', slug: 'n5-x', path: 'summary', ...props, children: content }); } finally { globalThis.__inlineEditDirect = false; } };

beforeEach(() => { auth.isAdmin = false; });

describe('InlineEdit — 관리자 여부와 무관한 같은 구조', () => {
  it('비관리자 마크업은 내용 그대로(감싸개 · 연필 없음) — 기본 div · li 모두', () => {
    expect(render()).toBe('<p class="fr-section__para">본문 문단</p>');
    expect(render({ tag: 'li', className: 'fr-example', style: { color: 'red' } }))
      .toBe('<li class="fr-example" style="color:red"><p class="fr-section__para">본문 문단</p></li>');
  });
  it('관리자는 내용을 감싸지 않고 앞에 연필 기준점만 더한다', () => {
    auth.isAdmin = true;
    const html = render();
    expect(html).toBe(`<span class="admin-edit__anchor"><button type="button" class="admin-edit__pencil" title="이 부분 편집" aria-label="이 부분 편집">✎</button></span><p class="fr-section__para">본문 문단</p>`);
    expect(html).not.toContain('class="admin-edit"');
    expect(render({ tag: 'li', className: 'fr-example' })).toMatch(/^<li class="fr-example"><span class="admin-edit__anchor">.*<\/span><p class="fr-section__para">본문 문단<\/p><\/li>$/);
  });
  it('isAdmin이 바뀌어도 같은 요소 종류 · 같은 칸에 같은 내용 — React가 내용을 보존한다(다시 마운트 없음)', () => {
    for (const tag of ['div', 'li']) {
      auth.isAdmin = false; const before = tree({ tag });
      auth.isAdmin = true; const after = tree({ tag });
      expect(after.type).toBe(before.type);
      if (tag === 'div') expect(before.type).toBe(Fragment);
      const slots = element => (Array.isArray(element.props.children) ? element.props.children : [element.props.children]);
      expect(slots(before)).toHaveLength(2);
      expect(slots(after)).toHaveLength(2);
      expect(slots(before)[0]).toBe(null);
      expect(slots(after)[0]?.props.className).toBe('admin-edit__anchor');
      expect(slots(before)[1]).toBe(content);
      expect(slots(after)[1]).toBe(content);
    }
  });
});
