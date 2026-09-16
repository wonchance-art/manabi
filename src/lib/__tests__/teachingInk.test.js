import {describe,it,expect} from 'vitest';
import {inkRows,editInkRow,inkValues,planInkPlacement,inkResultKey} from '../teachingInk';

describe('handwriting candidates on the teacher board',()=>{
  it('preserves the literal reading and requires explicit meaning/selection before placement',()=>{
    const [row]=inkRows([{original:'はし',reading:'はし',choices:[{text:'箸',meaning:'젓가락'}]}]);
    expect(row).toMatchObject({text:'はし',meaning:'',selected:false,placed:false});
    expect(inkValues([row],'Japanese')).toEqual([]);
    const chosen=editInkRow(row,{text:'箸',meaning:'젓가락',selected:true});
    expect(inkValues([chosen],'Japanese')[0]).toMatchObject({text:'箸',reading:'はし',meaning:'젓가락',source:{kind:'manual'}});
    expect(editInkRow(chosen,{meaning:'  '}).selected).toBe(false);
    expect(inkValues([{...chosen,placed:true}],'Japanese')).toEqual([]);
  });
  it('omits readings for English/French and scopes duplicate keys to the actual selected page',()=>{
    const row={index:0,text:'word',meaning:'단어',reading:'reading',selected:true};
    expect(inkValues([row],'French')[0].reading).toBe('');
    expect(inkResultKey({pageId:'p1',fingerprint:'f'},0)).not.toBe(inkResultKey({pageId:'p2',fingerprint:'f'},0));
  });
  it('fits multiple words in visible free space without moving original ink',()=>{
    const ink={x:28,y:108,width:310,height:160},before=structuredClone(ink);
    const positions=planInkPlacement([ink],{width:1400,height:900,scrollX:0,scrollY:0,zoom:{value:1}},[{width:300,height:180},{width:300,height:180}],{panelWidth:400});
    expect(positions).toHaveLength(2);expect(positions[0]).not.toEqual({x:28,y:108});expect(positions[1]).not.toEqual(positions[0]);expect(ink).toEqual(before);
  });
  it('requests a separate new page instead of silently placing below the visible paper',()=>{
    const state={width:390,height:700,scrollX:0,scrollY:0,zoom:{value:1}};
    const ink={x:0,y:0,width:390,height:700},sizes=[{width:300,height:200},{width:300,height:200}];
    expect(planInkPlacement([ink],state,sizes)).toBeNull();
    expect(planInkPlacement([ink],state,sizes,{fresh:true})).toHaveLength(2);
    expect(planInkPlacement([],{...state,zoom:{value:2}},[{width:300,height:200}])).toBeNull();
  });
});
