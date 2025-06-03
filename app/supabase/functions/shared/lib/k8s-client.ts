import * as k8s from "jsr:@cloudydeno/kubernetes-client@0.7.3";
import { CoreV1NamespacedApi } from "https://deno.land/x/kubernetes_apis@v0.5.4/builtin/core@v1/mod.ts";
import { BatchV1NamespacedApi } from "https://deno.land/x/kubernetes_apis@v0.5.4/builtin/batch@v1/mod.ts";
import { Job } from "https://deno.land/x/kubernetes_apis@v0.5.4/builtin/batch@v1/structs.ts";
import { JobConfig } from "../config/jobs_config.ts";
import * as md from "npm:gcp-metadata@6.1.0";
import { GoogleAuth } from "npm:google-auth-library@9.15.1";
import { KubeConfigRestClient } from "jsr:@cloudydeno/kubernetes-client@0.7.3";
import { toQuantity } from "https://deno.land/x/kubernetes_apis@v0.5.4/common.ts";

export class K8sClient {
    private kc?: k8s.KubeConfig;
    private k8sApi?: CoreV1NamespacedApi;
    private batchApi?: BatchV1NamespacedApi;
    private env: string;
    private restClient?: k8s.RestClient;

    constructor() {
        const env = Deno.env.get("ENV");
        if (!env) {
            throw new Error("ENV is not set on this environment");
        }
        this.env = env;
    }

    async loadConfig(): Promise<void> {
        if (this.env === "local") {
            // Configure the client with mTLS authentication
            this.kc = k8s.KubeConfig.getSimpleUrlConfig({
                baseUrl: `http://k8sproxy:8001`,
            });
        } else {
            // Production GKE setup
            console.log(`Using GKE ${this.env} configuration`);
            const clusterEndpoint = Deno.env.get("GKE_CLUSTER_ENDPOINT")!;
            const clusterCaCertB64 = Deno.env.get("GKE_CLUSTER_CA_CERT_B64")!;
            const saKeyJsonB64 = Deno.env.get(
                "GCP_SERVICE_ACCOUNT_KEY_JSON_B64",
            )!;

            const missingVariables = [];
            if (!clusterEndpoint) {
                missingVariables.push("GKE_CLUSTER_ENDPOINT");
            }
            if (!clusterCaCertB64) {
                missingVariables.push("GKE_CLUSTER_CA_CERT_B64");
            }
            if (!saKeyJsonB64) {
                missingVariables.push("GCP_SERVICE_ACCOUNT_KEY_JSON_B64");
            }
            if (missingVariables.length > 0) {
                console.error(
                    "Missing GKE connection environment variables for production: " +
                        missingVariables.join(", "),
                );
                throw new Error(
                    "Missing GKE environment variables: " +
                        missingVariables.join(", "),
                );
            }

            // Decode base64 environment variables
            // Deno's atob is for browser-like environments. For server-side Deno, you might need a utility or ensure it's available.
            // Supabase Edge Functions run in Deno, which supports atob.
            const saKeyJsonString = atob(saKeyJsonB64);
            const serviceAccountCredentials = JSON.parse(saKeyJsonString);

            const clusterCaCert = clusterCaCertB64; // This is the PEM string

            // Initialize GoogleAuth with service account credentials
            const auth = new GoogleAuth({
                credentials: serviceAccountCredentials,
                scopes: ["https://www.googleapis.com/auth/cloud-platform"], // Standard scope
            });

            // Get an access token
            const client = await auth.getClient();
            const accessTokenResponse = await client.getAccessToken();
            if (!accessTokenResponse || !accessTokenResponse.token) {
                console.error(
                    "Failed to obtain access token from Google Auth Library.",
                );
                throw new Error(
                    "Failed to obtain access token from Google Auth Library.",
                );
            }
            const accessToken = accessTokenResponse.token;

            this.kc = new k8s.KubeConfig({
                apiVersion: "v1",
                kind: "Config",
                clusters: [{
                    name: "gke-cluster",
                    cluster: {
                        "server": "https://" + clusterEndpoint,
                        "certificate-authority-data": clusterCaCert, // Decoded CA certificate (PEM format)
                        // skipTLSVerify: true, // This is the default when caData is provided; ensures TLS verification
                    },
                }],
                users: [{
                    name: "gcp-sa-user", // Arbitrary name for this user
                    user: {
                        token: accessToken, // The obtained OAuth2 token
                    },
                }],
                contexts: [{
                    name: "gke-context", // Arbitrary name for this context
                    context: {
                        "cluster": "gke-cluster", // Must match cluster name above
                        "user": "gcp-sa-user", // Must match user name above
                    },
                }],
                "current-context": "gke-context",
            });
            console.log("Successfully configured KubeConfig for GKE.");
        }

        // Create API clients
        this.restClient = await KubeConfigRestClient.forKubeConfig(this.kc);
        this.k8sApi = new CoreV1NamespacedApi(this.restClient, "default");
        this.batchApi = new BatchV1NamespacedApi(this.restClient, "default");
    }

    async connect(): Promise<void> {
        try {
            await this.loadConfig();

            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(
                    () =>
                        reject(
                            new Error(
                                "Connection test timed out after 5 seconds",
                            ),
                        ),
                    5000,
                );
            });

            // Create the actual API call promise
            const versionPromise = this.restClient?.performRequest(
                {
                    method: "GET",
                    path: "/version",
                    expectJson: true,
                },
            );

            // Race between the timeout and the API call
            const version = await Promise.race([
                versionPromise,
                timeoutPromise,
            ]);
            console.log(
                "Kubernetes connection successful. Version:",
                version,
            );
        } catch (error) {
            console.error("Kubernetes connection test failed:", error);
            if (error instanceof Error) {
                console.error("Error details:", {
                    message: error.message,
                    name: error.name,
                    stack: error.stack,
                    cause: error.cause,
                });

                // Additional error information for network-related errors
                if (error.message.includes("request to")) {
                    console.error("Network error details:", {
                        kc: this.kc,
                    });
                }
            }
            throw new Error(
                `Failed to connect to Kubernetes API: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }
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
        const jobName = `${jobType}-${postfix || Date.now()}`;
        const namespace = "default";

        // Convert env Record to array of V1EnvVar
        const envVars = env
            ? Object.entries(env).map(([name, value]) => ({
                name,
                value,
            }))
            : undefined;

        console.log("config", config);
        const job: Job = {
            apiVersion: "batch/v1",
            kind: "Job",
            metadata: {
                name: jobName,
                namespace: namespace,
            },
            spec: {
                template: {
                    spec: {
                        containers: [{
                            name: jobType,
                            image: config.image,
                            command: command,
                            args: args,
                            resources: {
                                limits: {
                                    memory: toQuantity(config.memoryLimit),
                                    cpu: toQuantity(config.cpuLimit),
                                },
                            },
                            env: envVars,
                        }],
                        restartPolicy: "Never",
                        ...(serviceAccountName ? { serviceAccountName } : {}),
                    },
                },
                backoffLimit: 0,
            },
        };

        try {
            console.log("Creating job with namespace:", namespace);
            console.log("Job configuration:", JSON.stringify(job, null, 2));

            // Use the raw API client
            const response = await this.batchApi?.createJob(job);

            console.log(
                "Job created successfully:",
                response?.metadata?.name || jobName,
            );
            return response?.metadata?.name || jobName;
        } catch (error) {
            console.error("Error creating job:", error);
            if (error instanceof Error) {
                console.error("Error details:", {
                    message: error.message,
                    name: error.name,
                    stack: error.stack,
                });
            }
            throw error;
        }
    }

    async getJobLogs(jobId: string): Promise<string> {
        const pods = await this.k8sApi!.getPodList(
            {
                labelSelector: `job-name=${jobId}`,
            },
        );
        console.log("Pods:", pods);

        if (pods.items.length === 0) {
            throw new Error("No pods found for job");
        }

        const podName = pods.items[0].metadata?.name;
        if (!podName) {
            throw new Error("Pod name not found");
        }

        const response = await this.k8sApi?.getPodLog(podName);
        return response || "";
    }

    async deleteJob(jobId: string): Promise<void> {
        try {
            // Delete the job
            await this.batchApi?.deleteJob(jobId, {
                propagationPolicy: "Background",
            });

            // Also delete any associated pods
            const pods = await this.k8sApi?.getPodList({
                labelSelector: `job-name=${jobId}`,
            });

            for (const pod of pods?.items || []) {
                if (pod.metadata?.name) {
                    await this.k8sApi?.deletePod(pod.metadata.name);
                }
            }
        } catch (error) {
            console.error("Error deleting job:", error);
            throw new Error(`Failed to delete job: ${error}`);
        }
    }
}
