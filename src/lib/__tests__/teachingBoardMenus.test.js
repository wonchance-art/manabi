import {afterEach,describe,it,expect,vi} from 'vitest';
import {readBoardWorkspace,writeBoardWorkspace} from '../teachingWorkspace';

afterEach(()=>vi.unstubAllGlobals());
describe('immersive teaching workspace preferences',()=>{
  it('starts a new immersive workspace with the whole board while preserving older callers',()=>{
    vi.stubGlobal('sessionStorage',{getItem:()=>null});
    expect(readBoardWorkspace('new','board')).toEqual({layout:'board',ratio:60,input:'',reading:'',meaning:''});
    expect(readBoardWorkspace('old').layout).toBe('split');
  });
  it('retains an existing split preference and input when immersive controls replace the toolbar',()=>{
    const values=new Map();vi.stubGlobal('sessionStorage',{getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)});
    writeBoardWorkspace('same',{layout:'split',ratio:68,input:'书店',reading:'shū diàn',meaning:'서점'});
    expect(readBoardWorkspace('same','board')).toEqual({layout:'split',ratio:68,input:'书店',reading:'shū diàn',meaning:'서점'});
    expect(readBoardWorkspace('another','board').input).toBe('');
  });
  it('falls back safely without overwriting a stored board when preferences are unavailable',()=>{
    vi.stubGlobal('sessionStorage',{getItem:()=>{throw Error('unavailable');}});
    expect(readBoardWorkspace('same','board').layout).toBe('board');
    vi.stubGlobal('sessionStorage',{getItem:()=>'{broken'});
    expect(readBoardWorkspace('same','board').layout).toBe('board');
  });
});
