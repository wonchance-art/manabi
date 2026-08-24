import { describe, expect, it } from 'vitest';
import { isMostlyKana, toRomaji } from '../kanaRomaji';

describe('toRomaji additional contracts', () => {
  it.each([
    ['あいうえお', 'aiueo'], ['かきくけこ', 'kakikukeko'], ['がぎぐげご', 'gagigugego'],
    ['さしすせそ', 'sashisuseso'], ['ざじずぜぞ', 'zajizuzezo'], ['たちつてと', 'tachitsuteto'],
    ['だぢづでど', 'dajizudedo'], ['なにぬねの', 'naninuneno'], ['はひふへほ', 'hahifuheho'],
    ['ばびぶべぼ', 'babibubebo'], ['ぱぴぷぺぽ', 'papipupepo'], ['まみむめも', 'mamimumemo'],
    ['やゆよ', 'yayuyo'], ['らりるれろ', 'rarirurero'], ['わをん', 'waon'],
    ['キャ', 'kya'], ['しゅ', 'shu'], ['ちょ', 'cho'], ['ぎゃ', 'gya'], ['ジョ', 'jo'],
    ['きって', 'kitte'], ['バッグ', 'baggu'], ['コーヒー', 'koohii'], ['スーパー', 'suupaa'],
    ['漢字かな。', 'kana'], ['', ''], [null, ''], ['っ', ''], ['ー', ''],
  ])('romanizes %j', (input, expected) => expect(toRomaji(input)).toBe(expected));
});

describe('isMostlyKana additional contracts', () => {
  it.each([
    ['', false], [null, false], ['   ', false], ['かな', true], ['カナ', true],
    ['かな漢', false], ['かなな漢', true], ['かな漢字', false], [' かな ', true], ['abc', false], ['かa', false],
  ])('classifies %j', (input, expected) => expect(isMostlyKana(input)).toBe(expected));
});
