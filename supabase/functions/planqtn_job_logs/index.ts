// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { JobLogsRequest } from "./types.ts";
import { K8sClient } from "../shared/lib/k8s-client.ts";

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async (req) => {
  try {
    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    // Parse the request body
    const jobLogsRequest: JobLogsRequest = await req.json();

    // Validate the request
    if (
      !jobLogsRequest.task_uuid
    ) {
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("*")
      .eq("uuid", jobLogsRequest.task_uuid)
      .single();

    if (taskError) {
      return new Response(
        JSON.stringify({ error: `Failed to get task: ${taskError.message}` }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!task) {
      return new Response(
        JSON.stringify({ error: `Task ${jobLogsRequest.task_uuid} not found` }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    const client = new K8sClient();
    const logs = await client.getJobLogs(task.execution_id);
    return new Response(
      JSON.stringify({ logs: logs }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({ error: `Failed to get job logs: ${error}` }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/planqtn_job' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
