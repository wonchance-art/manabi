import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

/**
 * 계약: 클라이언트 분기(analyzeText)와 서버 화이트리스트(/api/analyze)의 언어 집합이 같아야 한다.
 * 어긋나면 새로 붙인 언어가 조용히 옛 Gemini per-line 폴백으로 새어 나간다 — 실제로 그 사고가 났다
 * (서버엔 jieba·병음이 붙었는데 클라가 중국어를 보내지 않아 실사용에서 전혀 쓰이지 않음).
 */
describe('analyzeText ↔ /api/analyze 언어 집합 정합', () => {
  const LANGS = ['Japanese', 'English', 'Chinese'];

  function clientLangs() {
    const src = read('src/lib/analyzeText.js');
    // `if (lang === ...)` 조건 줄만 정확히 — 'language ===' 부분 문자열에 걸리지 않게 경계를 준다.
    const line = src.split('\n').find((l) => /\bif \(lang === /.test(l));
    return LANGS.filter((lang) => line?.includes(`'${lang}'`));
  }

  function serverLangs() {
    const src = read('src/app/api/analyze/route.js');
    const m = src.match(/if \(!\[([^\]]+)\]\.includes\(language\)\)/);
    return LANGS.filter((lang) => m?.[1]?.includes(`'${lang}'`));
  }

  it('클라이언트 분기가 서버 화이트리스트와 같은 언어 집합을 쓴다', () => {
    expect(clientLangs()).toEqual(serverLangs());
  });

  it('중국어가 양쪽에 모두 있다(jieba·병음 경로 사용)', () => {
    expect(clientLangs()).toContain('Chinese');
    expect(serverLangs()).toContain('Chinese');
  });

  it('서버 토크나이저가 3언어 모두 배선돼 있다', () => {
    const route = read('src/app/api/analyze/route.js');
    expect(route).toContain('tokenizeJaLine');
    expect(route).toContain('tokenizeEnLine');
    expect(route).toContain('tokenizeZhLine');
  });
});
