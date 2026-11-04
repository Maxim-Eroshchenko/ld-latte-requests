import { createClient } from "@supabase/supabase-js";
declare global {
  interface Window {
    __LD_LATTE_CONFIG__?: { supabaseUrl?: string; supabaseAnonKey?: string };
  }
}
const url =
  window.__LD_LATTE_CONFIG__?.supabaseUrl ?? import.meta.env.VITE_SUPABASE_URL;
const key =
  window.__LD_LATTE_CONFIG__?.supabaseAnonKey ??
  import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase =
  url && key && !url.includes("YOUR_PROJECT")
    ? createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;
export function client() {
  if (!supabase) throw new Error("Supabase не настроен");
  return supabase;
}
