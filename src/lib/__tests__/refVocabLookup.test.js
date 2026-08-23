import { describe, expect, it, vi } from 'vitest';
import { encounterLookupLang, loadMetWordKeys, loadRefVocabLookup } from '../refVocabLookup.js';
import { vocabEncounterStorageKey } from '../../components/world/vocabEncounters.js';

// 🈁 언어별 정본 조회(rfc-vocab-encounter §4.7) — 실제 정본 payload 기준 실측 핀.
//   ja는 기존 findWord 위임(불변), fr/zh는 refLangs 레지스트리 표제어 키 인덱스.

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value)),
  };
}

describe('encounterLookupLang — 기록 대상 언어', () => {
  it('4트랙 전부(en은 2026-08-22 오너 지시로 편입) — 미지는 null', () => {
    expect(encounterLookupLang('Japanese')).toBe('ja');
    expect(encounterLookupLang('French')).toBe('fr');
    expect(encounterLookupLang('Chinese')).toBe('zh');
    expect(encounterLookupLang('English')).toBe('en');
    expect(encounterLookupLang(undefined)).toBeNull();
  });
});

describe('loadRefVocabLookup — fr 실측', () => {
  it('토큰 표면형이 저작 표제어(관사형)에 접히고 main은 저작 표기 그대로', async () => {
    const lookup = await loadRefVocabLookup('fr');
    const hit = lookup.findWord('famille');
    // 실측: famille는 A0(오리엔테이션)에도 있어 학습 순서 첫 등록이 이긴다(ja N5 우선과 동일 원칙)
    expect(hit).toMatchObject({ level: 'A0', main: 'la famille' });
    expect(lookup.findWord('Famille')?.main).toBe('la famille');
    expect(lookup.findWord('père')?.main).toBe('le père'); // 악상 표면형
  });

  it('저작 표기 원문으로도 같은 엔트리 — 기록(main) → 재대조 왕복이 안정', async () => {
    const lookup = await loadRefVocabLookup('fr');
    const hit = lookup.findWord('famille');
    expect(lookup.findWord(hit.main)).toBe(hit);
  });

  it('정본 밖·빈 입력은 null', async () => {
    const lookup = await loadRefVocabLookup('fr');
    expect(lookup.findWord('xyzzy')).toBeNull();
    expect(lookup.findWord('')).toBeNull();
    expect(lookup.findWord(undefined)).toBeNull();
  });
});

describe('loadRefVocabLookup — zh 실측', () => {
  it('표면형=표제어 직결(중국어 무활용) — H1 어휘가 잡힌다', async () => {
    const lookup = await loadRefVocabLookup('zh');
    expect(lookup.findWord('你好')).toMatchObject({ level: 'H1', main: '你好' });
    expect(lookup.findWord('学生')?.main).toBe('学生');
    expect(lookup.findWord(' 你好 ')?.main).toBe('你好'); // trim만
  });
});

describe('loadRefVocabLookup — en 실측', () => {
  it('소문자 키로 접히고 main은 저작형 그대로 — Monday 대소문자 왕복', async () => {
    const lookup = await loadRefVocabLookup('en');
    expect(lookup.findWord('family')).toMatchObject({ level: 'A1', main: 'family' });
    expect(lookup.findWord('Family')?.main).toBe('family');
    expect(lookup.findWord('monday')?.main).toBe('Monday'); // 기록은 저작형 유지
    // 조회기는 렘마타이저가 아니다 — 굴절형은 토크나이저 base_form(ran→run)이 접는다.
    expect(lookup.findWord('run')?.main).toBe('run');
    expect(lookup.findWord('ran')).toBeNull();
  });
});

describe('loadRefVocabLookup — ja 위임·미지원', () => {
  it('기존 정본 findWord 위임 — main=word.ja, 낮은 급수 우선 그대로', async () => {
    const lookup = await loadRefVocabLookup('ja');
    expect(lookup.findWord('食券')).toMatchObject({ level: 'N5', main: '食券' });
    expect(lookup.findWord('실측에없는말')).toBeNull();
  });

  it('미지원 코드는 null 해석 — 뷰어가 조용히 건너뛴다', async () => {
    expect(await loadRefVocabLookup('xx')).toBeNull();
    expect(await loadRefVocabLookup(undefined)).toBeNull();
  });
});

describe('loadMetWordKeys — 만남 기록 → 점 비교 키 집합', () => {
  it('fr 저작형은 정규화 키로, en은 소문자로 접고, ja는 원문 그대로(기존 동작 불변)', () => {
    const storage = memoryStorage({
      [vocabEncounterStorageKey('fr')]: JSON.stringify(['la famille', "l'eau (f.)"]),
      [vocabEncounterStorageKey('en')]: JSON.stringify(['Monday']),
      [vocabEncounterStorageKey('ja')]: JSON.stringify(['食券']),
    });
    expect([...loadMetWordKeys('fr', storage)].sort()).toEqual(['eau', 'famille']);
    expect([...loadMetWordKeys('en', storage)]).toEqual(['monday']);
    expect([...loadMetWordKeys('ja', storage)]).toEqual(['食券']);
    expect(loadMetWordKeys('fr', memoryStorage()).size).toBe(0);
  });
});
