import { JobConfig } from "../config/jobs_config";
export declare class K8sClient {
    private kc;
    private k8sApi;
    private batchApi;
    constructor(context?: string);
    createJob(jobType: string, args: string[], config: JobConfig): Promise<string>;
    getJobStatus(jobId: string): Promise<"pending" | "running" | "stopped" | "timed_out" | "oom">;
    getJobLogs(jobId: string): Promise<string>;
}
