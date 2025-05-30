import { createClient } from "@supabase/supabase-js";
import { config } from "./config";

// This is the user/auth context + the task store supabase client
export const userContextSupabase = createClient(
    config.userContextURL,
    config.userContextAnonKey,
);

// This is the runtime store supabase client
export const runtimeStoreSupabase = createClient(
    config.runtimeStoreUrl,
    config.runtimeStoreAnonKey,
);
