export type JobType = "weightenumerator" | "qdistrnd";

export interface JobRequest {
  user_id: string;
  job_type: JobType;
  request_time: string; // ISO timestamp with timezone
  payload: Record<string, unknown>; // Job-specific payload
}

export interface JobResponse {
  task_id: string;
  execution_id?: string;
  state: number; // 0: pending, 1: running, 2: completed, 3: failed
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
