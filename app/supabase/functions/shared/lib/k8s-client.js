"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.K8sClient = void 0;
const k8s = __importStar(require("jsr:@cloudydeno/kubernetes-client@0.7.3"));
const mod_ts_1 = require("https://deno.land/x/kubernetes_apis@v0.5.4/builtin/core@v1/mod.ts");
const mod_ts_2 = require("https://deno.land/x/kubernetes_apis@v0.5.4/builtin/batch@v1/mod.ts");
const npm_google_auth_library_9_15_1_1 = require("npm:google-auth-library@9.15.1");
const kubernetes_client_0_7_3_1 = require("jsr:@cloudydeno/kubernetes-client@0.7.3");
const common_ts_1 = require("https://deno.land/x/kubernetes_apis@v0.5.4/common.ts");
class K8sClient {
    constructor() {
        const env = Deno.env.get("ENV");
        if (!env) {
            throw new Error("ENV is not set on this environment");
        }
        this.env = env;
    }
    async loadConfig() {
        if (this.env === "local") {
            this.kc = k8s.KubeConfig.getSimpleUrlConfig({
                baseUrl: `http://k8sproxy:8001`,
            });
        }
        else {
            // Production GKE setup
            console.log(`Using GKE ${this.env} configuration`);
            const clusterEndpoint = Deno.env.get("GKE_CLUSTER_ENDPOINT");
            const clusterCaCertB64 = Deno.env.get("GKE_CLUSTER_CA_CERT_B64");
            const saKeyJsonB64 = Deno.env.get("GCP_SERVICE_ACCOUNT_KEY_JSON_B64");
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
                console.error("Missing GKE connection environment variables for production: " +
                    missingVariables.join(", "));
                throw new Error("Missing GKE environment variables: " +
                    missingVariables.join(", "));
            }
            // Decode base64 environment variables
            // Deno's atob is for browser-like environments. For server-side Deno, you might need a utility or ensure it's available.
            // Supabase Edge Functions run in Deno, which supports atob.
            const saKeyJsonString = atob(saKeyJsonB64);
            const serviceAccountCredentials = JSON.parse(saKeyJsonString);
            const clusterCaCert = clusterCaCertB64; // This is the PEM string
            // Initialize GoogleAuth with service account credentials
            const auth = new npm_google_auth_library_9_15_1_1.GoogleAuth({
                credentials: serviceAccountCredentials,
                scopes: ["https://www.googleapis.com/auth/cloud-platform"], // Standard scope
            });
            // Get an access token
            const client = await auth.getClient();
            const accessTokenResponse = await client.getAccessToken();
            if (!accessTokenResponse || !accessTokenResponse.token) {
                console.error("Failed to obtain access token from Google Auth Library.");
                throw new Error("Failed to obtain access token from Google Auth Library.");
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
        this.restClient = await kubernetes_client_0_7_3_1.KubeConfigRestClient.forKubeConfig(this.kc);
        this.k8sApi = new mod_ts_1.CoreV1NamespacedApi(this.restClient, "default");
        this.batchApi = new mod_ts_2.BatchV1NamespacedApi(this.restClient, "default");
    }
    async connect() {
        try {
            await this.loadConfig();
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error("Connection test timed out after 5 seconds")), 5000);
            });
            // Create the actual API call promise
            const versionPromise = this.restClient?.performRequest({
                method: "GET",
                path: "/version",
                expectJson: true,
            });
            // Race between the timeout and the API call
            const version = await Promise.race([
                versionPromise,
                timeoutPromise,
            ]);
            console.log("Kubernetes connection successful. Version:", version);
        }
        catch (error) {
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
            throw new Error(`Failed to connect to Kubernetes API: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async createJob(jobType, command, args, config, serviceAccountName, postfix, env) {
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
        const job = {
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
                                        memory: (0, common_ts_1.toQuantity)(config.memoryLimit),
                                        cpu: (0, common_ts_1.toQuantity)(config.cpuLimit),
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
            console.log("Job created successfully:", response?.metadata?.name || jobName);
            return response?.metadata?.name || jobName;
        }
        catch (error) {
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
    async getJobLogs(jobId) {
        const pods = await this.k8sApi.getPodList({
            labelSelector: `job-name=${jobId}`,
        });
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
    async deleteJob(jobId) {
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
        }
        catch (error) {
            console.error("Error deleting job:", error);
            throw new Error(`Failed to delete job: ${error}`);
        }
    }
}
exports.K8sClient = K8sClient;
