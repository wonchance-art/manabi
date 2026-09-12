'use client';
import {useMemo,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {supabase} from '../../lib/supabase';
import {getTeam,patchTeamRoot,TEAM_PW_MIN} from '../../lib/classBoard';
import {fetchClassBookRows,fetchTeamRoot} from '../../lib/classTeamQueries';
import {listAppendableBooks} from '../../lib/bookAppend';
import {saveClassroomMetadata,classroomError} from '../../lib/classroomModel';
import {canTeachClass,classSettingsPatch,rebaseClassSettings} from '../../lib/classWorkspace';
import {hashPassword,makeSalt,validatePassword} from '../../lib/classPassword';
import {LANG_NAME_KO} from '../../lib/constants';

export default function ClassTeamSettings({root,user,onClose}) {
  if(!canTeachClass(user,root))return null;
  return <SettingsForm key={root.id} root={root} user={user} onClose={onClose}/>;
}

function SettingsForm({root,user,onClose}) {
  const team=getTeam(root.processed_json.metadata),client=useQueryClient();
  const [base,setBase]=useState(root);
  const [draft,setDraft]=useState({name:team.name,lang:team.lang,bookKey:team.bookKey||''});
  const [password,setPassword]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [conflict,setConflict]=useState(false);
  const query=useQuery({queryKey:['class-books',user.id],queryFn:()=>fetchClassBookRows(user.id)});
  const books=useMemo(()=>listAppendableBooks(query.data||[]),[query.data]);
  async function save(event) {
    event.preventDefault();if(busy||!canTeachClass(user,base))return;
    setBusy(true);setMessage('');setConflict(false);
    try{
      const fresh=await fetchTeamRoot(user.id,team.key);
      if(!canTeachClass(user,fresh))throw new Error('수업 편집 권한을 확인해 주세요.');
      const latest=getTeam(fresh.processed_json.metadata),previous=getTeam(base.processed_json.metadata);
      let patch=classSettingsPatch(latest,rebaseClassSettings(previous,latest,draft),books);
      if(password){const error=validatePassword(password,TEAM_PW_MIN);if(error)throw new Error(error);
        if(latest.pwGen!==previous.pwGen)throw Object.assign(new Error('입장 암호가 다른 창에서 바뀌었어요.'),{code:'40001'});
        const pwSalt=makeSalt();patch={...patch,pwSalt,pwHash:await hashPassword(password,pwSalt),pwGen:(latest.pwGen||0)+1};}
      const next=patchTeamRoot(fresh.processed_json,patch);
      const saved=await saveClassroomMetadata(supabase,fresh,next.metadata);
      setBase(saved);setDraft({name:patch.name,lang:patch.lang,bookKey:patch.bookKey||''});setPassword('');client.setQueryData(['class-root',user.id,team.key],saved);
      await client.invalidateQueries({queryKey:['class-teams',user.id]});
      setMessage('설정을 저장했어요.');
    }catch(error){setConflict(error?.code==='40001');setMessage(classroomError(error));}finally{setBusy(false);}
  }
  async function reloadSettings(){setBusy(true);try{const fresh=await fetchTeamRoot(user.id,team.key);if(!canTeachClass(user,fresh))throw new Error('수업 편집 권한을 확인해 주세요.');const next=getTeam(fresh.processed_json.metadata);setBase(fresh);setDraft({name:next.name,lang:next.lang,bookKey:next.bookKey||''});setPassword('');setConflict(false);setMessage('최신 설정을 불러왔어요. 변경할 내용을 다시 입력해 주세요.');}catch(error){setMessage(classroomError(error));}finally{setBusy(false);}}
  return <section className="class-team-settings" aria-label="이 수업 설정">
    <header><h2>수업 설정</h2><button className="classroom-text-button" onClick={onClose} disabled={busy}>닫기</button></header>
    <form onSubmit={save}>
      <label>팀 이름<input value={draft.name} maxLength={80} required onChange={e=>setDraft(v=>({...v,name:e.target.value}))}/></label>
      <label>언어<select value={draft.lang} onChange={e=>setDraft(v=>({...v,lang:e.target.value}))}>{Object.entries(LANG_NAME_KO).filter(([key])=>['Japanese','Chinese','English','French'].includes(key)).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      <label className="class-team-settings__wide">수업 교재<select value={draft.bookKey} disabled={query.isLoading||!!query.error} onChange={e=>setDraft(v=>({...v,bookKey:e.target.value}))}><option value="">교재 없이 수업</option>{team.bookKey&&!books.some(b=>b.key===team.bookKey)&&<option value={team.bookKey}>현재 연결된 교재</option>}{books.map(book=><option key={book.key} value={book.key}>{book.title||'제목 없는 교재'} · {book.count}과</option>)}</select></label>
      {query.error&&<p role="alert">교재 목록을 확인하지 못했어요. <button type="button" onClick={()=>query.refetch()}>다시 확인</button></p>}
      <details className="class-team-settings__wide"><summary>입장 암호 변경</summary><label>새 암호<input type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><p>저장하면 학생들이 새 암호로 다시 입장해야 합니다. 비워 두면 기존 암호를 유지합니다.</p></details>
      <footer className="class-team-settings__wide"><button className="classroom-button" disabled={busy}>{busy?'저장 중…':'설정 저장'}</button><p role="status">{message}</p></footer>
      {conflict&&<button type="button" disabled={busy} onClick={reloadSettings}>최신 설정으로 다시 열기</button>}
    </form>
  </section>;
}
