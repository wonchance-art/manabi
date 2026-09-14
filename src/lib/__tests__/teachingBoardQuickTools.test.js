import {describe,it,expect} from 'vitest';
import {quickBoardToolAction} from '../teachingBoardTools';

describe('quick classroom tools',()=>{
  it.each(['selection','freedraw','eraser'])('selects %s directly without opening settings or interrupting a draft',tool=>{
    expect(quickBoardToolAction(tool,{activeTool:'text',layout:'split',menu:'entry'})).toBe('select');
  });
  it('opens and closes settings only when the teacher repeats the active tool',()=>{
    expect(quickBoardToolAction('freedraw',{activeTool:'freedraw',layout:'board',menu:null})).toBe('settings');
    expect(quickBoardToolAction('freedraw',{activeTool:'freedraw',layout:'board',menu:'tools'})).toBe('close');
  });
  it('returns to a usable canvas on the first tap from the textbook, even for the active tool',()=>{
    expect(quickBoardToolAction('selection',{activeTool:'selection',layout:'reader',menu:'book'})).toBe('select');
  });
  it('keeps the quick toolbar limited to the supported drawing actions',()=>{
    expect(quickBoardToolAction('image',{activeTool:'selection',layout:'board',menu:null})).toBeNull();
  });
});
