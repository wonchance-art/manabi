import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEARNING_LANGUAGES as canonical } from '../learningLanguages.js';
import { LEARNING_LANGUAGES as reexported } from '../learningSources.js';
import { REVIEW_SCOPE_LANGS } from '../reviewScopeUrl.js';

// 계약: HSK 단어 목록 지연 로드(LevelListPage) — 단어 · 문형 목록 번들에서 한자판 · FSRS 저장 코드 · 학습 출처 모듈을 뺀다.
// ⑴ 한자판은 next/dynamic ⑵ 저장 클라이언트는 처음 저장(또는 X에 손이 갈 때) import() ⑶ 복습 범위 주소는 import 0개 언어 모듈만.

const read = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');
const page = read('src/views/LevelListPage.jsx');
const staticImports = (src) => [...src.matchAll(/^import\s[^;]*?from\s+'([^']+)'/gm)].map((m) => m[1]);

describe('⑴ 한자판 — 「한자」 탭에서만 받는다', () => {
  it('정적 import가 없고 next/dynamic으로 불러오며, 받는 동안 상태 문구를 보인다', () => {
    expect(staticImports(page)).not.toContain('@/components/levels/HanziBoard');
    expect(page).toContain("import dynamic from 'next/dynamic';");
    expect(page).toMatch(/const HanziBoard = dynamic\(\(\) => import\('@\/components\/levels\/HanziBoard'\), \{\s*loading: \(\) => <p className="lv-empty" aria-busy="true">한자판 불러오는 중…<\/p>,\s*\}\);/);
    expect(page).not.toMatch(/ssr:\s*false/); // 서버 렌더는 기본값 그대로
  });
});

describe('⑵ FSRS 저장 클라이언트 — 처음 저장할 때 만든다', () => {
  it('정적 import가 없고 import()로 지연 생성한다', () => {
    expect(staticImports(page)).not.toContain('@/lib/fsrsLearningClient');
    expect(page).not.toMatch(/^import[^;]*createFsrsLearningClient/m);
    expect(page).toContain("import('@/lib/fsrsLearningClient').then(({ createFsrsLearningClient }) => {");
  });

  it('같은 계정이면 다시 쓰고, 받는 중이면 같은 약속을 돌려주며, 계정이 바뀌면 버린다', () => {
    const ensure = page.match(/const ensureFsrs = useCallback\(\(\) => \{[\s\S]*?\n {2}\}, \[\]\);/)?.[0];
    expect(ensure, 'ensureFsrs를 못 찾았다').toBeTruthy();
    expect(ensure).toContain('if (fsrs.current?.accountId === account) return Promise.resolve(fsrs.current.client);');
    expect(ensure).toContain('if (fsrsLoad.current?.accountId === account) return fsrsLoad.current.promise;');
    expect(ensure).toContain('if (fsrsEpoch.current !== epoch || userRef.current !== account) return null;');
    expect(ensure).toContain('client.start();');
    // 계정이 바뀌거나 화면을 떠나면 버리고, 받는 중이던 것은 만들지 않는다.
    expect(page).toMatch(/useEffect\(\(\) => \(\) => \{\s*fsrsEpoch\.current \+= 1;\s*fsrsLoad\.current = null;[\s\S]*?current\?\.client\.dispose\?\.\(\);\s*\}, \[userId\]\);/);
  });

  it('저장은 클라이언트를 기다리고, X · 한자판 저장 버튼에 손이 가면 미리 받는다', () => {
    const save = page.match(/const save = async \(entry\) => \{[\s\S]*?\n {2}\};/)?.[0];
    expect(save).toContain('const client = await ensureFsrs();');
    expect(save).toContain('if (!client) return done(false);');
    expect(page).toContain('onPointerEnter={onPrepareX} onFocus={onPrepareX}');
    expect(page).toContain('onPrepareX={mounted && userId ? prepareSave : undefined}');
    expect(page).toContain('prepare: prepareSave,');
    expect(read('src/components/levels/HanziBoard.jsx')).toContain('onPointerEnter={words.prepare} onFocus={words.prepare}');
  });
});

describe('⑶ 학습 언어 — import 0개 모듈', () => {
  it('learningLanguages.js는 아무것도 import하지 않는다', () => {
    expect(read('src/lib/learningLanguages.js')).not.toMatch(/^\s*import\s/m);
  });

  it('reviewScopeUrl은 learningSources를 끌어오지 않고 새 모듈을 쓴다', () => {
    const scope = read('src/lib/reviewScopeUrl.js');
    expect(staticImports(scope)).not.toContain('./learningSources.js');
    expect(scope).not.toMatch(/learningSources/);
    expect(staticImports(scope)).toContain('./learningLanguages.js');
  });

  it('두 모듈의 값은 같은 배열이고 고정돼 있다', () => {
    expect(reexported).toBe(canonical);
    expect(canonical).toEqual(['Japanese', 'Chinese', 'French', 'English', 'Korean']);
    expect(Object.isFrozen(canonical)).toBe(true);
    expect(REVIEW_SCOPE_LANGS).toEqual(canonical);
  });
});
