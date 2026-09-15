import {describe,it,expect} from 'vitest';
import {lookupInput,lookupSenses,parseLookupAnswer,lookupSourceLabel} from '../classroomLookup';
describe('classroom lookup data boundaries',()=>{
 it('keeps the teacher language and full phrase',()=>{expect(lookupInput({language:'French',text:' prendre soin '})).toMatchObject({language:'French',text:'prendre soin'});});
 it('accepts only bounded meaningful senses',()=>{expect(lookupSenses([null,{},false,'', {meaning:' 공부하다 ',pos:23}])).toEqual([{meaning:'공부하다',pos:'',example:''}]);expect(()=>parseLookupAnswer('{}')).toThrow();});
 it('does not relabel AI cache as a verified dictionary',()=>{expect(lookupSourceLabel('gemini')).toContain('AI');expect(lookupSourceLabel('user_verified')).toContain('사용자');});
});
