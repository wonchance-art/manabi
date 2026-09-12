import {describe, expect, it} from 'vitest';
import {canTeachClass, classDay, classWorkspaceHref, classSettingsPatch, startingChapter,rebaseClassSettings} from '../classWorkspace';

const teacher = {id: 'teacher'};
const team = {root:true,key:'lesson',name:'수업',lang:'Chinese',bookKey:'book',chapterId:'4',bookTotal:20};
const root = {id:1, owner_id:teacher.id, processed_json:{metadata:{team}}};
const book = {id:4,owner_id:teacher.id,processed_json:{metadata:{book:{key:'book'}}}};

describe('classroom ownership and context',()=>{
  it('allows the team owner and their attached source',()=>{
    expect(canTeachClass(teacher,root)).toBe(true);
    expect(canTeachClass(teacher,root,book)).toBe(true);
    expect(canTeachClass(teacher,root,root)).toBe(true);
  });
  it('never treats global admin, another owner or a student copy as this teacher',()=>{
    expect(canTeachClass({id:'student',role:'admin'},root,book)).toBe(false);
    expect(canTeachClass(teacher,root,{...book,owner_id:'student'})).toBe(false);
    expect(canTeachClass(teacher,root,{...book,processed_json:{metadata:{book:{key:'other'}}}})).toBe(false);
    expect(canTeachClass(null,root)).toBe(false);
  });
  it('does not accept a day note as a team root',()=>{
    expect(canTeachClass(teacher,{...root,processed_json:{metadata:{team:{...team,root:false}}}})).toBe(false);
  });
  it('validates dates and keeps a supplied lesson date',()=>{
    expect(classDay('2026-02-30','2026-09-12')).toBe('2026-09-12');
    expect(classDay('2026-09-10')).toBe('2026-09-10');
  });
  it('opens the shared viewer with explicit team context and returns to the team home',()=>{
    const url = new URL(classWorkspaceHref(4,'lesson','2026-09-10'),'https://example.test');
    expect(url.pathname).toBe('/viewer/4');
    expect(Object.fromEntries(url.searchParams)).toEqual({class:'lesson',day:'2026-09-10',returnTo:'/class/lesson'});
    expect(classWorkspaceHref(4,'//other')).toBeNull();
  });
  it('falls back to a real first chapter when the old selection has disappeared',()=>{
    const chapters=[{id:2},{id:4}];
    expect(startingChapter(team,chapters).id).toBe(4);
    expect(startingChapter({...team,chapterId:99},chapters).id).toBe(2);
    expect(startingChapter(team,[])).toBeNull();
  });
  it('preserves current chapter/count and resets them only when changing books',()=>{
    expect(classSettingsPatch(team,{...team,name:'  새 이름  '},[])).toEqual({name:'새 이름',lang:'Chinese',bookKey:'book'});
    expect(classSettingsPatch(team,{...team,bookKey:'next'},[{key:'next',count:8}])).toEqual({name:'수업',lang:'Chinese',bookKey:'next',chapterId:null,bookTotal:8});
    expect(()=>classSettingsPatch(team,{...team,bookKey:'other'},[])).toThrow();
  });
  it('keeps an updated chapter and untouched settings without overwriting a concurrent edit',()=>{
    const latest={...team,chapterId:'5',lang:'Japanese'};
    expect(rebaseClassSettings(team,latest,{...team,name:'새 이름'})).toMatchObject({name:'새 이름',lang:'Japanese'});
    expect(classSettingsPatch(latest,rebaseClassSettings(team,latest,{...team,name:'새 이름'}),[])).not.toHaveProperty('chapterId');
    expect(()=>rebaseClassSettings(team,{...latest,name:'다른 창'},{...team,name:'내 수정'})).toThrow();
  });
});
