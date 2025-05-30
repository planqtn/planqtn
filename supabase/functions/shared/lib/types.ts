export interface JobLogsRequest {
  task_uuid: string;
}

export interface JobLogsResponse {
  logs: string;
}
