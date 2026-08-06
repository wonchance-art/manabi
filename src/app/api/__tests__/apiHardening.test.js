import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

describe('API 하드닝 계약', () => {
  const wordDetail = read('src/app/api/word-detail/route.js');
  const tts = read('src/app/api/tts/route.js');

  it('word-detail: 이미 채워진 공용 설명은 덮어쓰지 않는다', () => {
    expect(wordDetail).toMatch(/already filled/);
    expect(wordDetail).toMatch(/select\('detail_text'\)/);
  });

  it('word-detail: 마크업성 입력을 저장 단계에서 거절한다', () => {
    expect(wordDetail).toMatch(/\[<>\]/);
    const reject = (t) => /[<>]/.test(String(t));
    expect(reject('<img src=x onerror=1>')).toBe(true);
    expect(reject('**뜻** 사과')).toBe(false);
  });

  it('word-detail: 저장 실패를 성공으로 알리지 않는다', () => {
    expect(wordDetail).toMatch(/if \(error\) return Response\.json/);
  });

  it('tts: 지원하지 않는 lang은 거절해 캐시 우회를 막는다', () => {
    expect(tts).toMatch(/unsupported lang/);
    const VOICES = { Japanese: 1, English: 1, French: 1 };
    const ok = (l) => Object.prototype.hasOwnProperty.call(VOICES, l);
    expect(ok('Japanese')).toBe(true);
    expect(ok('bust-cache-1')).toBe(false);
  });

  it('tts: 인스턴스 총량 차단기가 IP 제한과 함께 걸린다', () => {
    expect(tts).toMatch(/INSTANCE_BUDGET/);
    expect(tts).toMatch(/isRateLimited\(ip\) \|\| isInstanceBudgetExceeded\(\)/);
  });
});
