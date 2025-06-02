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
const k8s = __importStar(require("@kubernetes/client-node"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
class K8sClient {
    constructor(context = "local") {
        this.kc = new k8s.KubeConfig();
        // Use KUBECONFIG environment variable or default to ~/.kube/config
        const kubeconfig = process.env.KUBECONFIG ||
            path.join(os.homedir(), ".kube", "config");
        if (!fs.existsSync(kubeconfig)) {
            throw new Error(`Kubernetes config not found at ${kubeconfig}.\n` +
                "Please ensure you have set up your kind cluster and have access to the kubeconfig.");
        }
        try {
            this.kc.loadFromFile(kubeconfig);
            // For local environment, use the kind-planqtn context
            if (context === "local") {
                const kindContext = "kind-planqtn";
                if (this.kc.getContexts().some((ctx) => ctx.name === kindContext)) {
                    this.kc.setCurrentContext(kindContext);
                }
                else {
                    throw new Error(`Kind context '${kindContext}' not found in kubeconfig.\n` +
                        "Please ensure your kind cluster is running and properly configured.");
                }
            }
            else {
                this.kc.setCurrentContext(context);
            }
        }
        catch (error) {
            throw new Error(`Failed to load Kubernetes config from ${kubeconfig}.\n` +
                "Please ensure you have proper permissions and the config is valid.\n" +
                "You can check your kind cluster status with:\n" +
                "kind get clusters\n" +
                "kubectl cluster-info --context kind-planqtn");
        }
        this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
        this.batchApi = this.kc.makeApiClient(k8s.BatchV1Api);
    }
    async createJob(jobType, args, config) {
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
        const response = await this.batchApi.createNamespacedJob("default", job);
        return response.body.metadata?.name || jobName;
    }
    async getJobStatus(jobId) {
        const response = await this.batchApi.readNamespacedJob(jobId, "default");
        const job = response.body;
        if (!job.status) {
            return "pending";
        }
        if (job.status.failed && job.status.failed > 0) {
            // Check pod events for OOM
            const pods = await this.k8sApi.listNamespacedPod("default", undefined, undefined, undefined, undefined, `job-name=${jobId}`);
            for (const pod of pods.body.items) {
                const events = await this.k8sApi.listNamespacedEvent("default", undefined, undefined, undefined, undefined, `involvedObject.name=${pod.metadata?.name}`);
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
    async getJobLogs(jobId) {
        const pods = await this.k8sApi.listNamespacedPod("default", undefined, undefined, undefined, undefined, `job-name=${jobId}`);
        if (pods.body.items.length === 0) {
            throw new Error("No pods found for job");
        }
        const podName = pods.body.items[0].metadata?.name;
        if (!podName) {
            throw new Error("Pod name not found");
        }
        const response = await this.k8sApi.readNamespacedPodLog(podName, "default", undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, true);
        return response.body;
    }
}
exports.K8sClient = K8sClient;
