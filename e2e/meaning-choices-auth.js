// Test-only session facade resolved exclusively by meaning-choices.e2e.mjs.
export const supabase={auth:{getSession:async()=>({data:{session:{user:{id:window.meaningQA.userId},access_token:'synthetic-only'}}})}};
