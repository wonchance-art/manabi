// 인증 메일 템플릿(supabase/templates/recovery.html 등)의 「OO님,」은 Supabase auth의 user_metadata.display_name을 읽는다.
// 닉네임의 정본은 profiles.display_name이라, 닉네임을 저장할 때 같은 값을 auth 쪽에도 옮겨 둔다 —
// 옮기지 않으면 가입 때 적은 옛 닉네임이 메일에 남고, Google 가입자는 이름이 아예 비어 있다.
// 메일 이름은 보조 표시라 실패해도 닉네임 저장 자체를 실패로 돌리지 않는다.
export async function syncAuthDisplayName(client, user, name) {
  const next = typeof name === 'string' ? name.trim() : '';
  if (!next || typeof client?.auth?.updateUser !== 'function') return false;
  if (user?.user_metadata?.display_name === next) return false;
  try {
    const { error } = await client.auth.updateUser({ data: { display_name: next } });
    return !error;
  } catch {
    return false;
  }
}
