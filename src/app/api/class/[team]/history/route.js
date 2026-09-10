import {authorizeTeamRequest} from '../route';
import {buildTeamIndex} from '@/lib/server/classIndex';
export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request,{params}){
 try{const {team}=await params,access=await authorizeTeamRequest(request,team);if(access.error)return access.error;
 const q=new URL(request.url).searchParams,offset=Number(q.get('offset')||0);
 if(!Number.isInteger(offset)||offset<0||offset>100000||(q.get('q')||'').length>200)return Response.json({error:'검색 조건을 확인해 주세요.'},{status:400,headers});
 return Response.json(await buildTeamIndex(access.admin,access.root,access.team,{search:q.get('q')||'',extras:q.get('extras')==='true',offset}),{headers});
 }catch{return Response.json({error:'수업 기록을 불러오지 못했어요.'},{status:503,headers});}
}
