// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.50.0";
import { K8sClient } from "../shared/lib/k8s-client.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface CancelJobRequest {
  task_uuid: string;
  task_store_url: string;
  task_store_anon_key: string;
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
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Parse the request body
    const cancelJobRequest: CancelJobRequest = await req.json();

    // Validate the request
    if (!cancelJobRequest.task_uuid) {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

      // Initialize Supabase client (locked to server's SUPABASE_URL)
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const taskStore = createClient(supabaseUrl, supabaseServiceKey);

  // Verify task ownership
  const token = authHeader.split(" ")[1];
  const { data: userData, error: userError } = await taskStore.auth.getUser(token);
  if (userError || !userData) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get the task from the database (owned by caller)
  const { data: task, error: taskError } = await taskStore
    .from("tasks")
    .select("*")
    .eq("uuid", cancelJobRequest.task_uuid)
    .eq("user_id", userData.user.id)
    .single();

    if (taskError) {
      return new Response(
        JSON.stringify({ error: `Failed to get task: ${taskError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    if (!task) {
      return new Response(
        JSON.stringify({
          error: `Task ${cancelJobRequest.task_uuid} not found`
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    if (!task.execution_id) {
      console.error("Task has no execution ID", task);
      return new Response(
        JSON.stringify({ error: "Task has no execution ID" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Delete the job in Kubernetes
    const client = new K8sClient();
    await client.connect();

    await client.deleteJob(task.execution_id);

    // Update the task status in the database
    const { error: updateError } = await taskStore
      .from("tasks")
      .update({
        state: 4, // cancelled
        result: { error: "Task cancelled by user" }
      })
      .eq("uuid", task.uuid);

    if (updateError) {
      return new Response(
        JSON.stringify({
          error: `Failed to update task: ${updateError.message}`
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Update the task status in the database
    const { error: taskUpdateError } = await taskStore
      .from("task_updates")
      .update({
        updates: { state: 4, result: { error: "Task cancelled by user" } }
      })
      .eq("uuid", task.uuid);

    if (taskUpdateError) {
      return new Response(
        JSON.stringify({
          error: `Failed to send realtime task update: ${taskUpdateError.message}`
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    return new Response(
      JSON.stringify({ message: "Job cancelled successfully" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error(error);
    return new Response(
      JSON.stringify({ error: `Failed to cancel job: ${errorMessage}` }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/cancel_job' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
