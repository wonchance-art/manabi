import { describe, expect, it, vi } from 'vitest';
import {
  isEncounterLang,
  loadVocabEncounters,
  loadVocabEncounterContexts,
  recordVocabEncounters,
  stepEncounterContext,
  saveVocabEncounters,
  scriptEncounterRefs,
  stepEncounterRefs,
  vocabEncounterStorageKey,
  vocabEncounterContextStorageKey,
} from '../vocabEncounters.js';
import { NPC_SCRIPTS } from '../npcScripts.js';

// 🈁 우리 사전 '만남' 기록(rfc-vocab-encounter §4.2) — npc-met와 같은 로컬 단독 계약을 검증한다.

function memoryStorage() {
  const values = new Map();
  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value)),
    values,
  };
}

describe('언어 키(vocab-encounters:<lang>)', () => {
  it('언어 코드는 소문자 2자만 허용한다', () => {
    expect(['ja', 'fr', 'zh', 'en'].every(isEncounterLang)).toBe(true);
    expect(isEncounterLang('JA')).toBe(false);
    expect(isEncounterLang('jpn')).toBe(false);
    expect(isEncounterLang('')).toBe(false);
    expect(isEncounterLang(null)).toBe(false);
  });

  it('키는 storageSchema 정본 prefix를 쓴다', () => {
    expect(vocabEncounterStorageKey('ja')).toBe('vocab-encounters:ja');
  });
});

describe('로드·저장 견고성(storage-schema 규약)', () => {
  it('정렬된 중복 없는 문자열 배열로 왕복한다', () => {
    const storage = memoryStorage();
    expect(saveVocabEncounters('ja', new Set(['替え玉', '食券', '']), storage)).toBe(true);
    expect(storage.values.get('vocab-encounters:ja')).toBe(JSON.stringify(['替え玉', '食券'].sort()));
    expect([...loadVocabEncounters('ja', storage)].sort()).toEqual(['替え玉', '食券'].sort());
  });

  it('깨진 JSON·비배열·저장소 부재는 빈 Set·false로 닫는다', () => {
    const storage = memoryStorage();
    storage.values.set('vocab-encounters:ja', '{broken');
    expect(loadVocabEncounters('ja', storage).size).toBe(0);
    storage.values.set('vocab-encounters:ja', JSON.stringify({ not: 'array' }));
    expect(loadVocabEncounters('ja', storage).size).toBe(0);
    expect(loadVocabEncounters('ja', null).size).toBe(0);
    expect(saveVocabEncounters('ja', new Set(['食券']), null)).toBe(false);
    expect(saveVocabEncounters('bad-lang', new Set(['食券']), storage)).toBe(false);
  });

  it('비문자열 항목은 로드·저장 양쪽에서 걸러진다', () => {
    const storage = memoryStorage();
    storage.values.set('vocab-encounters:ja', JSON.stringify(['食券', 7, null, '']));
    expect([...loadVocabEncounters('ja', storage)]).toEqual(['食券']);
  });
});

describe('recordVocabEncounters — 합집합·멱등', () => {
  it('새 표기를 합치고, 전부 이미 있으면 재저장하지 않는다', () => {
    const storage = memoryStorage();
    expect(recordVocabEncounters('ja', ['食券', 'どうぞ'], storage)).toBe(true);
    expect(recordVocabEncounters('ja', ['替え玉'], storage)).toBe(true);
    expect([...loadVocabEncounters('ja', storage)].sort())
      .toEqual(['どうぞ', '替え玉', '食券'].sort());

    const writes = storage.setItem.mock.calls.length;
    expect(recordVocabEncounters('ja', ['食券', '替え玉'], storage)).toBe(true); // 멱등
    expect(storage.setItem.mock.calls.length).toBe(writes);                      // 재저장 없음
  });

  it('빈 배열·비문자열만 있는 입력은 조용히 성공(no-op)한다', () => {
    const storage = memoryStorage();
    expect(recordVocabEncounters('ja', [], storage)).toBe(true);
    expect(recordVocabEncounters('ja', [7, null, ''], storage)).toBe(true);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('언어 코드가 다르면 서로 다른 키에 격리된다', () => {
    const storage = memoryStorage();
    recordVocabEncounters('ja', ['食券'], storage);
    recordVocabEncounters('fr', ['bonjour'], storage);
    expect([...loadVocabEncounters('ja', storage)]).toEqual(['食券']);
    expect([...loadVocabEncounters('fr', storage)]).toEqual(['bonjour']);
  });
});

describe('스텝·스크립트 refs 추출(완주 요약 카드가 소비)', () => {
  it('stepEncounterRefs = refs ∪ answerRefs (중복 제거, 없으면 빈 배열)', () => {
    expect(stepEncounterRefs({ refs: ['食券'], answerRefs: ['お願いします', '食券'] }))
      .toEqual(['食券', 'お願いします']);
    expect(stepEncounterRefs({ t: 'say' })).toEqual([]);
    expect(stepEncounterRefs(null)).toEqual([]);
  });

  it('scriptEncounterRefs는 첫 노출 순서를 보존한 합집합이다 — 라멘 실저작 기준', () => {
    const refs = scriptEncounterRefs(NPC_SCRIPTS.ramen);
    expect(refs[0]).toBe('食券');                       // 첫 대사에서 처음 만난다
    expect(refs).toContain('替え玉');
    expect(refs).toContain('お願いします');
    expect(new Set(refs).size).toBe(refs.length);       // 중복 없음
  });
});

// 🈁 출처 문맥(rfc-adaptive-quiz R3) — 첫 만남 문장만, 이후 만남은 덮지 않는다.
describe('출처 문맥 — recordVocabEncounters 4번째 인자·loadVocabEncounterContexts', () => {
  it('처음 만난 표기에만 문맥이 남고, 재만남은 덮지 않는다(첫 만남 불변)', () => {
    const storage = memoryStorage();
    recordVocabEncounters('ja', ['食券'], storage, { text: 'まずは 食券を どうぞ。', source: 'npc' });
    recordVocabEncounters('ja', ['食券', '替え玉'], storage, { text: '替え玉、おねがいします。', source: 'viewer' });
    const ctx = loadVocabEncounterContexts('ja', storage);
    expect(ctx['食券']).toEqual({ t: 'まずは 食券を どうぞ。', s: 'npc' });      // 첫 문장 유지
    expect(ctx['替え玉']).toEqual({ t: '替え玉、おねがいします。', s: 'viewer' }); // 새 표기만
  });

  it('문맥 없는 기록은 기존 동작 그대로(하위 호환), 200자 상한·source 생략 허용', () => {
    const storage = memoryStorage();
    recordVocabEncounters('ja', ['どうぞ'], storage);
    expect(loadVocabEncounterContexts('ja', storage)).toEqual({});
    recordVocabEncounters('ja', ['屋台'], storage, { text: `${'あ'.repeat(300)}屋台` });
    const ctx = loadVocabEncounterContexts('ja', storage);
    expect(ctx['屋台'].t).toHaveLength(200);
    expect(ctx['屋台'].s).toBeUndefined();
  });

  it('깨진 문맥 값은 빈 맵으로 안전 복구', () => {
    const storage = memoryStorage({ [vocabEncounterContextStorageKey('ja')]: '{broken' });
    expect(loadVocabEncounterContexts('ja', storage)).toEqual({});
  });
});

describe('stepEncounterContext — say 대사·ask 정답 선택지', () => {
  it('say는 원문(ja), ask는 correct 선택지 원문, 없으면 null', () => {
    expect(stepEncounterContext({ t: 'say', ja: 'いらっしゃい！' })).toBe('いらっしゃい！');
    expect(stepEncounterContext({
      t: 'ask',
      choices: [{ ja: 'さようなら。' }, { ja: 'おねがいします。', correct: true }],
    })).toBe('おねがいします。');
    expect(stepEncounterContext({ t: 'narr', text: '해설' })).toBeNull();
    expect(stepEncounterContext(null)).toBeNull();
  });
});
