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

let cookieDoc;
// 쿠키 문자열을 흉내 내는 문서 — manabi_sc 쓰기만 기록하고 반영한다(세션 쿠키는 그대로).
function makeDoc(initial){const doc={_c:initial,writes:[],get cookie(){return this._c;},set cookie(v){this.writes.push(v);const name=v.split('=')[0];const parts=this._c.split(';').map(p=>p.trim()).filter(p=>p&&!p.startsWith(`${name}=`));if(!/Max-Age=0/.test(v))parts.push(v.split(';')[0]);this._c=parts.join('; ');}};return doc;}
const hasHint=()=>cookieDoc.cookie.split(';').some(p=>p.trim()==='manabi_sc=1');
const user=id=>({id,user_metadata:{name:id}});
const row=id=>({id,display_name:id,streak_count:6,streak_freeze_count:2,last_streak_date:'2026-10-01',last_login_at:'2026-09-01T00:00:00Z'});
function render(){h.index=0;return AuthProvider({children:null}).props.value;}
async function effects(){for(const fn of h.effects.splice(0)){const cleanup=fn();if(cleanup)h.cleanups.push(cleanup);}await tick();}
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
async function mount(){render();await effects();return render();}

beforeEach(()=>{h.failLoads=0;h.slots=[];h.index=0;h.effects=[];h.cleanups=[];h.profile=new Map([['A',row('A')],['B',row('B')]]);h.writes=[];h.reads=[];h.listener=null;h.session={user:user('A')};h.sessionDeferred=null;h.emitInitial=false;h.deferred=null;
 cookieDoc=makeDoc('sb-test-auth-token=x; manabi_sc=1');vi.stubGlobal('document',cookieDoc);
 vi.stubGlobal('window',{addEventListener:vi.fn(),removeEventListener:vi.fn(),location:{origin:'http://fixture',pathname:'/home',search:''}});
});
afterEach(()=>{for(const fn of h.cleanups)fn();vi.unstubAllGlobals();});


// SC-LINK-001 리뷰 N2 — 간체 글꼴 힌트 쿠키(manabi_sc)는 계정을 떠날 때(관문 한 곳: AuthContext adoptUser) 지우고,
// 손님 확정(세션 쿠키 없음)에서도 남기지 않는다. 처음 계정을 맞을 때 · 같은 계정의 토큰 갱신에는 건드리지 않는다.
describe('간체 글꼴 힌트 — 계정 경계', () => {
 it('세션 복원(손님 → A)은 힌트를 지우지 않는다 · 같은 계정 토큰 갱신도 그대로', async () => {
  await mount();
  expect(render().user.id).toBe('A');
  await h.listener('TOKEN_REFRESHED', { user: user('A') }); await tick();
  expect(hasHint()).toBe(true);
  expect(cookieDoc.writes).toEqual([]);
 });
 it('로그아웃하면 지운다', async () => {
  const auth = await mount();
  await auth.signOut(); await tick();
  expect(render().user).toBeNull();
  expect(hasHint()).toBe(false);
  expect(cookieDoc.writes).toEqual(['manabi_sc=; Path=/; Max-Age=0; SameSite=Lax']);
 });
 it('세션 만료(SIGNED_OUT) · 다른 계정으로 바뀜(A → B)에서도 지운다', async () => {
  await mount();
  await h.listener('SIGNED_IN', { user: user('B') }); await tick();
  expect(render().user.id).toBe('B');
  expect(hasHint()).toBe(false);
  cookieDoc._c += '; manabi_sc=1'; // B가 배움 화면에서 다시 썼다고 치고
  await h.listener('SIGNED_OUT', null); await tick();
  expect(hasHint()).toBe(false);
 });
 it('손님 확정(세션 쿠키 없음)에서는 남은 힌트를 지운다', async () => {
  cookieDoc = makeDoc('manabi_sc=1'); vi.stubGlobal('document', cookieDoc); h.session = null;
  await mount();
  expect(hasHint()).toBe(false);
 });
});
