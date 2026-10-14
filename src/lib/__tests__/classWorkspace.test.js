import {describe, expect, it} from 'vitest';
import fs from 'node:fs';
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

// 오너 결정 2026-10-13: 만들 때는 기본만, 교재·전체 과 수·코스는 수업 안 설정에서.
describe('전체 과 수 — 수업 안 설정에서 고친다',()=>{
  const form={...team,bookTotal:'20'};
  it('적은 값을 저장하고, 비우면 지우고, 그대로면 건드리지 않는다',()=>{
    expect(classSettingsPatch(team,{...form,bookTotal:'41'},[])).toEqual({name:'수업',lang:'Chinese',bookKey:'book',bookTotal:41});
    expect(classSettingsPatch(team,{...form,bookTotal:''},[])).toMatchObject({bookTotal:null});
    expect(classSettingsPatch(team,form,[])).not.toHaveProperty('bookTotal');
    expect(()=>classSettingsPatch(team,{...form,bookTotal:'0'},[])).toThrow('전체 과 수');
    expect(()=>classSettingsPatch(team,{...form,bookTotal:'4.5'},[])).toThrow('전체 과 수');
  });
  it('교재를 바꾸면 손대지 않은 값은 공유 과 수로, 적은 값은 그대로 — 교재를 빼면 지운다',()=>{
    expect(classSettingsPatch(team,{...form,bookKey:'next'},[{key:'next',count:8}])).toMatchObject({chapterId:null,bookTotal:8});
    expect(classSettingsPatch(team,{...form,bookKey:'next',bookTotal:'41'},[{key:'next',count:8}])).toMatchObject({bookTotal:41});
    expect(classSettingsPatch(team,{...form,bookKey:''},[])).toMatchObject({bookKey:null,bookTotal:null});
  });
  it('입력칸 문자열과 저장된 숫자를 같은 값으로 보고, 다른 창의 변경과 겹치면 막는다',()=>{
    expect(rebaseClassSettings(team,{...team,bookTotal:30},form)).toMatchObject({bookTotal:'30'});
    expect(()=>rebaseClassSettings(team,{...team,bookTotal:30},{...form,bookTotal:'41'})).toThrow();
  });
});

describe('수업 만들기는 기본만 — 화면 계약',()=>{
  const read=(p)=>fs.readFileSync(p,'utf8');
  const hub=read('src/views/ClassHubPage.jsx');
  it('허브 생성 폼에는 교재·과 수·코스 입력이 없고, 수업 안 설정으로 보낸다',()=>{
    for(const gone of ['team-book','team-total','team-course','courseOptions','bookTotal','handleEditSave'])expect(hub,gone).not.toContain(gone);
    for(const id of ['team-name','team-lang','team-key','team-pw'])expect(hub).toContain(`id="${id}"`);
    expect(hub).toContain('`/class/${revealed.key}?settings=1`');
    expect(hub).toContain('`/class/${t.key}?settings=1`');
  });
  it('수업 안 설정이 교재·전체 과 수·코스를 모두 가진다 · ?settings=1이면 열린 채 시작',()=>{
    const settings=read('src/components/classroom/ClassTeamSettings.jsx');
    for(const label of ['수업 교재','전체 과 수','수업 코스','입장 암호 변경'])expect(settings).toContain(label);
    expect(read('src/views/ClassTeamPage.jsx')).toContain("routeSearch.get('settings')==='1'");
  });
});
