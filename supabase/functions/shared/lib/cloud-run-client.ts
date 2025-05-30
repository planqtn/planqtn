import { createClient } from "jsr:@supabase/supabase-js@2";
import { JobConfig } from "../config/jobs_config.ts";
import {
    Credentials,
    GoogleAuth,
    IdTokenClient,
} from "npm:google-auth-library@9.15.1";
import { decodeBase64 } from "jsr:@std/encoding/base64";

// Types for the REST API overrides (matching the documentation)
interface ContainerOverride {
    name?: string; // Name of the container to override
    args?: string[];
    env?: { name: string; value: string }[];
    clearArgs?: boolean;
    // command?: string[]; // Removed as it's not supported by the REST API run override
}

interface Overrides {
    containerOverrides?: ContainerOverride[];
    taskCount?: number;
    timeout?: string; // e.g., "3600s"
}

// Simplified LogEntry structure for what we need
interface LogEntry {
    textPayload?: string;
    jsonPayload?: any;
    protoPayload?: any;
    timestamp: string;
    severity: string;
    labels?: Record<string, string>;
    // Add other fields if needed, e.g., httpRequest, operation, etc.
}

interface ListLogEntriesResponse {
    entries?: LogEntry[];
    nextPageToken?: string;
    error?: {
        code: number;
        message: string;
        status: string;
        details?: any[];
    };
}

// For LRO polling
interface CloudRunOperation {
    name: string;
    done?: boolean;
    error?: { code: number; message: string; details: any[] }; // Standard Google API error object
    response?: any; // May not be used for job executions if metadata holds the result
    metadata?: CloudRunExecution | any; // For job executions, this contains the Execution object
}

// Updated representation of a Cloud Run Execution object (from LRO metadata/response)
interface CloudRunExecution {
    name: string; // Full resource name: projects/.../executions/EXECUTION_ID
    uid: string;
    generation: string; // e.g., "1"
    labels?: Record<string, string>;
    createTime: string;
    startTime?: string;
    completionTime?: string;
    logUri?: string; // Direct link to logs in Cloud Console
    job?: string; // Name of the job, e.g., "planqtn-jobs"
    parallelism?: number;
    taskCount?: number;
    template?: any; // Could be more specific if needed
    conditions?: Array<{
        type: string;
        state: string;
        message?: string;
        lastTransitionTime: string;
        executionReason?: string;
        reason?: string; // Sometimes 'reason' is used instead of 'executionReason'
    }>;
    observedGeneration?: string;
    failedCount?: number;
    succeededCount?: number;
    cancelledCount?: number;
    retriedCount?: number;
    creator?: string;
    updater?: string;
    etag?: string;
    reconciling?: boolean;
    satisfiesPzs?: boolean;
    launchStage?: string;
}

// Add interface for logging request body
interface LoggingRequestBody {
    resourceNames: string[];
    filter: string;
    orderBy: string;
    pageSize: number;
    pageToken?: string;
}

export const cloudRunHeaders = async (
    backendUrl: string,
) => {
    return await getIdTokenClientForCloudRun(
        backendUrl,
    ).then((idTokenClient) => idTokenClient.getRequestHeaders(backendUrl));
};

const googleCredentials = (): Credentials => {
    const serviceAccountBase64 = Deno.env.get("SVC_ACCOUNT");
    if (!serviceAccountBase64) {
        throw new Error("SVC_ACCOUNT environment variable not set");
    }
    const decodedString = new TextDecoder().decode(
        decodeBase64(serviceAccountBase64),
    );
    return JSON.parse(decodedString) as Credentials;
};

export async function getIdTokenClientForCloudRun(
    audience: string,
): Promise<IdTokenClient> {
    try {
        const auth = new GoogleAuth({
            credentials: googleCredentials() as any, // Cast to any to bypass strict library typing for now
        });
        const idTokenClient = await auth.getIdTokenClient(audience);
        return idTokenClient;
    } catch (error) {
        console.error("Error getting IdTokenClient:", error);
        throw error;
    }
}

export class CloudRunClient {
    private projectId: string;
    private location: string;
    private googleAuth: GoogleAuth;

    constructor(projectId: string, location: string) {
        console.log(
            `CloudRunClient constructor called with projectId: '${projectId}', location: '${location}'`,
        );
        console.log("Deno env vars", Deno.env.toObject());
        this.projectId = projectId;
        this.location = location;

        const credentials = googleCredentials();

        console.log("Credentials", credentials);
        this.googleAuth = new GoogleAuth({
            credentials: credentials as any, // Cast to any to bypass strict library typing for now
            projectId: this.projectId,
            // Ensure scopes cover logging.read or cloud-platform
            scopes: [
                "https://www.googleapis.com/auth/cloud-platform",
                "https://www.googleapis.com/auth/logging.read",
            ],
        });

        console.log(
            "Initializing CloudRunClient (REST API version) with projectId:",
            projectId,
            "location:",
            location,
        );
    }

    async createJob(
        jobType: string,
        command: string[],
        args: string[],
        config: JobConfig,
        serviceAccountName?: string,
        postfix?: string,
        env?: Record<string, string>,
    ): Promise<string> {
        const baseJobId = "planqtn-jobs";
        const jobIdentifier = baseJobId;
        const jobResourceName =
            `projects/${this.projectId}/locations/${this.location}/jobs/${jobIdentifier}`;

        const restApiUrl =
            `https://run.googleapis.com/v2/${jobResourceName}:run`;

        const containerArgs = args;
        const formattedEnv = env
            ? Object.entries(env).map(([key, value]) => ({ name: key, value }))
            : [];

        const overrides: Overrides = {
            containerOverrides: [
                {
                    args: containerArgs,
                    env: formattedEnv,
                },
            ],
        };

        if (config.timeout) {
            overrides.timeout = `${config.timeout}s`;
        }

        const requestBody = { overrides }; // The API expects an object with an 'overrides' key

        console.log(`Attempting to run job via REST API: POST ${restApiUrl}`);
        console.log("Request Body:", JSON.stringify(requestBody, null, 2));

        try {
            const token = await this.googleAuth.getAccessToken();
            if (!token) {
                throw new Error(
                    "Failed to retrieve access token from GoogleAuth.",
                );
            }

            const response = await fetch(restApiUrl, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
            });

            const responseBody: CloudRunOperation = await response.json();

            if (!response.ok) {
                console.error(
                    "Error response from REST API creating job:",
                    responseBody,
                );
                const errorMessage = responseBody.error?.message ||
                    JSON.stringify(responseBody);
                throw new Error(
                    `Failed to run job via REST API. Status: ${response.status} ${response.statusText}. ` +
                        `Response: ${errorMessage}`,
                );
            }

            console.log(
                "Job run LRO initiated via REST. Operation:",
                responseBody,
            );
            return responseBody.name; // Returns the LRO name
        } catch (error) {
            console.error("Error running job via REST API:", error);
            if (
                error instanceof Error &&
                error.message.includes("Failed to retrieve access token")
            ) {
                // Rethrow token errors directly as they are critical for auth debugging
                throw error;
            }
            // For other errors, retain existing detailed logging
            if (error instanceof Error) {
                console.error("Error message:", error.message);
                if (error.stack) {
                    console.error("Error stack:", error.stack);
                }
            } else {
                console.error(
                    "Caught an unknown error type during REST call:",
                    error,
                );
            }
            throw error;
        }
    }

    async pollLRO(
        lroName: string,
        maxAttempts = 10,
        delayMs = 5000,
    ): Promise<CloudRunOperation> {
        console.log(`Polling LRO: ${lroName}`);
        const lroApiUrl = `https://run.googleapis.com/v2/${lroName}`;
        let attempts = 0;

        while (attempts < maxAttempts) {
            attempts++;
            console.log(
                `LRO Poll attempt ${attempts}/${maxAttempts} for ${lroName}`,
            );
            const token = await this.googleAuth.getAccessToken();
            if (!token) {
                throw new Error(
                    "Failed to retrieve access token for LRO polling.",
                );
            }

            const response = await fetch(lroApiUrl, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            const lroStatus: CloudRunOperation = await response.json();

            if (!response.ok) {
                console.error("Error polling LRO:", lroStatus);
                const errorMessage = lroStatus.error?.message ||
                    JSON.stringify(lroStatus);
                throw new Error(
                    `Failed to poll LRO. Status: ${response.status} ${response.statusText}. ` +
                        `Response: ${errorMessage}`,
                );
            }

            if (lroStatus.done) {
                console.log(`LRO ${lroName} is done. Status:`, lroStatus);
                // If LRO is done, return its status, regardless of whether it contains an error.
                // The caller can then inspect lroStatus.error to see if the underlying operation failed.
                return lroStatus;
            }

            console.log(`LRO ${lroName} not done yet, waiting ${delayMs}ms...`);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        throw new Error(
            `LRO ${lroName} did not complete after ${maxAttempts} attempts.`,
        );
    }

    // Helper to extract the short execution ID from the full execution resource name
    private getShortExecutionId(fullExecutionResourceName: string): string {
        if (
            !fullExecutionResourceName ||
            !fullExecutionResourceName.includes("/")
        ) {
            console.warn(
                `Invalid fullExecutionResourceName for getShortExecutionId: ${fullExecutionResourceName}`,
            );
            return fullExecutionResourceName; // Return as is if not a valid path
        }
        return fullExecutionResourceName.substring(
            fullExecutionResourceName.lastIndexOf("/") + 1,
        );
    }

    async getJobLogs(
        lroName: string,
        defaultJobNameForFilter: string = "planqtn-jobs",
    ): Promise<string> {
        console.log(`Getting logs for LRO: ${lroName}`);

        // 1. Poll the LRO to get Execution details
        const completedLro = await this.pollLRO(lroName);

        if (completedLro.error) {
            console.warn(
                `Warning: The job associated with LRO ${lroName} reported an error: ${completedLro.error.message}. Attempting to fetch logs anyway. Details:`,
                JSON.stringify(completedLro.error.details || {}, null, 2),
            );
            // Do NOT throw; proceed to fetch logs as they are crucial for diagnosing job failures.
        }

        // For Cloud Run job executions, the Execution object is in the LRO's 'metadata' field.
        if (!completedLro.metadata) {
            throw new Error(
                `LRO ${lroName} did not yield metadata containing execution details. Cannot determine execution to fetch logs for.`,
            );
        }

        const executionDetails = completedLro.metadata as CloudRunExecution;
        const executionResourceName = executionDetails.name;

        if (!executionResourceName) {
            throw new Error(
                `Could not determine execution resource name from LRO metadata for ${lroName}.`,
            );
        }

        // 2. Determine jobName for the filter
        // Prefer job_name from execution labels or the job field in execution metadata if available
        const jobNameFromLabel = executionDetails.labels
            ?.["run.googleapis.com/job_name"];
        const jobNameFromMetadata = executionDetails.job; // The 'job' field in Execution metadata often holds the short job name
        const jobName = jobNameFromMetadata || jobNameFromLabel ||
            defaultJobNameForFilter;

        console.log(
            `Using jobName: '${jobName}' for log filter (derived from metadata: ${!!jobNameFromMetadata}, label: ${!!jobNameFromLabel}).`,
        );
        if (executionDetails.logUri) {
            console.log(
                `Console Log URI for this execution: ${executionDetails.logUri}`,
            );
        }

        // 3. Proceed with fetching logs using the executionResourceName
        const shortExecutionId = this.getShortExecutionId(
            executionResourceName,
        );
        console.log(
            `Fetching logs for execution ID: ${shortExecutionId} (from resource ${executionResourceName}) of job: ${jobName}`,
        );

        const loggingApiUrl = "https://logging.googleapis.com/v2/entries:list";

        // Match the filter exactly as it appears in the working Cloud Logging Console query
        const filter =
            `labels."run.googleapis.com/execution_name"="${shortExecutionId}"\n` +
            `resource.type="cloud_run_job"\n` +
            `resource.labels.job_name="${jobName}"\n` +
            `resource.labels.location="${this.location}"`;

        const requestBody: LoggingRequestBody = {
            resourceNames: [`projects/${this.projectId}`],
            filter: filter,
            orderBy: "timestamp desc",
            pageSize: 1000,
        };

        console.log("Requesting logs with filter:", filter);
        console.log(
            "Logging request body:",
            JSON.stringify(requestBody, null, 2),
        );

        try {
            const token = await this.googleAuth.getAccessToken();
            if (!token) {
                throw new Error("Failed to retrieve access token for logging.");
            }

            let allEntries: LogEntry[] = [];
            let nextPageToken: string | undefined;

            do {
                // Add pageToken to request if we have one
                if (nextPageToken) {
                    requestBody.pageToken = nextPageToken;
                }

                const response = await fetch(loggingApiUrl, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(requestBody),
                });

                const responseBody: ListLogEntriesResponse = await response
                    .json();

                if (!response.ok) {
                    console.error(
                        "Error response from Logging API:",
                        responseBody,
                    );
                    const errorMessage = responseBody.error?.message ||
                        JSON.stringify(responseBody);
                    throw new Error(
                        `Failed to get logs from Logging API. Status: ${response.status} ${response.statusText}. ` +
                            `Response: ${errorMessage}`,
                    );
                }

                // Add entries from this page to our collection
                if (responseBody.entries) {
                    allEntries = allEntries.concat(responseBody.entries);
                }

                // Get the next page token for the next iteration
                nextPageToken = responseBody.nextPageToken;

                console.log(
                    `Retrieved ${
                        responseBody.entries?.length || 0
                    } log entries. Total so far: ${allEntries.length}. Has next page: ${!!nextPageToken}`,
                );
            } while (nextPageToken);

            console.log(`Retrieved total of ${allEntries.length} log entries.`);
            return allEntries.map((entry) => entry.textPayload).join("\n");
        } catch (error) {
            console.error("Error fetching job logs:", error);
            if (error instanceof Error) {
                console.error("Error message:", error.message);
                if (error.stack) {
                    console.error("Error stack:", error.stack);
                }
            } else {
                console.error(
                    "Caught an unknown error type during log fetching:",
                    error,
                );
            }
            throw error;
        }
    }

    async cancelJob(lroName: string): Promise<void> {
        console.log(`Cancelling job: ${lroName}`);

        // Get the execution details from the LRO without waiting for completion
        const lroApiUrl = `https://run.googleapis.com/v2/${lroName}`;

        try {
            const token = await this.googleAuth.getAccessToken();
            if (!token) {
                throw new Error(
                    "Failed to retrieve access token for cancellation.",
                );
            }

            const response = await fetch(lroApiUrl, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                const responseBody = await response.json();
                console.error("Error response from LRO API:", responseBody);
                const errorMessage = responseBody.error?.message ||
                    JSON.stringify(responseBody);
                throw new Error(
                    `Failed to get LRO details. Status: ${response.status} ${response.statusText}. ` +
                        `Response: ${errorMessage}`,
                );
            }

            const lroStatus: CloudRunOperation = await response.json();

            if (!lroStatus.metadata) {
                throw new Error(
                    `LRO ${lroName} did not yield metadata containing execution details. Cannot determine execution to cancel.`,
                );
            }

            const executionDetails = lroStatus.metadata as CloudRunExecution;
            const executionResourceName = executionDetails.name;

            if (!executionResourceName) {
                throw new Error(
                    `Could not determine execution resource name from LRO metadata for ${lroName}.`,
                );
            }

            // Construct the cancel API URL for the execution
            const cancelApiUrl =
                `https://run.googleapis.com/v2/${executionResourceName}:cancel`;

            const cancelResponse = await fetch(cancelApiUrl, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({}), // Empty body as per API spec
            });

            if (!cancelResponse.ok) {
                const responseBody = await cancelResponse.json();
                console.error(
                    "Error response from cancellation API:",
                    responseBody,
                );
                const errorMessage = responseBody.error?.message ||
                    JSON.stringify(responseBody);
                throw new Error(
                    `Failed to cancel execution. Status: ${cancelResponse.status} ${cancelResponse.statusText}. ` +
                        `Response: ${errorMessage}`,
                );
            }

            console.log(
                `Successfully initiated cancellation for execution: ${executionResourceName}`,
            );

            // Poll the execution to confirm it's being cancelled
            let attempts = 0;
            const maxAttempts = 10;
            const delayMs = 2000;

            while (attempts < maxAttempts) {
                attempts++;
                console.log(
                    `Checking cancellation status (attempt ${attempts}/${maxAttempts})...`,
                );

                const statusResponse = await fetch(
                    `https://run.googleapis.com/v2/${executionResourceName}`,
                    {
                        method: "GET",
                        headers: {
                            "Authorization": `Bearer ${token}`,
                            "Content-Type": "application/json",
                        },
                    },
                );

                if (!statusResponse.ok) {
                    const statusBody = await statusResponse.json();
                    console.error(
                        "Error checking execution status:",
                        statusBody,
                    );
                    break;
                }

                const executionStatus = await statusResponse
                    .json() as CloudRunExecution;
                console.log("Execution status:", executionStatus);

                // Check if any of the conditions indicate cancellation
                const isCancelling = executionStatus.conditions?.some(
                    (condition) =>
                        condition.type === "Completed" &&
                        condition.state === "CONDITION_FAILED" &&
                        condition.executionReason === "CANCELLED",
                );

                if (isCancelling) {
                    console.log("Execution is being cancelled successfully.");
                    return;
                }

                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }

            console.warn(
                `Cancellation initiated but could not confirm status after ${maxAttempts} attempts.`,
            );
        } catch (error) {
            console.error("Error cancelling job:", error);
            if (error instanceof Error) {
                console.error("Error message:", error.message);
                if (error.stack) {
                    console.error("Error stack:", error.stack);
                }
            } else {
                console.error(
                    "Caught an unknown error type during cancellation:",
                    error,
                );
            }
            throw error;
        }
    }
}
