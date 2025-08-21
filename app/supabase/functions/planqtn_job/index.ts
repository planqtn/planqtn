// These edge functions are meant to be next to the runtime cluster.
// Typically, the user context (Task store) is the same as the runtime context (Task updates/Runtime store).
// This is the case for:
//  - production, user cloud (prod) - runtime cloud (prod GKE)
//  - dev/preview: cloud (dev) - runtime cloud (dev)
//  - local development: local - runtime (local)
// However, in the following cases this is not true, and they will be different:
//  - when the user picks a local runtime, we assume a local instance of supabase, which this function runs in - this pertains to
//      - production, cloud / runtime (local)
//      - preview: cloud / runtime (local)
//      - local development: cloud (dev) / runtime (local)
//      - and the disfunctional local development for testing GKE connectivity: local / runtime (cloud)
// This means that the TASK_UPDATES_KEY is the SUPABASE_SERVICE_ROLE_KEY (well, should be a narrower key, but that's for another day)
// The public URL of the TASK_UPDATES_URL is the same as the SUPABASE_URL, so we can use this.

// The user context thus is coming from the UI config and not the SUBAPABSE_URL and SUPABASE_SERVICE_ROLE_KEY.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.50.0";
import { JobRequest, JobResponse } from "../shared/lib/types.ts";
import { K8sClient } from "../shared/lib/k8s-client.ts";
import { JOBS_CONFIG } from "../shared/config/jobs_config.ts";

import { corsHeaders } from "../_shared/cors.ts";
import { validateJobRequest } from "../shared/lib/jobs.ts";

console.log("Current Deno version", Deno.version);

console.info("Starting planqtn_job function");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    console.info("OPTIONS...");
    return new Response("ok", { headers: corsHeaders });
  }

  console.info("POST...");

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
    const jobRequest: JobRequest = await req.json();

    const validationError = validateJobRequest(jobRequest);
    if (validationError) {
      return validationError;
    }

    const taskUpdatesUrl = Deno.env.get("SUPABASE_URL") ?? "";
    // TODO: make this narrower, i.e. only the key for the task updates table
    const taskUpdatesServiceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!taskUpdatesUrl || !taskUpdatesServiceKey) {
      return new Response(
        JSON.stringify({
          error:
            "Missing task updates (SUPABASE_URL) or service key (SUPABASE_SERVICE_ROLE_KEY)"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const taskUpdatesStore = createClient(
      taskUpdatesUrl,
      taskUpdatesServiceKey
    );

    const taskStoreUserToken = authHeader.split(" ")[1];
    if (!jobRequest.task_store_anon_key || !taskStoreUserToken) {
      console.error(
        "Missing task store anon key or user token",
        Boolean(jobRequest.task_store_anon_key),
        Boolean(taskStoreUserToken)
      );
      return new Response(
        JSON.stringify({
          error: "Missing task store anon key or user token"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Lock down: always use server-side SUPABASE_URL for Task Store
    const requestedUrl = jobRequest.task_store_url || "";
    const allowedHosts = new Set([
      new URL(taskUpdatesUrl).hostname,
      "localhost",
      "127.0.0.1"
    ]);
    let taskStoreUrl = taskUpdatesUrl;
    try {
      if (requestedUrl) {
        const u = new URL(requestedUrl);
        if (allowedHosts.has(u.hostname)) {
          taskStoreUrl = requestedUrl;
        }
      }
    } catch (_) {
      // ignore malformed URL; default to taskUpdatesUrl
    }

    const taskStore = createClient(
      taskStoreUrl,
      jobRequest.task_store_anon_key,
      {
        global: {
          headers: {
            Authorization: `Bearer ${taskStoreUserToken}`
          }
        }
      }
    );

    const { data: user, error: userError } =
      await taskStore.auth.getUser(taskStoreUserToken);
    if (userError) {
      console.error("Failed to get user", userError);
      throw new Error(userError.message);
    }

    console.info("Creating task in task store");

    // Insert the task into the database
    const { data: task, error: taskError } = await taskStore
      .from("tasks")
      .insert({
        user_id: jobRequest.user_id,
        job_type: jobRequest.job_type,
        sent_at: jobRequest.request_time,
        args: jobRequest.payload,
        state: 0 // pending
      })
      .select()
      .single();

    if (taskError) {
      console.error("Failed to create task in task store", taskError);
      throw new Error(
        `Failed to create task in task store: ${taskError.message}`,
        {
          cause: taskError
        }
      );
    }

    // Insert the pending task status
    const { error: taskUpdateInsertError } = await taskUpdatesStore
      .from("task_updates")
      .insert({
        uuid: task.uuid,
        user_id: task.user_id,
        updates: { state: 0 }
      });

    if (taskUpdateInsertError) {
      return new Response(
        JSON.stringify({
          error: `Failed to send realtime task update about pending task: ${taskUpdateInsertError.message}`
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // Create the job in Kubernetes
    try {
      if (!JOBS_CONFIG[jobRequest.job_type]) {
        throw new Error(
          `Job type ${jobRequest.job_type} not found in JOBS_CONFIG, available job types: ${Object.keys(
            JOBS_CONFIG
          ).join(", ")}`
        );
      }

      console.log("Creating job in Kubernetes");
      console.log("Job type:", jobRequest.job_type);
      console.log("Task UUID:", task.uuid);
      // console.log("Payload:", jobRequest.payload);

      const client = new K8sClient();
      await client.connect();

      const executionId = await client.createJob(
        jobRequest.job_type,
        ["python", "/app/planqtn_jobs/main.py"],
        [
          "--action",
          "run", // action
          "--job-type",
          jobRequest.job_type, // job type
          "--realtime",
          "--local-progress-bar"
        ],
        {
          ...JOBS_CONFIG[jobRequest.job_type],
          cpuLimitDefault:
            jobRequest.cpu_limit ??
            JOBS_CONFIG[jobRequest.job_type].cpuLimitDefault,
          memoryLimitDefault:
            jobRequest.memory_limit ??
            JOBS_CONFIG[jobRequest.job_type].memoryLimitDefault
        },
        undefined,
        task.uuid,
        {
          RUNTIME_SUPABASE_URL: taskUpdatesUrl,
          RUNTIME_SUPABASE_KEY: taskUpdatesServiceKey,
          TASK_STORE_URL: taskStoreUrl,
          TASK_STORE_USER_KEY: taskStoreUserToken,
          TASK_STORE_ANON_KEY: jobRequest.task_store_anon_key,
          TASK_ID: task.uuid,
          TASK_USER_ID: task.user_id
        }
      );

      console.log("Job created successfully with execution ID:", executionId);

      // Update the task with the execution ID
      const { error: updateError } = await taskStore
        .from("tasks")
        .update({
          execution_id: executionId,
          state: 0 // pending
        })
        .eq("uuid", task.uuid);

      if (updateError) {
        throw new Error(`Failed to update task: ${updateError.message}`);
      }

      // submit job-monitor job
      const jobMonitorJob = await client.createJob(
        `job-monitor`, // job type
        ["python", "/app/planqtn_jobs/main.py"], // command
        [
          "--action",
          "monitor" // action
        ],
        JOBS_CONFIG["job-monitor"], // config
        "job-monitor", // service account name
        task.uuid, // postfix
        {
          RUNTIME_SUPABASE_URL: taskUpdatesUrl,
          RUNTIME_SUPABASE_KEY: taskUpdatesServiceKey,
          TASK_STORE_URL: taskStoreUrl,
          TASK_STORE_USER_KEY: taskStoreUserToken,
          TASK_STORE_ANON_KEY: jobRequest.task_store_anon_key,
          TASK_ID: task.uuid,
          TASK_USER_ID: task.user_id,
          EXECUTION_ID: executionId
        }
      );
      console.log(
        "Job-monitor job created successfully with execution ID:",
        jobMonitorJob
      );

      const response: JobResponse = {
        task_id: task.uuid
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (error: unknown) {
      // Update task with error
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      const { error: updateError } = await taskUpdatesStore
        .from("tasks")
        .update({
          state: 3, // failed
          result: { error: errorMessage }
        })
        .eq("uuid", task.uuid);

      if (updateError) {
        console.error("Failed to update task with error:", updateError);
      }

      throw new Error(errorMessage);
    }
  } catch (error: unknown) {
    console.error("Error in planqtn_job function", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
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
