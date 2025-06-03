import { JobConfig } from "../config/jobs_config.ts";
export declare class K8sClient {
    private kc?;
    private k8sApi?;
    private batchApi?;
    private env;
    private restClient?;
    constructor();
    loadConfig(): Promise<void>;
    connect(): Promise<void>;
    createJob(jobType: string, command: string[], args: string[], config: JobConfig, serviceAccountName?: string, postfix?: string, env?: Record<string, string>): Promise<string>;
    getJobLogs(jobId: string): Promise<string>;
    deleteJob(jobId: string): Promise<void>;
}
