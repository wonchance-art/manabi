import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// 계약(N1 교차 검토 2026-10-17 KST): 화면 읽기 전용 글자(시각적으로 숨김)의 선언은 index.css 한 곳(.sr-only 목록)이다.
// 같은 9개 선언을 파일마다 다시 쓰던 클래스(.skeleton-sr · .group-card__sr · .hanja-pop__sr · 범위 붙은 .sr-only 둘)는
// 목록에 이름만 더했다 — 선택자 · 선언이 그대로라 계산값이 바뀌지 않는다. 선언이 다른 것은 각 파일에 두고 아래에 이유를 적는다.

const ROOT = process.cwd();
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const cssFiles = (dir, out = []) => {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) { if (!['__tests__', 'node_modules', 'world'].includes(name)) cssFiles(p, out); }
    else if (name.endsWith('.css')) out.push(p);
  }
  return out;
};
// 규칙(선택자 목록 · 선언)으로 읽는다. @media 안쪽 규칙도 같은 규칙으로 잡힌다(보수적).
const rules = (css) => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, body]) => ({
  selectors: sel.split(',').map(s => s.trim().replace(/\s+/g, ' ')).filter(Boolean),
  decls: Object.fromEntries(body.split(';').map(d => d.trim()).filter(Boolean).map(d => {
    const i = d.indexOf(':');
    return [d.slice(0, i).trim(), d.slice(i + 1).trim().replace(/\s+/g, ' ')];
  })),
}));
const ALL = cssFiles(path.join(ROOT, 'src')).map(f => ({ file: path.relative(ROOT, f), rules: rules(fs.readFileSync(f, 'utf8')) }));
/** 그 선택자(가상 클래스 없이 정확히 같은 것)에 걸리는 선언을 파일 · 순서대로 합친다. */
const resolved = (selector) => Object.assign({}, ...ALL.flatMap(({ rules: rs }) => rs.filter(r => r.selectors.includes(selector)).map(r => r.decls)));

const CANON = {
  position: 'absolute', width: '1px', height: '1px', padding: '0', margin: '-1px',
  overflow: 'hidden', 'clip-path': 'inset(50%)', 'white-space': 'nowrap', border: '0',
};
const MIGRATED = ['.sr-only', '.skeleton-sr', '.group-card__sr', '.hanja-pop__sr'];
// 숨김 모양이지만 선언이 달라(계산값이 달라진다) 옮기지 않은 것 — 이름과 이유.
const VARIANTS = {
  '.lv-sr': 'clip: rect(…) 방식 + :focus-visible이면 보이는 「펼쳐 보기」 버튼(level-list.css)',
  '.shelf-sr': 'clip: rect(0,0,0,0) 방식(library.css)',
  '.conv-sr': 'clip: rect · 여백 · 테두리 선언 없음(conversation.css)',
  '.teaching-board-accessible': '여백 · 줄바꿈 선언 없음, 칠판 낭독용 블록(teaching-board.css)',
};

describe('화면 읽기 전용 글자 — 정본 한 곳', () => {
  it('index.css 정본 규칙은 옮긴 클래스 목록 + 9개 선언 그대로다', () => {
    const canon = rules(read('src/index.css')).filter(r => r.selectors.includes('.sr-only'));
    expect(canon).toHaveLength(1);
    expect(canon[0].selectors).toEqual(MIGRATED);
    expect(canon[0].decls).toEqual(CANON);
  });

  it('옮긴 클래스는 어느 파일에서도 정본과 같은 값으로 풀린다(다른 규칙이 덮지 않는다)', () => {
    for (const sel of MIGRATED) {
      // 그 선택자에 걸리는 규칙은 정본 하나뿐이다 — 다른 파일의 규칙이 있으면 불러오는 순서에 따라 값이 갈린다.
      const hits = ALL.flatMap(({ file, rules: rs }) => rs.filter(r => r.selectors.includes(sel)).map(() => file));
      expect(hits, sel).toEqual([path.join('src', 'index.css')]);
      expect(resolved(sel), sel).toEqual(CANON);
    }
    // 예전 범위 선택자는 남지 않는다 — 전역 .sr-only가 같은 값으로 그 자리를 맡는다.
    for (const sel of ['.material-composer .sr-only', '.viewer-boundary-confirm .sr-only', '.viewer-boundary-split .sr-only', '.manabi-app .gnb__action-label']) {
      expect(resolved(sel), sel).toEqual({});
    }
  });

  it('정본 밖에서 같은 숨김 선언을 다시 쓰지 않는다 — 남은 변형은 이유와 함께 목록에 있다', () => {
    const hidden = ALL.flatMap(({ file, rules: rs }) => rs
      .filter(r => r.decls.width === '1px' && r.decls.height === '1px' && r.decls.overflow === 'hidden'
        && (r.decls['clip-path'] === 'inset(50%)' || /^rect\(/.test(r.decls.clip || '')))
      .map(r => ({ file, selectors: r.selectors })));
    const outside = hidden.filter(h => !(h.file === path.join('src', 'index.css') && h.selectors.includes('.sr-only')));
    expect(outside.flatMap(h => h.selectors).sort()).toEqual(Object.keys(VARIANTS).sort());
    for (const sel of Object.keys(VARIANTS)) expect(resolved(sel), sel).not.toEqual(CANON); // 정말로 다르다 — 같아지면 목록으로 옮긴다
  });

  it('옮긴 클래스는 화면에서 그대로 쓰인다(이름을 바꾸지 않았다) · 쓰이지 않던 .gnb__action-label은 지웠다', () => {
    expect(read('src/components/Skeleton.jsx')).toContain('className="skeleton-sr"');
    expect(read('src/views/MaterialsPage.jsx')).toContain('className="group-card__sr"');
    expect(read('src/components/viewer/ViewerHanjaPopover.jsx')).toContain('className="hanja-pop__sr"');
    expect(read('src/components/materials/MaterialComposer.jsx')).toContain('<label className="sr-only" htmlFor="composer-title">');
    expect(read('src/components/viewer/ViewerBoundaryEdit.jsx')).toContain('<legend className="sr-only">');
    expect(read('src/components/web/web-shell.css')).not.toContain('gnb__action-label');
    expect(read('src/components/Layout.jsx')).not.toContain('gnb__action-label');
  });
});
