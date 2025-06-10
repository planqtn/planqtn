export interface JobLogsRequest {
  task_uuid: string;
}

export interface JobLogsResponse {
  logs: string;
}

export type JobType = "weightenumerator" | "qdistrnd" | "dummy";

export interface JobRequest {
  user_id: string;
  job_type: JobType;
  request_time: string; // ISO timestamp with timezone
  task_store_url: string;
  task_store_anon_key: string;
  payload: Record<string, unknown>; // Job-specific payload
  memory_limit?: string;
  cpu_limit?: string;
}

export interface JobResponse {
  task_id: string;
  error?: string;
}

// Job-specific payload types
export interface WeightEnumeratorPayload {
  input_file: string;
  // Add other weightenumerator specific fields
}

export interface QDistRndPayload {
  // Add qdistrnd specific fields
}
