import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { cloudRunHeaders } from "../shared/lib/cloud-run-client.ts";
import { createClient } from "npm:@supabase/supabase-js@2.50.0";
import { reserveQuota } from "../shared/lib/quotas.ts";

const URL_CONFIG = {
  MSP: "mspnetwork",
  CSS_TANNER: "csstannernetwork",
  TANNER: "tannernetwork"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

  const isCloudRun = backendUrl.includes("run.app");

  const headers = isCloudRun
    ? {
        ...(await cloudRunHeaders(backendUrl)),
        "Content-Type": "application/json"
      }
    : {
        "Content-Type": "application/json"
      };

  try {
    if (isCloudRun) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        throw new Error("No authorization header");
      }
      const callingUserBearerToken = authHeader.split(" ")[1];
      if (!callingUserBearerToken) {
        throw new Error("No calling user bearer token");
      }
      const taskStore = createClient(
        Deno.env.get("SUPABASE_URL"),
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
      );

      const { data: userData, error: userError } = await taskStore.auth.getUser(
        callingUserBearerToken
      );
      if (userError || !userData) {
        console.error("Failed to get user", userError);
        throw new Error(userError.message);
      }

      const quota_error = await reserveQuota(
        userData.user.id,
        "cloud-run-minutes",
        0.5,
        taskStore,
        {
          usage_type: "tensornetwork_call"
        }
      );
      if (quota_error) {
        return new Response(JSON.stringify({ error: quota_error }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(reqJson)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Backend error response:", errorText);
      throw new Error(
        `Backend responded with status: ${response.status}, body: ${errorText}`
      );
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error: unknown) {
    console.error("Detailed error calling backend:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      cause: error instanceof Error ? error.cause : undefined
    });
    return new Response(
      JSON.stringify({
        error: "Failed to process request",
        details: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  }
});
