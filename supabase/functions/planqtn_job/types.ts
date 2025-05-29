export type JobType = "weightenumerator" | "qdistrnd";

export interface JobRequest {
  user_id: string;
  job_type: JobType;
  request_time: string; // ISO timestamp with timezone
  task_store_url: string;
  payload: Record<string, unknown>; // Job-specific payload
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
