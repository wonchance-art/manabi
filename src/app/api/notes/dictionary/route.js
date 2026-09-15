import {noteAuth, reply, errorReply} from '@/lib/server/studyNotes';
import {BOARD_LANGUAGES, kanaCandidates} from '@/lib/teachingBoard';
import index from '@/lib/data/jaYomiIndex.json';
import {lookupSenses} from '@/lib/classroomLookup';
import {fail, checkDb} from '@/lib/server/learningContext';

// Only the app's stored dictionary is used. No note or expression is sent to
// an external recognition/generation provider from this endpoint.
export async function GET(request) {
  try {
    const {supabase} = await noteAuth(), params = new URL(request.url).searchParams;
    const text = (params.get('q') || '').trim(), language = params.get('language');
    if (!text || text.length > 300 || !BOARD_LANGUAGES.includes(language)) fail(400, '언어와 표현을 확인해 주세요.');
    const candidates = language === 'Japanese' ? kanaCandidates(index, text) : [];
    const forms = [...new Set([text, ...candidates.map(row => row.text)])];
    const {data, error} = await supabase.from('morpheme_dictionary').select('base_form,reading,meanings').eq('language', language).in('base_form', forms);
    checkDb(error);
    const exact = data?.find(row => row.base_form === text);
    return reply({text, reading: exact?.reading || '', senses: lookupSenses(exact?.meanings), source: '내 사전', candidates: candidates.map(row => ({...row,
      meaning: lookupSenses(data?.find(entry => entry.base_form === row.text)?.meanings)[0]?.meaning || ''}))});
  } catch (error) { return errorReply(error); }
}
