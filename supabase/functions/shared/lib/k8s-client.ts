import * as k8s from "npm:@kubernetes/client-node";
import { JobConfig } from "../config/jobs_config.ts";
import { AbortError } from "npm:node-fetch";

export class K8sClient {
    private kc: k8s.KubeConfig;
    private k8sApi: k8s.CoreV1Api;
    private batchApi: k8s.BatchV1Api;

    constructor(
        context: string = "local",
        kubeconfig: string = "~/.kube/config",
    ) {
        this.kc = new k8s.KubeConfig();

        // Configure the client with mTLS authentication
        this.kc.loadFromOptions({
            clusters: [{
                name: "minikube",
                server: `http://host.docker.internal:8001`,
                skipTLSVerify: true,
            }],
            users: [{
                name: "minikube",
            }],
            contexts: [{
                name: "minikube",
                cluster: "minikube",
                user: "minikube",
            }],
            currentContext: "minikube",
        });

        // Create API clients
        this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
        this.batchApi = this.kc.makeApiClient(k8s.BatchV1Api);
    }

    private delay(ms: number) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async watchJobEvents(jobName: string, namespace: string) {
        console.log(
            `Watching events for job '${jobName}' in namespace '${namespace}'...`,
        );

        // Create a watch object for events
        const watch = new k8s.Watch(this.kc);
        const path = `/api/v1/namespaces/${namespace}/events`;

        // Create a promise that we can resolve from outside
        let resolveWatch: () => void;
        const watchPromise = new Promise<void>((resolve) => {
            resolveWatch = resolve;
        });

        // Start watching for events
        const request = await watch.watch(
            path,
            {}, // Query parameters (e.g., fieldSelector, labelSelector)
            (type, apiObj) => {
                console.log(
                    `Job Event [${type}]: ${apiObj.reason} - ${apiObj.message} \n ${
                        JSON.stringify(apiObj)
                    }`,
                );

                // Check if the message contains "weightenumerator"
                if (apiObj.message?.includes("weightenumerator")) {
                    console.log("Found weightenumerator message");
                    resolveWatch();
                }
            },
            (err) => {
                if (err instanceof AbortError) {
                    console.log("Job events watched");
                    return;
                }

                console.error("Error watching job events:", err, typeof err);
                // Reconnect or handle error appropriately in a real application
                if (err.statusCode === 401) {
                    console.error(
                        "Authentication error. Check your KubeConfig permissions.",
                    );
                }
            },
        );

        // Set a timeout to abort the watch after 5 minutes if we don't find the message
        const timeoutId = setTimeout(() => {
            request.abort();
            resolveWatch(); // Resolve anyway to prevent hanging
        }, 5 * 60 * 1000);

        // Wait for either the message or timeout
        await watchPromise;
        clearTimeout(timeoutId);
        request.abort();
    }

    async testConnection(): Promise<void> {
        try {
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
            const versionPromise = this.kc.makeApiClient(k8s.VersionApi)
                .getCode();

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
                        url: this.kc.getCurrentCluster()?.server,
                        context: this.kc.getCurrentContext(),
                        user: this.kc.getCurrentUser()?.name,
                        errorType: error.constructor.name,
                        errorCode: (error as any).code,
                        errorErrno: (error as any).errno,
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
        args: string[],
        config: JobConfig,
    ): Promise<string> {
        const jobName = `planqtn-${jobType}-${Date.now()}`;
        const namespace = "default";

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
                            args: args,
                            resources: {
                                limits: {
                                    memory: config.memoryLimit,
                                    cpu: config.cpuLimit,
                                },
                            },
                        }],
                        restartPolicy: "Never",
                    },
                },
                backoffLimit: 0,
            },
        };

        try {
            console.log("Creating job with namespace:", namespace);
            console.log("Job configuration:", JSON.stringify(job, null, 2));

            const batchApi = this.kc.makeApiClient(k8s.BatchV1Api);

            // Use the raw API client
            const response: k8s.V1Job = await batchApi.createNamespacedJob({
                namespace: namespace,
                body: job,
            });

            console.log(
                "Job created successfully:",
                response.metadata?.name,
            );
            return response.metadata?.name || jobName;
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

    async getJobStatus(
        jobId: string,
    ): Promise<"pending" | "running" | "stopped" | "timed_out" | "oom"> {
        const response = await this.batchApi.readNamespacedJob(
            jobId,
            "default",
        );
        const job = response.body;

        if (!job.status) {
            return "pending";
        }

        if (job.status.failed && job.status.failed > 0) {
            // Check pod events for OOM
            const pods = await this.k8sApi.listNamespacedPod(
                "default",
                undefined,
                undefined,
                undefined,
                undefined,
                `job-name=${jobId}`,
            );

            for (const pod of pods.body.items) {
                const events = await this.k8sApi.listNamespacedEvent(
                    "default",
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    `involvedObject.name=${pod.metadata?.name}`,
                );

                for (const event of events.body.items) {
                    if (event.reason === "OOMKilled") {
                        return "oom";
                    }
                }
            }
            return "stopped";
        }

        if (job.status.succeeded && job.status.succeeded > 0) {
            return "stopped";
        }

        if (job.status.active && job.status.active > 0) {
            return "running";
        }

        return "pending";
    }

    async getJobLogs(jobId: string): Promise<string> {
        const pods = await this.k8sApi.listNamespacedPod(
            "default",
            undefined,
            undefined,
            undefined,
            undefined,
            `job-name=${jobId}`,
        );

        if (pods.body.items.length === 0) {
            throw new Error("No pods found for job");
        }

        const podName = pods.body.items[0].metadata?.name;
        if (!podName) {
            throw new Error("Pod name not found");
        }

        const response = await this.k8sApi.readNamespacedPodLog(
            podName,
            "default",
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            true,
        );

        return response.body;
    }
}
