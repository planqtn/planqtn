from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
import json
import logging
import sys
import time
from typing import Any, Dict, Optional

from pydantic import BaseModel
import supabase
import supabase.client

from planqtn.progress_reporter import (
    DummyProgressReporter,
    IterationStateEncoder,
    ProgressReporter,
    TqdmProgressReporter,
)


@dataclass
class SupabaseCredentials:
    url: str
    user_key: str = None
    anon_key: str = None
    service_role_key: str = None

    def createClient(self):
        if self.user_key and self.anon_key:
            return supabase.create_client(
                self.url,
                self.anon_key,
                options=supabase.ClientOptions(
                    headers={"Authorization": f"Bearer {self.user_key}"}
                ),
            )
        elif self.service_role_key:
            return supabase.create_client(
                self.url,
                self.service_role_key,
            )
        elif self.anon_key:
            return supabase.create_client(
                self.url,
                self.anon_key,
            )
        else:
            raise ValueError(
                "Either user_key or service_role_key or anon_key must be provided"
            )


class TaskStoreProgressReporter(ProgressReporter):
    def __init__(
        self,
        task: "Task",
        task_store: "SupabaseTaskStore",
        sub_reporter: ProgressReporter = None,
        iteration_report_frequency: float = 1.0,
    ):
        self.task = task
        self.start_time = time.time()
        self.task_store = task_store
        self.logger = logging.getLogger(self.__class__.__name__)

        super().__init__(sub_reporter, iteration_report_frequency)

    def __enter__(self):

        self.sub_reporter.__enter__()
        self.task_store.start_task_updates(self.task.task_details)

        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.sub_reporter.__exit__(exc_type, exc_value, traceback)

        if exc_type is not None:
            self.task_store.store_task_result(
                self.task.task_details,
                str(exc_value),
                TaskState.FAILED,
            )

    def handle_result(self, result: Dict[str, Any]):
        self.task_store.send_task_update(
            self.task.task_details,
            {"state": 1, "iteration_status": self.iterator_stack},
        )


class TaskDetails(BaseModel):
    user_id: Optional[str] = None
    uuid: Optional[str] = None
    input_file: Optional[str] = None
    output_file: Optional[str] = None
    execution_id: Optional[str] = None


class Task[ArgsType: BaseModel, ResultType: BaseModel](ABC):

    def __init__(
        self,
        task_details: TaskDetails,
        task_store: "SupabaseTaskStore",
        local_progress_bar: bool = True,
        realtime_updates_enabled: bool = True,
        realtime_update_frequency: float = 5,
        debug: bool = False,
    ):
        self.task_details = task_details
        self.task_store = task_store
        self.local_progress_bar = local_progress_bar
        self.args = None
        self.realtime_updates_enabled = realtime_updates_enabled
        self.realtime_update_frequency = realtime_update_frequency
        self.debug = debug

        if self.task_details.input_file:
            self.args = self._initalize_args_from_file(self.task_details.input_file)
        elif self.task_details.uuid and self.task_details.uuid:
            self.args = self._initalize_args_from_supabase()
        else:
            raise ValueError("Either file_path or uuid must be provided")

    def get_progress_reporter(self) -> ProgressReporter:
        if not self.realtime_updates_enabled and not self.local_progress_bar:
            return DummyProgressReporter()

        local_reporter = (
            TqdmProgressReporter(
                file=sys.stdout, mininterval=self.realtime_update_frequency
            )
            if self.local_progress_bar
            else DummyProgressReporter()
        )

        if self.task_store:
            return TaskStoreProgressReporter(
                task=self,
                task_store=self.task_store,
                sub_reporter=local_reporter,
                iteration_report_frequency=self.realtime_update_frequency,
            )
        else:
            return local_reporter

    @abstractmethod
    def __execute__(
        self, args: ArgsType, progress_reporter: ProgressReporter
    ) -> ResultType:
        pass

    def run(self) -> ResultType:
        with self.get_progress_reporter() as progress_reporter:
            res = self.__execute__(self.args, progress_reporter)

            if self.task_details.output_file:
                with open(self.task_details.output_file, "w") as f:
                    f.write(res.model_dump_json())
            else:
                print(res)

            if self.task_details.uuid:
                self.task_store.store_task_result(
                    self.task_details, res.model_dump_json(), TaskState.COMPLETED
                )
                self.task_store.send_task_update(
                    self.task_details, {"state": TaskState.COMPLETED.value}
                )
            return res

    @abstractmethod
    def __load_args_from_json__(self, json_data: str) -> ArgsType:
        pass

    def _initalize_args_from_file(self, file_path: str) -> ArgsType:
        """Load a WeightEnumeratorRequest from a JSON file."""
        with open(file_path, "r") as f:
            data = json.load(f)
        return self.__load_args_from_json__(data)

    def _initalize_args_from_supabase(self) -> ArgsType:
        """Load a WeightEnumeratorRequest from Supabase tasks table."""
        task_data = self.task_store.get_task(self.task_details)
        if not task_data:
            raise ValueError(f"Task {self.task_details.uuid} not found in Supabase")
        return self.__load_args_from_json__(task_data["args"])


class TaskState(Enum):
    PENDING = 0
    RUNNING = 1
    COMPLETED = 2
    FAILED = 3
    CANCELLED = 4


class SupabaseTaskStore:
    def __init__(
        self,
        task_db_credentials: SupabaseCredentials,
        task_updates_db_credentials: SupabaseCredentials = None,
    ):
        self.task_db = task_db_credentials.createClient()

        self.task_updates_db = None
        if task_updates_db_credentials:
            self.task_updates_db = task_updates_db_credentials.createClient()

    def start_task_updates(self, task: TaskDetails):
        if not self.task_updates_db:
            return

        self.send_task_update(task, {"state": 1})

    def store_task_result(self, task: TaskDetails, result: Any, state: TaskState):
        res = (
            self.task_db.table("tasks")
            .update({"result": result, "state": state.value}, count="exact")
            .eq("uuid", task.uuid)
            .eq("user_id", task.user_id)
            .execute()
        )
        if res.count != 1:
            raise Exception(f"Failed to store task result: {res}")

    def send_task_update(self, task: TaskDetails, updates: Dict[str, Any]):
        if not self.task_updates_db:
            print("No task updates db, returning None")
            return None
        print(
            f"Sending task update: {updates} for task {task.uuid} with user {task.user_id}"
        )
        res = (
            self.task_updates_db.table("task_updates")
            .update(
                {"updates": json.dumps(updates, cls=IterationStateEncoder)},
                count="exact",
            )
            .eq("uuid", task.uuid)
            .eq("user_id", task.user_id)
            .execute()
        )
        if res.count != 1:
            raise Exception(f"Failed to send task update: {res}")
        return res

    def get_task(self, task: TaskDetails) -> Dict[str, Any]:
        task_data = (
            self.task_db.table("tasks")
            .select("*")
            .eq("uuid", task.uuid)
            .eq("user_id", task.user_id)
            .execute()
            .data
        )
        print(f"Task data: {task_data}")
        if not task_data:
            return None

        return task_data[0]
