export interface JobConfig {
    image: string;
    timeout: number; // in seconds
    memoryLimit: string;
    cpuLimit: string;
}

export const JOBS_CONFIG: Record<string, JobConfig> = {
    weightenumerator: {
        image: "balopat/planqtn_jobs:9adb06a-dirty",
        timeout: 3600, // 1 hour
        memoryLimit: "4Gi",
        cpuLimit: "2",
    },

    "job-monitor": {
        image: "balopat/planqtn_jobs:ec3e6a7-dirty",
        timeout: 3600, // 1 hour
        memoryLimit: "4Gi",
        cpuLimit: "2",
    },
};
