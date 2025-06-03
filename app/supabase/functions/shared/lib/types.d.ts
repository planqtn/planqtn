export interface JobLogsRequest {
    task_uuid: string;
}
export interface JobLogsResponse {
    logs: string;
}
export type JobType = "weightenumerator" | "qdistrnd";
export interface JobRequest {
    user_id: string;
    job_type: JobType;
    request_time: string;
    task_store_url: string;
    task_store_anon_key: string;
    payload: Record<string, unknown>;
}
export interface JobResponse {
    task_id: string;
    error?: string;
}
export interface WeightEnumeratorPayload {
    input_file: string;
}
export interface QDistRndPayload {
}
