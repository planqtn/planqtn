// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { JobLogsRequest } from "../shared/lib/types.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { CloudRunClient } from "../shared/lib/cloud-run-client.ts";
import { AuthMiddleware } from "../_shared/jwt.ts";

Deno.serve(
  async (req) =>
    await AuthMiddleware(req, async (req) => {
      if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
      }
      try {
        const jobLogsRequest: JobLogsRequest = await req.json();

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
        console.log(`Found logs: ${logs}`);
        return new Response(JSON.stringify({ logs: logs }), {
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
    })
);
