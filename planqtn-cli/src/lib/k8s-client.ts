import * as k8s from "@kubernetes/client-node";
import { JobConfig } from "../config/jobs_config";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as yaml from "js-yaml";

export class K8sClient {
    private kc: k8s.KubeConfig;
    private k8sApi: k8s.CoreV1Api;
    private batchApi: k8s.BatchV1Api;

    constructor(context: string = "local") {
        this.kc = new k8s.KubeConfig();

        // Use KUBECONFIG environment variable or default to ~/.kube/config
        const kubeconfig = process.env.KUBECONFIG ||
            path.join(os.homedir(), ".kube", "config");

        if (!fs.existsSync(kubeconfig)) {
            throw new Error(
                `Kubernetes config not found at ${kubeconfig}.\n` +
                    "Please ensure you have set up your kind cluster and have access to the kubeconfig.",
            );
        }

        try {
            this.kc.loadFromFile(kubeconfig);

            // For local environment, use the kind-planqtn context
            if (context === "local") {
                const kindContext = "kind-planqtn";
                if (
                    this.kc.getContexts().some((ctx) =>
                        ctx.name === kindContext
                    )
                ) {
                    this.kc.setCurrentContext(kindContext);
                } else {
                    throw new Error(
                        `Kind context '${kindContext}' not found in kubeconfig.\n` +
                            "Please ensure your kind cluster is running and properly configured.",
                    );
                }
            } else {
                this.kc.setCurrentContext(context);
            }
        } catch (error) {
            throw new Error(
                `Failed to load Kubernetes config from ${kubeconfig}.\n` +
                    "Please ensure you have proper permissions and the config is valid.\n" +
                    "You can check your kind cluster status with:\n" +
                    "kind get clusters\n" +
                    "kubectl cluster-info --context kind-planqtn",
            );
        }

        this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
        this.batchApi = this.kc.makeApiClient(k8s.BatchV1Api);
    }

    async createJob(
        jobType: string,
        args: string[],
        config: JobConfig,
    ): Promise<string> {
        const jobName = `planqtn-${jobType}-${Date.now()}`;

        const job = {
            apiVersion: "batch/v1",
            kind: "Job",
            metadata: {
                name: jobName,
                namespace: "default",
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

        const response = await this.batchApi.createNamespacedJob(
            "default",
            job,
        );
        return response.body.metadata?.name || jobName;
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
