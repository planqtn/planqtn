// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.50.0";
import { JobLogsRequest } from "../shared/lib/types.ts";
import { K8sClient } from "../shared/lib/k8s-client.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { CloudRunClient } from "../shared/lib/cloud-run-client.ts";

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function redactSecrets(input: string): string {
  const patterns = [
    /([A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,})/g, // JWT-like
    /(key|token|secret|password|authorization)=([^\s]+)/gi,
    /(SUPABASE_[A-Z_]+|TASK_STORE_[A-Z_]+|RUNTIME_SUPABASE_[A-Z_]+):\s*[^\s]+/gi
  ];
  let out = input;
  for (const p of patterns) out = out.replace(p, "$1[REDACTED]");
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        }
      );
    }
    const jobLogsRequest: JobLogsRequest = await req.json();

    // Validate the request
    if (!jobLogsRequest.execution_id) {
      return new Response(
        JSON.stringify({ error: "Invalid request body, no execution_id" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        }
      );
    }

    const client = new CloudRunClient();

    const logs = await client.getJobLogs(jobLogsRequest.execution_id);
    const safeLogs = redactSecrets(logs || "");
    return new Response(JSON.stringify({ logs: safeLogs }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (error: unknown) {
    console.error(`Failed to get job logs: ${error}`);
    return new Response(
      JSON.stringify({ error: `Failed to get job logs: ${error}` }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      }
    );
  }
});
