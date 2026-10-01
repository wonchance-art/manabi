import {describe,it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ViewerHanjaReading from '../../components/viewer/ViewerHanjaReading';
import {listHanjaHunEum} from '../hanjaKo';

const render=items=>renderToStaticMarkup(createElement(ViewerHanjaReading,{items}));
describe('viewer Korean reading pairs',()=>{
 it('leaves no empty section when labels are unavailable or disabled',()=>{
  for(const items of [null,undefined,[]])expect(render(items)).toBe('');
 });
 it('preserves original order, repeated characters, full labels and dueum',()=>{
  const items=listHanjaHunEum('老老师',{老:'로',师:'사'},{老:'늙을',师:'스승'});
  const html=render(items);
  expect(html.match(/<dt lang="zh-Hans">老<\/dt>/g)).toHaveLength(2);
  expect(html).toContain('<dd>늙을 로(노)</dd>');
  expect(html.indexOf('老')).toBeLessThan(html.indexOf('师'));
  expect(html).toContain('<dd>스승 사</dd>');
 });
 it('keeps a long explanation and sound-only fallback without inventing missing labels',()=>{
  const long='쇠뇌(여러 개의 화살이나 돌을 잇따라 쏘게 된 큰 활)';
  const items=listHanjaHunEum('弩你🙂',{弩:'노',你:'니'},{弩:long});
  const html=render(items);
  expect(html).toContain(`${long} 노`);
  expect(html).toContain('<dt lang="zh-Hans">你</dt><dd>니(이)</dd>');
  expect(html).not.toContain('🙂');
  expect(html).not.toContain('ruby');
 });
 it('escapes labels instead of interpreting dictionary text as markup',()=>{
  const html=render([{ch:'字',label:'<img src=x onerror=alert(1)>'}]);
  expect(html).toContain('&lt;img');expect(html).not.toContain('<img');
 });
});
