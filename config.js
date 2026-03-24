// config.js — 프로젝트 전역 설정
const CONFIG = {
    SUPABASE_URL: 'https://jdtowtxhexcweuxawrds.supabase.co',
    SUPABASE_KEY: 'sb_publishable_qSe245OfO4EyU7SQxgqSSA_qsMPRlLr',
    GEMINI_MODEL: 'models/gemini-3.1-flash-lite-preview',
};

// Supabase 클라이언트 (전역)
const sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

