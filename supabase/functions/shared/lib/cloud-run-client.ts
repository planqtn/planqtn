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

// Define a type for the expected REST API operation response (simplified)
interface CloudRunOperation {
    name: string;
    // Other fields like metadata, done, error, response might exist
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

        this.googleAuth = new GoogleAuth({
            credentials: credentials as any, // Cast to any to bypass strict library typing for now
            projectId: this.projectId,
            scopes: ["https://www.googleapis.com/auth/cloud-platform"],
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

            const responseBody = await response.json();

            if (!response.ok) {
                console.error("Error response from REST API:", responseBody);
                throw new Error(
                    `Failed to run job via REST API. Status: ${response.status} ${response.statusText}. ` +
                        `Response: ${JSON.stringify(responseBody)}`,
                );
            }

            console.log("Job run initiated via REST. Operation:", responseBody);
            const operation = responseBody as CloudRunOperation;
            return operation.name || "unknown_operation_name_from_rest";
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
}
