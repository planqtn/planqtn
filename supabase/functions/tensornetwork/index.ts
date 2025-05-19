import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { GoogleAuth, IdTokenClient } from "npm:google-auth-library";
import { decodeBase64 } from "jsr:@std/encoding/base64";

console.log("Current Deno version", Deno.version.deno);

// Function to get Google OAuth token

// This function will now return the IdTokenClient itself,
// which will handle getting the token when its methods are called.
async function getIdTokenClientForCloudRun(
  serviceAccountCredentials: Record<string, unknown>,
  audience: string,
): Promise<IdTokenClient> {
  try {
    const auth = new GoogleAuth({
      credentials: serviceAccountCredentials,
    });

    const idTokenClient = await auth.getIdTokenClient(audience);
    return idTokenClient;
  } catch (error) {
    console.error("Error getting IdTokenClient:", error);
    throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.split(" ")[1];
  const { data: authData } = await supabaseClient.auth.getUser(token);

  // console.log("Received request", req);
  if (authData.user === null) {
    console.log("Unauthorized");
    return new Response("Unauthorized", { status: 401 });
  }

  // console.log("AuthData", authData.user);
  const reqJson = await req.json();
  // console.log(reqJson);
  // TODO: add request logging per user here

  // Get the backend URL from environment or use localhost for local development
  const backendUrl = Deno.env.get("API_URL");

  if (backendUrl && backendUrl.includes("run.app")) {
    console.log("Cloud Run mode!");
    const serviceAccountBase64 = Deno.env.get("SVC_ACCOUNT");
    if (!serviceAccountBase64) {
      throw new Error("SVC_ACCOUNT environment variable not set");
    }

    const serviceAccountJson = new TextDecoder().decode(
      decodeBase64(serviceAccountBase64),
    );
    const idTokenClient = await getIdTokenClientForCloudRun(
      JSON.parse(serviceAccountJson),
      backendUrl,
    );
    const headers = await idTokenClient.getRequestHeaders(backendUrl); // Pass the audience again if needed, or it can be inferred

    const apiUrl = `${backendUrl}/mspnetwork`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(reqJson),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend error response:", errorText);
      throw new Error(
        `Backend responded with status: ${response.status}, body: ${errorText}`,
      );
    }

    const data = await response.json();
    return new Response(
      JSON.stringify(data),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  const apiUrl = `${backendUrl}/mspnetwork`;

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reqJson),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend error response:", errorText);
      throw new Error(
        `Backend responded with status: ${response.status}, body: ${errorText}`,
      );
    }

    const data = await response.json();
    return new Response(
      JSON.stringify(data),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error: unknown) {
    console.error("Detailed error calling backend:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      cause: error instanceof Error ? error.cause : undefined,
    });
    return new Response(
      JSON.stringify({
        error: "Failed to process request",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/tensornetwork' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"bb"}'



    curl -i --location --request POST 'http://127.0.0.1:8000' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"bb"}'

*/
