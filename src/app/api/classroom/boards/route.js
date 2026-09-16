import {boardBody,getTeacherBoards,prepareTeacherBoard,commitTeacherBoard,reply,errorReply} from '@/lib/server/teachingBoardCloud';
export const maxDuration=60;
export async function GET(request){try{const p=new URL(request.url).searchParams;return reply(await getTeacherBoards(p.get('rootId'),p.get('day')));}catch(error){return errorReply(error);}}
export async function POST(request){try{return reply(await prepareTeacherBoard(await boardBody(request)));}catch(error){return errorReply(error);}}
export async function PUT(request){try{return reply(await commitTeacherBoard(await boardBody(request)));}catch(error){return errorReply(error);}}
