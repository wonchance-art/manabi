import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ slots: [], index: 0, effects: [], cleanups: [], profile: new Map(), writes: [], reads: [], listener: null, session: null, sessionDeferred: null, emitInitial: false, deferred: null, failLoads: 0 }));
vi.mock('react', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual,
    useState(initial) { const i=h.index++; if (!(i in h.slots)) h.slots[i]=initial; return [h.slots[i],value=>{h.slots[i]=typeof value==='function'?value(h.slots[i]):value;}]; },
    useRef(initial) { const i=h.index++; if (!(i in h.slots)) h.slots[i]={current:initial}; return h.slots[i]; },
    useEffect(fn,deps) { const i=h.index++; const previous=h.slots[i]; if (!previous || deps?.some((value,j)=>value!==previous[j])) {h.effects.push(fn);h.slots[i]=deps;} },
  };
});
vi.mock('../supabase', () => {
  const client = { from(table) {
    let actor,fields,kind='read',payload;
    const q={ select(value='*'){fields=value;return q;}, eq(key,value){actor=value;return q;},
      update(value){kind='update';payload=value;return q;},
      upsert(value){h.writes.push({kind:'upsert',table,payload:value}); for(const row of value) if(!h.profile.has(row.id))h.profile.set(row.id,{...row,streak_count:0,streak_freeze_count:0,last_streak_date:null});return Promise.resolve({error:null});},
      single(){h.reads.push({actor,fields});if(h.deferred&&fields==='*'){const value=h.deferred;h.deferred=null;return value;} const row=h.profile.get(actor);return Promise.resolve(row?{data:{...row},error:null}:{data:null,error:{code:'PGRST116'}});},
      then(resolve,reject){ if(kind==='update'){h.writes.push({kind,table,actor,payload});h.profile.set(actor,{...h.profile.get(actor),...payload});}return Promise.resolve({error:null}).then(resolve,reject);},
    };return q;
  }, auth:{getSession:vi.fn(async()=>h.sessionDeferred ?? ({data:{session:h.session}})),onAuthStateChange:vi.fn(fn=>{h.listener=fn;if(h.emitInitial)fn(typeof h.emitInitial==='string'?h.emitInitial:'INITIAL_SESSION',h.session);return{data:{subscription:{unsubscribe:vi.fn()}}};}),
    signInWithPassword:vi.fn(async()=>({data:{session:{user:{id:'A',user_metadata:{name:'A'}}}},error:null})),
    signOut:vi.fn(async()=>{h.listener?.('SIGNED_OUT',null);return{};}),
  }};
  return {supabase:client,getSupabase:vi.fn(async()=>{if(h.failLoads>0){h.failLoads-=1;throw new Error('chunk load failed');}return client;})};
});
vi.mock('../ToastContext',()=>({useToast:()=>vi.fn()}));
vi.mock('../refProgress',()=>({pullProgress:vi.fn(async()=>{})}));
vi.mock('../drillSrs',()=>({migrateGuestDrillQueue:vi.fn(async()=>{})}));
import { AuthProvider } from '../AuthContext';

const user=id=>({id,user_metadata:{name:id}});
const row=id=>({id,display_name:id,streak_count:6,streak_freeze_count:2,last_streak_date:'2026-10-01',last_login_at:'2026-09-01T00:00:00Z'});
function render(){h.index=0;return AuthProvider({children:null}).props.value;}
async function effects(){for(const fn of h.effects.splice(0)){const cleanup=fn();if(cleanup)h.cleanups.push(cleanup);}await tick();}
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
async function mount(){render();await effects();return render();}

beforeEach(()=>{h.failLoads=0;h.slots=[];h.index=0;h.effects=[];h.cleanups=[];h.profile=new Map([['A',row('A')],['B',row('B')]]);h.writes=[];h.reads=[];h.listener=null;h.session={user:user('A')};h.sessionDeferred=null;h.emitInitial=false;h.deferred=null;
 vi.stubGlobal('document',{cookie:'sb-test-auth-token=x'});
 vi.stubGlobal('window',{addEventListener:vi.fn(),removeEventListener:vi.fn(),location:{origin:'http://fixture',pathname:'/home',search:''}});
});
afterEach(()=>{for(const fn of h.cleanups)fn();vi.unstubAllGlobals();});

// PROFILE-READ-SHARE-001 — 페이지 로드의 세션 경로(getSession · INITIAL_SESSION/SIGNED_IN 알림)는 같은 계정의 진행 중 읽기를 공유한다.
// 쓰기 뒤 재읽기(refreshProfileReadOnly · fetchProfile)는 공유하지 않는다. 경쟁 순서 표 = profileReadShare.test.js 머리말.
const fullReads=()=>h.reads.filter(r=>r.fields==='*').length;
describe('PROFILE-READ-SHARE-001 — 로그인 상태 페이지 로드당 profiles 읽기 1회',()=>{
 it('알림 먼저(INITIAL_SESSION이 세션 확인보다 먼저): 세션 확인은 진행 중 읽기에 합류 — 읽기 1 · 프로필 적용',async()=>{let resolve;h.deferred=new Promise(r=>{resolve=r;});h.emitInitial=true;await mount();await tick();expect(fullReads()).toBe(1);resolve({data:row('A'),error:null});await tick();expect(render().profile).toEqual(row('A'));expect(fullReads()).toBe(1);expect(h.writes).toEqual([]);});
 it('세션 확인 먼저: 뒤에 온 INITIAL_SESSION 알림이 진행 중 읽기에 합류 — 읽기 1',async()=>{let resolve;h.deferred=new Promise(r=>{resolve=r;});await mount();expect(fullReads()).toBe(1);await h.listener('INITIAL_SESSION',{user:user('A')});await tick();expect(fullReads()).toBe(1);resolve({data:row('A'),error:null});await tick();expect(render().profile).toEqual(row('A'));});
 it('쓰기 중: 세션 읽기 진행 중의 쓰기 뒤 재읽기는 새로 읽고, 늦게 온 옛 읽기는 덮지 못한다',async()=>{let resolve;h.deferred=new Promise(r=>{resolve=r;});const auth=await mount();h.profile.set('A',{...row('A'),streak_count:7});await auth.refreshProfileReadOnly('A');expect(fullReads()).toBe(2);resolve({data:row('A'),error:null});await tick();expect(render().profile.streak_count).toBe(7);});
 it('로그아웃 중: 진행 중 세션 읽기는 로그아웃 뒤 프로필을 되살리지 못한다',async()=>{let resolve;h.deferred=new Promise(r=>{resolve=r;});const auth=await mount();await auth.signOut();resolve({data:row('A'),error:null});await tick();expect(render().profile).toBeNull();expect(render().user).toBeNull();});
 it('배선: 세션 경로 둘(getSession · 인증 알림)만 공유 읽기, 밖에서 부르는 재읽기(refreshProfileReadOnly = fetchProfile)는 공유하지 않는다',async()=>{const fs=await import('node:fs');const src=fs.readFileSync(new URL('../AuthContext.jsx',import.meta.url),'utf8').split('\n').filter(l=>!l.trim().startsWith('//')).join('\n');expect(src.match(/readSessionProfile\(session\.user\.id\)/g)).toHaveLength(2);expect(src).toContain('async function refreshProfileReadOnly(userId) { return readProfile(userId); }');expect(src).toContain('function readSessionProfile(userId) { return readProfile(userId, { share: true }); }');expect(src).toContain('const fetchProfile = refreshProfileReadOnly;');expect(src.match(/share: true/g)).toHaveLength(1);});
 it('계정 전환 중: 옛 계정 읽기 진행 중의 새 계정 알림은 합류하지 않고 새로 읽는다',async()=>{let resolve;h.deferred=new Promise(r=>{resolve=r;});await mount();await h.listener('TOKEN_REFRESHED',{user:user('B')});await tick();expect(fullReads()).toBe(2);resolve({data:{...row('A'),streak_count:999},error:null});await tick();expect(render().user.id).toBe('B');expect(render().profile).toEqual(row('B'));});
});

// ACTIVITY-PROFILE-READ-001 — 활동 뒤 재읽기는 지금 프로필이 오늘(UTC)을 센 뒤면 보내지 않는다(근거 = activityProfileRead.test.js).
describe('ACTIVITY-PROFILE-READ-001 — 활동 뒤 재읽기',()=>{
 const today=()=>new Date().toISOString().slice(0,10);
 beforeEach(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-26T03:00:00Z'));});
 afterEach(()=>{vi.useRealTimers();});
 it('오늘을 아직 안 셌으면 읽고, 읽은 프로필이 오늘을 셌으면 다음 활동부터 읽지 않는다',async()=>{const auth=await mount();const base=fullReads();h.profile.set('A',{...row('A'),streak_count:7,last_streak_date:today()});await auth.refreshProfileAfterActivity('A');expect(fullReads()).toBe(base+1);expect(render().profile.streak_count).toBe(7);const again=await render().refreshProfileAfterActivity('A');expect(fullReads()).toBe(base+1);expect(again.streak_count).toBe(7);await render().fetchProfile('A');expect(fullReads()).toBe(base+2);expect(h.writes).toEqual([]);});
 it('다른 계정 · UTC 자정 가드 안이면 건너뛰지 않는다',async()=>{h.profile.set('A',{...row('A'),last_streak_date:today()});const auth=await mount();const base=fullReads();await auth.refreshProfileAfterActivity('B');expect(fullReads()).toBe(base);vi.setSystemTime(new Date('2026-10-26T23:50:00Z'));await render().refreshProfileAfterActivity('A');expect(fullReads()).toBe(base+1);});
});

describe('AuthProvider profile reads never manufacture learning activity',()=>{
 it('initial session and repeated fetchProfile only SELECT despite old login date',async()=>{let auth=await mount();expect(auth.user.id).toBe('A');expect(auth.profile).toEqual(row('A'));expect(h.writes).toEqual([]);expect(auth.fetchProfile).toBe(auth.refreshProfileReadOnly);await auth.fetchProfile('A');await auth.refreshProfileReadOnly('A');expect(h.writes).toEqual([]);expect(render().profile.streak_count).toBe(6);});
 it('missing profile on refresh is not created and foreign-owner refresh does nothing',async()=>{const auth=await mount();h.profile.delete('A');await auth.refreshProfileReadOnly('A');expect(render().profile).toBeNull();const reads=h.reads.length;await auth.fetchProfile('B');expect(h.reads.length).toBe(reads);expect(h.writes).toEqual([]);});
 it('SDK cookie recovery SIGNED_IN before getSession resolution is passive even for the first actor',async()=>{h.emitInitial='SIGNED_IN';await mount();await tick();expect(render().user.id).toBe('A');expect(render().profile).toEqual(row('A'));expect(h.writes).toEqual([]);});
 it('a delayed SDK SIGNED_IN for a new restored actor never proves an explicit login',async()=>{await mount();await h.listener('SIGNED_IN',{user:user('B')});await tick();expect(render().user.id).toBe('B');expect(render().profile).toEqual(row('B'));expect(h.writes).toEqual([]);});
 it('actual login writes last_login only and preserves streak/freeze',async()=>{vi.stubGlobal('document',{cookie:''});h.session=null;const auth=await mount();await auth.signIn('fixture','unused');const mutations=h.writes.filter(w=>w.kind==='update');expect(mutations).toHaveLength(1);expect(Object.keys(mutations[0].payload)).toEqual(['last_login_at']);expect(h.profile.get('A').streak_count).toBe(6);expect(h.profile.get('A').streak_freeze_count).toBe(2);expect(h.writes.some(w=>w.kind==='upsert')).toBe(false);});
 it('login-only missing profile fallback omits streak and freeze, preserving DB defaults',async()=>{vi.stubGlobal('document',{cookie:''});h.session=null;h.profile.delete('A');const auth=await mount();await auth.signIn('fixture','unused');const create=h.writes.find(w=>w.kind==='upsert');expect(create.payload).toEqual([{id:'A',display_name:'A'}]);expect(h.profile.get('A').streak_count).toBe(0);});
 it('token refresh and a late old-account profile response cannot alter the new account',async()=>{const auth=await mount();let resolve;h.deferred=new Promise(r=>{resolve=r;});const pending=auth.refreshProfileReadOnly('A');await h.listener('TOKEN_REFRESHED',{user:user('B')});await tick();resolve({data:{...row('A'),streak_count:999},error:null});await pending;const current=render();expect(current.user.id).toBe('B');expect(current.profile).toEqual(row('B'));expect(h.writes).toEqual([]);});
 it('an auth event winning the initial session race ends loading and cannot be overwritten by old getSession',async()=>{let resolve;h.sessionDeferred=new Promise(r=>{resolve=r;});h.emitInitial=true;await mount();expect(render().loading).toBe(false);await h.listener('TOKEN_REFRESHED',{user:user('B')});await tick();resolve({data:{session:{user:user('A')}}});await tick();expect(render().user.id).toBe('B');expect(render().profile.id).toBe('B');expect(render().loading).toBe(false);expect(h.writes).toEqual([]);});
 it('repeated SIGNED_IN notification for the current actor is still a read, not another login mutation',async()=>{await mount();await h.listener('SIGNED_IN',{user:user('A')});await tick();expect(h.writes).toEqual([]);});
 it('sign-out invalidates an in-flight profile refresh before it can repopulate profile',async()=>{const auth=await mount();let resolve;h.deferred=new Promise(r=>{resolve=r;});const pending=auth.refreshProfileReadOnly('A');await auth.signOut();resolve({data:row('A'),error:null});await pending;expect(render().profile).toBeNull();expect(render().user).toBeNull();expect(h.writes).toEqual([]);});

 // 병합 전 교차 리뷰 S1: SDK 조각을 못 받아 다시 해 볼 차례가 남은 동안은 「확인 중」(loading) — user=null을 로그아웃으로 내보내지 않는다.
 it('SDK load retries keep loading true until the cap, then settle signed-out; a successful retry restores the account without a guest flash',async()=>{
  vi.useFakeTimers();
  try{
   h.failLoads=4; // 첫 시도 + 2 · 8 · 30초 재시도 모두 실패
   await mount();
   const seen=[render().loading];
   for(const ms of [2000,8000,30000]){await vi.advanceTimersByTimeAsync(ms);await effects();seen.push(render().loading);}
   expect(seen).toEqual([true,true,true,false]); // 차례를 다 쓴 뒤에만 확정
   expect(render().user).toBeNull();
   for(const fn of h.cleanups.splice(0))fn();
   h.slots=[];h.index=0;h.effects=[];
   h.failLoads=1; // 첫 시도만 실패 — 2초 뒤 재시도로 복원
   await mount();
   expect(render()).toMatchObject({loading:true,user:null});
   await vi.advanceTimersByTimeAsync(2000);await effects();
   expect(render().loading).toBe(false);
   expect(render().user.id).toBe('A');
  }finally{vi.useRealTimers();}
 });
});

// JS-CRIT-001(2026-10-25 KST) — 드릴 모듈(FSRS · 문형 큐 · 드릴 표)은 루트 첫 JS에서 빼고 로그인 뒤 동적 import로 받는다.
// 이관이 실제로 계정당 한 번 일어나는지, 손님은 받지도 부르지도 않는지 계약으로 둔다.
describe('JS-CRIT-001 — 손님 드릴 큐 이관은 로그인 뒤 한 번(동적 import)',()=>{
 it('세션 계정 확정 뒤 한 번 — 같은 계정 재렌더에는 다시 부르지 않는다',async()=>{
  const { migrateGuestDrillQueue } = await import('../drillSrs');
  migrateGuestDrillQueue.mockClear();
  await mount();await tick();
  for(let i=0;i<3;i++){render();await effects();}
  await vi.waitFor(()=>expect(migrateGuestDrillQueue).toHaveBeenCalledTimes(1));
  expect(migrateGuestDrillQueue).toHaveBeenCalledWith('A');
  render();await effects();await tick();
  expect(migrateGuestDrillQueue).toHaveBeenCalledTimes(1);
 });
 it('손님(세션 쿠키 없음)은 부르지 않는다',async()=>{
  const { migrateGuestDrillQueue } = await import('../drillSrs');
  migrateGuestDrillQueue.mockClear();
  vi.stubGlobal('document',{cookie:'',readyState:'complete'});
  await mount();await tick();
  for(let i=0;i<3;i++){render();await effects();}
  await tick();
  expect(migrateGuestDrillQueue).not.toHaveBeenCalled();
 });
 it('AuthContext는 drillSrs를 정적으로 부르지 않는다(루트 첫 JS 밖)',async()=>{
  const fs=await import('node:fs');
  const src=fs.readFileSync(new URL('../AuthContext.jsx',import.meta.url),'utf8');
  expect(src).not.toMatch(/^import .*from '\.\/drillSrs'/m);
  expect(src).toContain("import('./drillSrs').then((drill) => drill.migrateGuestDrillQueue(user.id))");
 });
});
