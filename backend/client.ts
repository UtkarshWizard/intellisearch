import { createClient } from "@supabase/supabase-js";

export const createSupabaseClient = () => {
    return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!);
}