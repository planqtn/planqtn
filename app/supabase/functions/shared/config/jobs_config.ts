export interface JobConfig {
    image: string;
    timeout: number; // in seconds
    memoryLimit: string;
    cpuLimit: string;
}

export const JOBS_CONFIG: Record<string, JobConfig> = {
    weightenumerator: {
        image: "planqtn/planqtn_jobs:e66b90c",
        timeout: 3600, // 1 hour
        memoryLimit: "4Gi",
        cpuLimit: "2",
    },

    "job-monitor": {
        image: "planqtn/planqtn_jobs:e66b90c",
        timeout: 3600, // 1 hour
        memoryLimit: "1Gi",
        cpuLimit: "1",
    },
};
