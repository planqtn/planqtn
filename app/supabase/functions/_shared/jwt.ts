import * as Supabase from "npm:@supabase/supabase-js@2.103.3";

let authClient: Supabase.SupabaseClient | null = null;

function getAuthSupabase(): Supabase.SupabaseClient {
  if (!authClient) {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !anonKey) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_ANON_KEY must be set for AuthMiddleware"
      );
    }
    authClient = Supabase.createClient(url, anonKey);
  }
  return authClient;
}

function getAuthToken(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    throw new Error("Missing authorization header");
  }
  const [bearer, token] = authHeader.split(" ");
  if (bearer !== "Bearer") {
    throw new Error(`Auth header is not 'Bearer {token}'`);
  }

  return token;
}

// Validates authorization header via supabase.auth.getClaims (JWKS / Auth server per project config)
export async function AuthMiddleware(
  req: Request,
  next: (req: Request) => Promise<Response>
) {
  if (req.method === "OPTIONS") return await next(req);

  try {
    console.log("Verifying JWT...");
    const token = getAuthToken(req);
    const { data, error } = await getAuthSupabase().auth.getClaims(token);

    if (error) {
      console.error("getClaims error:", error);
      return Response.json(
        { msg: `${error.message} from middleware` },
        { status: 401 }
      );
    }

    if (!data?.claims) {
      return Response.json(
        { msg: "Invalid JWT from middleware" },
        { status: 401 }
      );
    }

    return await next(req);
  } catch (e) {
    console.error("Error verifying JWT:", e);
    return Response.json(
      { msg: e?.toString() + " from middleware" },
      {
        status: 401
      }
    );
  }
}
