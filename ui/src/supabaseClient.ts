import { createClient } from "@supabase/supabase-js";
import { config } from "./config";

export const taskStoreSupabase = createClient(
    config.taskStoreUrl,
    config.taskStoreAnonKey,
);

export const runtimeStoreSupabase = createClient(
    config.runtimeStoreUrl,
    config.runtimeStoreAnonKey,
);
