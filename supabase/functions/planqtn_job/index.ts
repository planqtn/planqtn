// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { JobRequest, JobResponse } from "./types.ts";
import { K8sClient } from "../shared/lib/k8s-client.ts";
import { JOBS_CONFIG } from "../shared/config/jobs_config.ts";

import { corsHeaders } from "../_shared/cors.ts";

// Initialize Supabase client TODO get this from user token instead of service role key
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async (req) => {
  console.log("Received request", req);
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
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Parse the request body
    const jobRequest: JobRequest = await req.json();

    // Validate the request
    if (
      !jobRequest.user_id || !jobRequest.job_type || !jobRequest.request_time ||
      !jobRequest.payload
    ) {
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Insert the task into the database
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .insert({
        user_id: jobRequest.user_id,
        job_type: jobRequest.job_type,
        sent_at: jobRequest.request_time,
        args: jobRequest.payload,
        state: 0, // pending
      })
      .select()
      .single();

    if (taskError) {
      throw new Error(`Failed to create task: ${taskError.message}`);
    }

    // Create the job in Kubernetes
    try {
      console.log("Creating job in Kubernetes");
      console.log("Job type:", jobRequest.job_type);
      console.log("Task UUID:", task.uuid);
      console.log("Payload:", jobRequest.payload);

      const client = new K8sClient();

      // Test the connection first
      await client.testConnection();

      const executionId = await client.createJob(
        jobRequest.job_type,
        [
          "python",
          "/app/planqtn_jobs/main.py",
        ],
        [
          "--task-uuid",
          task.uuid,
          "--task-store-url",
          "http://host.docker.internal:54321",
          "--task-store-key",
          supabaseServiceKey,
          "--user-id",
          task.user_id,
          "--debug",
          "--realtime",
          "--local-progress-bar",
        ],
        JOBS_CONFIG[jobRequest.job_type],
        undefined,
        task.uuid,
        {
          RUNTIME_SUPABASE_URL: "http://host.docker.internal:54321",
          RUNTIME_SUPABASE_KEY: supabaseServiceKey,
        },
      );

      console.log("Job created successfully with execution ID:", executionId);

      // Update the task with the execution ID
      const { error: updateError } = await supabase
        .from("tasks")
        .update({
          execution_id: executionId,
          state: 0, // pending
        })
        .eq("uuid", task.uuid);

      if (updateError) {
        throw new Error(`Failed to update task: ${updateError.message}`);
      }

      // submit job-monitor job
      const jobMonitorJob = await client.createJob(
        `job-monitor`, // job type
        ["python", "/app/planqtn_jobs/monitor.py"], // command
        [
          executionId, // execution id
          task.uuid, // task uuid
          task.user_id, // user id
          supabaseUrl, // supabase url
          supabaseServiceKey, // supabase service role key
        ],
        JOBS_CONFIG["job-monitor"], // config
        "job-monitor", // service account name
        task.uuid, // postfix
      );
      console.log(
        "Job-monitor job created successfully with execution ID:",
        jobMonitorJob,
      );

      const response: JobResponse = {
        task_id: task.uuid,
      };

      return new Response(
        JSON.stringify(response),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } catch (error: unknown) {
      // Update task with error
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error occurred";
      const { error: updateError } = await supabase
        .from("tasks")
        .update({
          state: 3, // failed
          result: { error: errorMessage },
        })
        .eq("uuid", task.uuid);

      if (updateError) {
        console.error("Failed to update task with error:", updateError);
      }

      throw new Error(errorMessage);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
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
