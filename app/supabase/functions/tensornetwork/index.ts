import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { cloudRunHeaders } from "../shared/lib/cloud-run-client.ts";

const URL_CONFIG = {
  MSP: "mspnetwork",
  CSS_TANNER: "csstannernetwork",
  TANNER: "tannernetwork",
};

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

  if (authData.user === null) {
    console.log("Unauthorized");
    return new Response("Unauthorized", { status: 401 });
  }

  const reqJson = await req.json();
  const backendUrl = Deno.env.get("API_URL");
  if (!backendUrl) {
    throw new Error("API_URL environment variable not set");
  }

  if (!URL_CONFIG[reqJson.networkType]) {
    throw new Error(`Invalid network type: ${reqJson.networkType}`);
  }

  const apiUrl = `${backendUrl}/${URL_CONFIG[reqJson.networkType]}`;
  console.log(`API URL: ${apiUrl}`);

  const headers = backendUrl.includes("run.app")
    ? await cloudRunHeaders(backendUrl)
    : {
      "Content-Type": "application/json",
    };

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: headers,
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
