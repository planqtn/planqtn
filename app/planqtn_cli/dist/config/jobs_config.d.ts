export interface JobConfig {
    image: string;
    timeout: number;
    memoryLimit: string;
    cpuLimit: string;
}
export declare const JOBS_CONFIG: Record<string, JobConfig>;
