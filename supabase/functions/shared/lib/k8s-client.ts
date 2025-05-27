import * as k8s from "npm:@kubernetes/client-node";
import { JobConfig } from "../config/jobs_config.ts";

export class K8sClient {
    private kc: k8s.KubeConfig;
    private k8sApi: k8s.CoreV1Api;
    private batchApi: k8s.BatchV1Api;

    constructor() {
        this.kc = new k8s.KubeConfig();

        // Configure the client with mTLS authentication
        this.kc.loadFromOptions({
            clusters: [{
                name: "k3d-planqtn",
                server: `http://k8sproxy:8001`,
                skipTLSVerify: true,
            }],

            contexts: [{
                name: "k3d-planqtn",
                cluster: "k3d-planqtn",
                user: "admin@k3d-planqtn",
            }],
            currentContext: "k3d-planqtn",
        });

        // Create API clients
        this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
        this.batchApi = this.kc.makeApiClient(k8s.BatchV1Api);
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
                        errorCode: (error as unknown as { code: number }).code,
                        errorErrno:
                            (error as unknown as { errno: number }).errno,
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
                                    memory: config.memoryLimit,
                                    cpu: config.cpuLimit,
                                },
                            },
                            env: envVars,
                        }],
                        restartPolicy: "Never",
                    },
                },
                backoffLimit: 0,
            },
        };

        if (serviceAccountName) {
            job.spec.template.spec.serviceAccountName = serviceAccountName;
        }

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
            {
                namespace: "default",
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

        const response = await this.k8sApi.readNamespacedPodLog(
            {
                name: podName,
                namespace: "default",
            },
        );
        return response;
    }

    async deleteJob(jobId: string): Promise<void> {
        try {
            // Delete the job
            await this.batchApi.deleteNamespacedJob({
                name: jobId,
                namespace: "default",
                propagationPolicy: "Background",
            });

            // Also delete any associated pods
            const pods = await this.k8sApi.listNamespacedPod({
                namespace: "default",
                labelSelector: `job-name=${jobId}`,
            });

            for (const pod of pods.items) {
                if (pod.metadata?.name) {
                    await this.k8sApi.deleteNamespacedPod({
                        name: pod.metadata.name,
                        namespace: "default",
                    });
                }
            }
        } catch (error) {
            console.error("Error deleting job:", error);
            throw new Error(`Failed to delete job: ${error}`);
        }
    }
}
