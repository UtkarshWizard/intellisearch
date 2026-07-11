import { createBrowserClient } from "@supabase/ssr";

export const supabase = createBrowserClient(
    process.env.BUN_PUBLIC_SUPABASE_URL!,
    process.env.BUN_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);