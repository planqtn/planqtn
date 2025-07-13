export enum PauliOperator {
  X = "X",
  Z = "Z",
  Y = "Y",
  I = "I"
}

export interface TaskUpdateIterationStatus {
  desc: string;
  total_size: number;
  current_item: number;
  start_time: number;
  end_time: number | null;
  duration: number;
  avg_time_per_item: number;
}

export interface TaskUpdate {
  updates: {
    state: number;
    iteration_status: Array<TaskUpdateIterationStatus>;
  };
}

export interface Task {
  uuid: string;
  user_id: string;
  sent_at: string;
  started_at: string | null;
  ended_at: string | null;
  args: string;
  state: number;
  result: string | null;
  execution_id: string;
  job_type: string;
}
