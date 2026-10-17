import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sliceBetween } from './helpers/sliceBetween';

// 뷰어 진입 때 user_vocab_encounters · user_known_words가 두 번씩 나가던 원인(2026-10-17 KST 실측, 서재 → 중국어 자료):
// 같은 조회의 중복이 아니라 **다른 언어** 조회였다. 자료가 오기 전 materialLang은 기본값 'Japanese'라 ja로 먼저 받고,
// 자료가 오면 zh로 다시 받았다. 만남 동기화는 ja의 5분 스로틀까지 써 버렸다. 둘 다 자료가 온 뒤 그 언어로 한 번만.
const ROOT = path.resolve(__dirname, '../../..');
const viewer = fs.readFileSync(path.join(ROOT, 'src/views/ViewerPage.jsx'), 'utf8');

describe('뷰어 — 자료 언어가 정해진 뒤에만 언어별 조회', () => {
  it('원인: 자료 전 기본 언어는 Japanese(이 기본값은 그대로 — 언어 없는 자료의 정당한 기본)', () => {
    expect(viewer).toContain("const materialLang = material?.processed_json?.metadata?.language || 'Japanese';");
    expect(viewer).toContain('const materialReady = !!material;');
  });
  it('만남 동기화는 자료가 온 뒤 — 자료 전엔 시작하지 않고, 자료가 오면 다시 판단한다(의존성)', () => {
    const effect = sliceBetween(viewer, 'const materialReady = !!material;', '}, [user?.id, metCode, materialReady]);');
    expect(effect).toContain('if (!user?.id || !metCode || !materialReady) return undefined;');
    expect(effect).toContain('syncVocabEncounters(supabase, user.id, metCode)');
  });
  it('아는 단어 조회도 자료가 온 뒤', () => {
    expect(viewer).toContain('const knownState = useKnownWords(knownLangCode, !!knownLangCode && materialReady);');
    expect(viewer.split('useKnownWords(').length - 1).toBe(1);
  });
});
