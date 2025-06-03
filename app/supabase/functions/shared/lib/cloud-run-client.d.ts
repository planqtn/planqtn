import { JobConfig } from "../config/jobs_config.ts";
import { IdTokenClient } from "npm:google-auth-library@9.15.1";
interface CloudRunOperation {
    name: string;
    done?: boolean;
    error?: {
        code: number;
        message: string;
        details: any[];
    };
    response?: any;
    metadata?: CloudRunExecution | any;
}
interface CloudRunExecution {
    name: string;
    uid: string;
    generation: string;
    labels?: Record<string, string>;
    createTime: string;
    startTime?: string;
    completionTime?: string;
    logUri?: string;
    job?: string;
    parallelism?: number;
    taskCount?: number;
    template?: any;
    conditions?: Array<{
        type: string;
        state: string;
        message?: string;
        lastTransitionTime: string;
        executionReason?: string;
        reason?: string;
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
export declare const cloudRunHeaders: (backendUrl: string) => Promise<any>;
export declare function getIdTokenClientForCloudRun(audience: string): Promise<IdTokenClient>;
export declare class CloudRunClient {
    private projectId;
    private location;
    private googleAuth;
    constructor(projectId: string, location: string);
    createJob(jobType: string, command: string[], args: string[], config: JobConfig, serviceAccountName?: string, postfix?: string, env?: Record<string, string>): Promise<string>;
    pollLRO(lroName: string, maxAttempts?: number, delayMs?: number): Promise<CloudRunOperation>;
    private getShortExecutionId;
    getJobLogs(lroName: string, defaultJobNameForFilter?: string): Promise<string>;
    cancelJob(lroName: string): Promise<void>;
}
export {};
