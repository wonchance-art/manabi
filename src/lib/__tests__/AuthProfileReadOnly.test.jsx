import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ slots: [], index: 0, effects: [], cleanups: [], profile: new Map(), writes: [], reads: [], listener: null, session: null, sessionDeferred: null, emitInitial: false, deferred: null }));
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
  return {supabase:client,getSupabase:vi.fn(async()=>client)};
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

beforeEach(()=>{h.slots=[];h.index=0;h.effects=[];h.cleanups=[];h.profile=new Map([['A',row('A')],['B',row('B')]]);h.writes=[];h.reads=[];h.listener=null;h.session={user:user('A')};h.sessionDeferred=null;h.emitInitial=false;h.deferred=null;
 vi.stubGlobal('document',{cookie:'sb-test-auth-token=x'});
 vi.stubGlobal('window',{addEventListener:vi.fn(),removeEventListener:vi.fn(),location:{origin:'http://fixture',pathname:'/home',search:''}});
});
afterEach(()=>{for(const fn of h.cleanups)fn();vi.unstubAllGlobals();});

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
});
