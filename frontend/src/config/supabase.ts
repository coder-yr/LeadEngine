import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string || 'placeholder-key';

if (supabaseUrl === 'https://placeholder-project.supabase.co') {
  console.warn(
    '[Supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set in .env. Auth will not work until you add them.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
