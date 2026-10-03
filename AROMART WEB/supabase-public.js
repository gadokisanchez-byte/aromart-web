// AromArt Shop · conexión pública a Supabase
// La publishable key puede estar en el navegador. La protección de escritura la hace RLS.
window.AROMART_SUPABASE_URL="https://ylljerwqqhdventugvay.supabase.co";
window.AROMART_SUPABASE_KEY="sb_publishable_COwHMel35s0lv0RqIKWzTQ_vuVfHNok";
window.aromartDb=window.supabase.createClient(window.AROMART_SUPABASE_URL,window.AROMART_SUPABASE_KEY);
