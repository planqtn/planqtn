export interface JobConfig {
    image: string;
    timeout: number; // in seconds
    memoryLimitDefault: string;
    cpuLimitDefault: string;
}

export const JOBS_CONFIG: Record<string, JobConfig> = {
    weightenumerator: {
        image: "planqtn/planqtn_jobs:fec6fe6",
        timeout: 3600, // 1 hour
        memoryLimitDefault: "4Gi",
        cpuLimitDefault: "1",
    },

    "job-monitor": {
        image: "planqtn/planqtn_jobs:fec6fe6",
        timeout: 3600, // 1 hour
        memoryLimitDefault: "1Gi",
        cpuLimitDefault: "1",
    },
};
