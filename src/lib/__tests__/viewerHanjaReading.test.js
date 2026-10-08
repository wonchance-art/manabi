import {describe,it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import HunCell from '../../components/viewer/HunCell';
import {hunRubyCells} from '../viewerHunRuby';

// AE-R1 개정(VIEWER-V2-ROUNDS-001 §2.1 「별도 훈음 목록(ViewerHanjaReading)은 없앤다 — 훈음은 한자 아래 루비」,
// §10 「viewerHanjaReading: 훈음 목록 → 루비」, 설계서 §7.1): 목록 컴포넌트를 지우고 같은 네 성질을 루비 셀
// (hunRubyCells + HunCell)로 옮긴다 — 빈 표 0, 반복 글자·순서 보존, 음만 폴백·긴 풀이 보존, 마크업 이스케이프.
const render=cell=>renderToStaticMarkup(createElement(HunCell,{cell}));
describe('viewer Korean reading ruby cells',()=>{
 it('leaves no empty cell when labels are unavailable or disabled',()=>{
  for(const cell of [null,undefined,{ch:'X',label:null,lines:[]}])expect(render(cell)).toBe('');
  expect(hunRubyCells('老师',null)).toBeNull();
  expect(hunRubyCells('XY',{koTable:{},hunTable:{}})).toBeNull();
 });
 it('preserves original order, repeated characters, full labels and dueum',()=>{
  const cells=hunRubyCells('老老师',{koTable:{老:'로',师:'사'},hunTable:{老:'늙을',师:'스승'}});
  expect(cells.map(c=>c.ch)).toEqual(['老','老','师']);
  const html=cells.map(render).join('');
  expect(html.match(/data-label="늙을 로\(노\)"/g)).toHaveLength(2);
  expect(html.indexOf('늙을')).toBeLessThan(html.indexOf('스승 사'));
  expect(html).toContain('data-label="스승 사"');
 });
 it('keeps a long explanation and sound-only fallback without inventing missing labels',()=>{
  const long='쇠뇌(여러 개의 화살이나 돌을 잇따라 쏘게 된 큰 활)';
  const cells=hunRubyCells('弩你🙂',{koTable:{弩:'노',你:'니'},hunTable:{弩:long}});
  expect(cells.map(c=>c.ch)).toEqual(['弩','你','🙂']);
  const html=cells.map(render).join('');
  expect(html).toContain(`data-label="${long} 노"`);
  expect(html).toContain(long);
  expect(html).toContain('data-label="니(이)"');
  expect(render(cells[2])).toBe('');
  expect(cells[0].wrap).toBe(true);
  expect(render(cells[0])).toContain('data-wrap="1"');
 });
 it('escapes labels instead of interpreting dictionary text as markup',()=>{
  const html=render({ch:'字',label:'<img src=x onerror=alert(1)>',lines:['<img src=x onerror=alert(1)>'],hunN:3,wrap:false});
  expect(html).toContain('&lt;img');expect(html).not.toContain('<img');
 });
});
