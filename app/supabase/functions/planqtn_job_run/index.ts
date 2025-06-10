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
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { JobRequest, JobResponse } from "../shared/lib/types.ts";

import { JOBS_CONFIG } from "../shared/config/jobs_config.ts";

import { corsHeaders } from "../_shared/cors.ts";
import { CloudRunClient } from "../shared/lib/cloud-run-client.ts";
import { validateJobRequest } from "../shared/lib/jobs.ts";

console.log("Current Deno version", Deno.version);
console.info("Starting planqtn_job for Cloud Run function");

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

    const taskStoreKey = authHeader.split(" ")[1];
    if (
      !jobRequest.task_store_url ||
      !taskStoreKey ||
      !jobRequest.task_store_anon_key
    ) {
      console.error(
        "Missing task store URL or service key",
        jobRequest.task_store_url,
        taskStoreKey
      );
      return new Response(
        JSON.stringify({
          error: "Missing task store URL or service key"
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const localRuntime =
      jobRequest.task_store_url.includes("localhost") ||
      jobRequest.task_store_url.includes("127.0.0.1");
    const taskStoreUrl = localRuntime
      ? taskUpdatesUrl
      : jobRequest.task_store_url;

    const taskStore = createClient(
      taskStoreUrl,
      jobRequest.task_store_anon_key,
      {
        global: {
          headers: {
            Authorization: `Bearer ${taskStoreKey}`
          }
        }
      }
    );

    const { data: user, error: userError } = await taskStore.auth.getUser(
      taskStoreKey
    );
    if (userError) {
      console.error("Failed to get user", userError);
      throw new Error(userError.message);
    }

    console.info("Creating task in task store", taskStoreUrl);

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

    try {
      console.log("Creating job in Cloud Run");
      console.log("Job type:", jobRequest.job_type);
      console.log("Task UUID:", task.uuid);
      // console.log("Payload:", jobRequest.payload);

      const client = new CloudRunClient();

      const job_creation_response = await client.createJob(
        jobRequest.job_type,
        [],
        [
          "/app/planqtn_jobs/main.py",
          "--task-uuid",
          task.uuid,
          "--task-store-url",
          taskStoreUrl,
          "--task-store-user-key",
          taskStoreKey,
          "--task-store-anon-key",
          jobRequest.task_store_anon_key,
          "--user-id",
          task.user_id,
          "--debug",
          "--realtime",
          "--local-progress-bar"
        ],
        JOBS_CONFIG[jobRequest.job_type],
        undefined,
        task.uuid,
        {
          RUNTIME_SUPABASE_URL: taskUpdatesUrl,
          RUNTIME_SUPABASE_KEY: taskUpdatesServiceKey
        }
      );

      console.log("Job creation response", job_creation_response);

      const { error: updateError } = await taskStore
        .from("tasks")
        .update({
          execution_id: job_creation_response,
          state: 1 // running
        })
        .eq("uuid", task.uuid)
        .eq("user_id", task.user_id);

      if (updateError) {
        console.error("Failed to update task with error:", updateError);
      }

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
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
