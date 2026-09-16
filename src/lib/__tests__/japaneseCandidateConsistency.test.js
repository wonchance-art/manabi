import {describe,expect,it} from 'vitest';
import {japaneseReferenceForMeaning,viewerJapaneseGlyphTable} from '../viewerJapaneseReference';
import {toJaForm} from '../hanjaKo';
import generated from '../data/hanjaJa.json';
describe('local Japanese dictionary candidates',()=>{
 it('preserves audited shared Japanese glyphs without mutating the generated character data',()=>{
  const table=viewerJapaneseGlyphTable(generated);
  expect(toJaForm('出神 表达 大家',table)).toBe('出神 表達 大家');
  expect(toJaForm('老师 图书馆',table)).toBe('老師 図書館');
  expect(generated.出).toBe('齣');
  expect(table).not.toBe(generated);
  expect(viewerJapaneseGlyphTable(null)).toBeNull();
 });
 it('holds contradictory different-meaning metadata rather than treating identical glyphs as proof',()=>{
  const entry={meanings:[{meaning:'아끼다',ja:{form:'愛惜',diff:true}}]};
  expect(japaneseReferenceForMeaning(entry,'아끼다',{form:'愛惜',pos:'동사'})).toBeNull();
 });
 it('keeps an explicitly different Japanese equivalent',()=>{
  expect(japaneseReferenceForMeaning({meanings:[{meaning:'주최국',ja:{form:'ホスト国',diff:true}}]},'주최국',{form:'東道主'})).toEqual({form:'ホスト国',warn:null});
 });
 it('rejects an explicit sense-level part-of-speech mismatch, without guessing missing metadata',()=>{
  const entry={meanings:[{meaning:'뜻',pos:'명사',ja:{form:'意味'}}]};
  expect(japaneseReferenceForMeaning(entry,'뜻',{pos:'대명사'})).toBeNull();
  expect(japaneseReferenceForMeaning(entry,'뜻')).toEqual({form:'意味',warn:null});
 });
 it('accepts overlapping compound parts of speech and equivalent preposition labels',()=>{
  const entry={meanings:[{meaning:'일',pos:'동사·명사',ja:{form:'仕事'}}]};
  expect(japaneseReferenceForMeaning(entry,'일',{pos:'명사'})?.form).toBe('仕事');
  expect(japaneseReferenceForMeaning({meanings:[{meaning:'~로서',pos:'전치사',ja:{form:'として'}}]},'~로서',{pos:'개사'})?.form).toBe('として');
 });
});
