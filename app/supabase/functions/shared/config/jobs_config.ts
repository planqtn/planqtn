export interface JobConfig {
  image: string;
  timeout: number; // in seconds
  memoryLimitDefault: string;
  cpuLimitDefault: string;
}

const jobsImage =
  Deno.env.get("JOBS_IMAGE") ||
  (() => {
    throw new Error("JOBS_IMAGE is not set");
  })();

export const JOBS_CONFIG: Record<string, JobConfig> = {
  weightenumerator: {
    image: jobsImage,
    timeout: 300, // 5 minutes
    memoryLimitDefault: "4Gi",
    cpuLimitDefault: "1"
  },

  "job-monitor": {
    image: jobsImage,
    timeout: 360, // 6 minutes
    memoryLimitDefault: "1Gi",
    cpuLimitDefault: "1"
  }
};
