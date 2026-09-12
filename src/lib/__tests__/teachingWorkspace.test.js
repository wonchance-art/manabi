import {describe,it,expect,vi,afterEach} from 'vitest';
import {boardSearch,presentationElements,normalizeBoardWorkspace,readBoardWorkspace,writeBoardWorkspace} from '../teachingWorkspace';
import {classStudyContext,classStudyNeighborHref} from '../classStudy';
import {boardCameraForBounds} from '../teachingBoardViewport';

afterEach(()=>vi.unstubAllGlobals());
describe('continuous teaching workspace',()=>{
  it('keeps the board open on every neighboring chapter while preserving normal student routes',()=>{
    const context=classStudyContext(new URLSearchParams('class=my-class&day=2026-09-12&board=1'));
    const next=new URL(classStudyNeighborHref({id:12},context),'https://manabi.invalid');
    expect(classStudyContext(next.searchParams)).toEqual(context);
    expect(next.searchParams.get('board')).toBe('1');
    expect(classStudyNeighborHref({id:12,href:'/class/my-class?open=12'},context)).toBe('/class/my-class?open=12');
    expect(classStudyNeighborHref({id:12},null)).toBe('/viewer/12');
    expect(classStudyContext(new URLSearchParams('class=my-class&day=2026-09-12&board=untrusted'))).not.toHaveProperty('board');
  });
  it('bounds saved layout, split width and unfinished text independently of board data',()=>{
    const memory=new Map();vi.stubGlobal('sessionStorage',{getItem:key=>memory.get(key),setItem:(key,val)=>memory.set(key,val)});
    writeBoardWorkspace('teacher/class/day',{layout:'board',ratio:999,input:'書きかけ',meaning:'뜻'});
    expect(readBoardWorkspace('teacher/class/day')).toMatchObject({layout:'board',ratio:72,input:'書きかけ',meaning:'뜻'});
    expect(readBoardWorkspace('another/class/day').input).toBe('');
    expect(normalizeBoardWorkspace({layout:'unknown',ratio:NaN,input:'a'.repeat(600)})).toMatchObject({layout:'split',ratio:60,input:'a'.repeat(500)});
    vi.stubGlobal('sessionStorage',{getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');}});
    expect(readBoardWorkspace('a').layout).toBe('split');expect(()=>writeBoardWorkspace('a',{})).not.toThrow();
  });
  it('finds textbook, own vocabulary and recent explanations without dropping exact source references',()=>{
    const source={materialId:'12',quote:'学校',tokenId:'id_0'},entries=[{text:'学校生活',meaning:'학교 생활'},{text:'学校',reading:'がっこう',meaning:'학교',source},{text:'学校',reading:'がっこう',meaning:'학교'}];
    expect(boardSearch('学校',entries)).toHaveLength(2);
    expect(boardSearch('学校',entries)[0].source).toBe(source);
    expect(boardSearch('がっこう',entries)[0].text).toBe('学校');
    expect(boardSearch('',entries)).toEqual([]);
    expect(boardSearch('missing',entries)).toEqual([]);
  });
  it('creates a disposable presentation without modifying the original cards, strokes or opacity',()=>{
    const original=[{id:'title',type:'text',opacity:100,customData:{manabiField:'text'}},{id:'reading',type:'text',opacity:100,customData:{manabiField:'reading'}},{id:'meaning',type:'text',opacity:100,customData:{manabiField:'meaning'}},{id:'ink',type:'freedraw',opacity:100,points:[[0,0],[1,1]]}];
    const before=JSON.stringify(original),shown=presentationElements(original,{reading:false,meaning:false});
    expect(shown.map(e=>e.opacity)).toEqual([100,0,0,100]);
    expect(JSON.stringify(original)).toBe(before);
    expect(presentationElements(original).map(e=>e.opacity)).toEqual([100,100,100,100]);
  });
  it('enlarges a small teaching card for presentation without changing the normal edit zoom limit',()=>{
    const bounds=[28,108,348,316],camera={zoom:{value:.6}};
    expect(boardCameraForBounds(bounds,camera,{width:1200,height:700},{},true,2).zoom.value).toBe(2);
    expect(boardCameraForBounds(bounds,camera,{width:1200,height:700},{},true).zoom.value).toBe(1);
  });
});
