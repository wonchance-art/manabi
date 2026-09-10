import {describe,it,expect} from 'vitest';
import {makeTextbookAnchor,resolveTextbookAnchor,validTextbookAnchor} from './textbookAnnotations';
const json={sequence:['a','b','c','d','e'],dictionary:{a:{text:'私は'},b:{text:'学生'},c:{text:'です。彼も'},d:{text:'学生'},e:{text:'です。'}}};
describe('textbook annotations',()=>{
 it('anchors the selected occurrence including its context',()=>{const a=makeTextbookAnchor(json,'d');expect(resolveTextbookAnchor(json,a).first).toBe('d');expect(validTextbookAnchor(json,a)).toBe(true);});
 it('survives reanalysis token IDs without changing the original',()=>{const a=makeTextbookAnchor(json,'b');const next={sequence:['whole'],dictionary:{whole:{text:'私は学生です。彼も学生です。'}}};expect(resolveTextbookAnchor(next,a).first).toBe('whole');});
 it('does not guess when text or context no longer matches',()=>{const a=makeTextbookAnchor(json,'b');expect(resolveTextbookAnchor({...json,dictionary:{...json.dictionary,a:{text:'君は'}}},a)).toBe(null);});
 it('rejects repeated ambiguous text rather than trusting old offsets',()=>expect(resolveTextbookAnchor(json,{type:'TextQuoteSelector',exact:'学生',prefix:'',suffix:'',start:2,end:4})).toBe(null));
 it('validates range bounds and whitespace',()=>{expect(makeTextbookAnchor(json,'d','a')).toBe(null);expect(makeTextbookAnchor(json,'bad')).toBe(null);expect(makeTextbookAnchor(json,'b','d').exact).toBe('学生です。彼も学生');});
 it('handles non-BMP characters with browser offsets',()=>{const j={sequence:['x','y'],dictionary:{x:{text:'📚'},y:{text:'学生'}}};expect(validTextbookAnchor(j,makeTextbookAnchor(j,'y'))).toBe(true);});
});
