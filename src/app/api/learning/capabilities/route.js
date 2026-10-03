import { requireUser } from '@/lib/supabaseServer';
import { reply } from '@/lib/server/learningContext';
import { readLearningCapabilities } from '@/lib/server/learningCapabilities';

export const dynamic = 'force-dynamic';
export async function GET() {
  const auth = await requireUser();
  if (auth.error) return reply({ error: auth.error }, auth.status);
  return reply(await readLearningCapabilities(auth.supabase));
}
