import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config";

function getSupabaseClient(name: string, url: string, anonKey: string): SupabaseClient|null {
  try {
    return createClient(url, anonKey);
  } catch (error) {
    console.error(`Error creating ${name} supabase client with details: url: ${url}, anonKey: ${anonKey}`, error);
    return null;
  }
}

export const userContextSupabase = getSupabaseClient(
  "userContext",
  config.userContextURL,
  config.userContextAnonKey
);

// This is the runtime store supabase client
export const runtimeStoreSupabase = getSupabaseClient(
  "runtimeStore",
  config.runtimeStoreUrl,
  config.runtimeStoreAnonKey
);
