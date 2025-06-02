import { corsHeaders } from "../../_shared/cors.ts";
import { JobRequest } from "./types.ts";

export const validateJobRequest = (jobRequest: JobRequest) => {
    const missingFields = [];
    if (!jobRequest.user_id) {
        missingFields.push("user_id");
    }
    if (!jobRequest.job_type) {
        missingFields.push("job_type");
    }
    if (!jobRequest.request_time) {
        missingFields.push("request_time");
    }
    if (!jobRequest.payload) {
        missingFields.push("payload");
    }
    if (!jobRequest.task_store_anon_key) {
        missingFields.push("task_store_anon_key");
    }

    // Validate the request
    if (
        missingFields.length > 0
    ) {
        return new Response(
            JSON.stringify({
                error: `Invalid request body: missing fields: ${
                    missingFields.join(", ")
                }`,
            }),
            {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
        );
    }
};
