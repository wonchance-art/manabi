import {noteAuth, noteBody, readOwnNote, noteResponse, updateOwnNote, reply, errorReply} from '@/lib/server/studyNotes';
export async function GET(request, {params}) {
  try { const {supabase, user} = await noteAuth(); return reply(noteResponse(await readOwnNote(supabase, user.id, (await params).id))); }
  catch (error) { return errorReply(error); }
}
export async function PUT(request, {params}) {
  try { const {supabase, user} = await noteAuth(); return reply(await updateOwnNote(supabase, user.id, (await params).id, await noteBody(request))); }
  catch (error) { return errorReply(error); }
}
