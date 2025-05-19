import { supabase } from "../supabaseClient";

export async function getAccessToken(): Promise<string | null> {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
        console.error("Error getting session:", error);
        return null;
    }

    if (data?.session) {
        return data.session.access_token;
    }
    return null;
}
