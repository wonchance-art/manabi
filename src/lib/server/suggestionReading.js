import { createClient } from '@supabase/supabase-js';
import { SUGGESTION_FIELDS, SUGGESTION_ID } from '../suggestionReading';
import { isOnDemandSuggestion } from '../suggestionSources';

export function suggestionClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } });
}

// A global suggestion may never point visitors at somebody else's private import.
// Explicit public scope is required even when an older permissive RLS policy exists.
export async function publicSuggestionTargets(client, rows) {
  const ids = [...new Set(rows.filter(s => !isOnDemandSuggestion(s)).map(s => s.material_id).filter(Boolean))];
  const ready = new Set();
  if (ids.length) {
    const result = await client.from('reading_materials').select('id, processed_json->status')
      .in('id', ids).eq('visibility', 'public');
    if (!result.error) for (const row of result.data || []) {
      if (['completed', 'partial'].includes(row.status)) ready.add(String(row.id));
    }
  }
  return rows.map(s => ({ ...s, material_id: ready.has(String(s.material_id)) ? s.material_id : null,
    transcript: isOnDemandSuggestion(s) ? null : s.transcript }));
}

export async function readSuggestion(client, id) {
  if (!SUGGESTION_ID.test(id || '')) return null;
  const { data, error } = await client.from('daily_suggestions').select(SUGGESTION_FIELDS).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return (await publicSuggestionTargets(client, [data]))[0];
}
