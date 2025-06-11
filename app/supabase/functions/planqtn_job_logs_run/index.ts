// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { JobLogsRequest } from "../shared/lib/types.ts";
import { K8sClient } from "../shared/lib/k8s-client.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { CloudRunClient } from "../shared/lib/cloud-run-client.ts";

// Initialize Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const findTaskFromRequest = async (
  req: Request
): Promise<Record<string, any> | Response> => {
  // Parse the request body
  const jobLogsRequest: JobLogsRequest = await req.json();

  // Validate the request
  if (!jobLogsRequest.task_uuid) {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("*")
    .eq("uuid", jobLogsRequest.task_uuid)
    .single();

  if (taskError) {
    console.error(taskError);
    return new Response(
      JSON.stringify({ error: `Failed to get task: ${taskError.message}` }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      }
    );
  }

  if (!task) {
    console.error(`Task ${jobLogsRequest.task_uuid} not found`);
    return new Response(
      JSON.stringify({ error: `Task ${jobLogsRequest.task_uuid} not found` }),
      {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      }
    );
  }
  return task;
};

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
    const task = await findTaskFromRequest(req);
    if (task instanceof Response) {
      return task;
    }
    const client = new CloudRunClient();

    const logs = await client.getJobLogs(task.execution_id);
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
});
