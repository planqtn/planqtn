from abc import ABC, abstractmethod
from dataclasses import dataclass
import json
import logging
import sys
import time
from typing import Any, Dict, TextIO

from pydantic import BaseModel

from planqtn_jobs.task_store import SupabaseTaskStore, TaskStore
from qlego.progress_reporter import (
    DummyProgressReporter,
    ProgressReporter,
    TqdmProgressReporter,
)


@dataclass
class SupabaseCredentials:
    url: str
    key: str


class TaskStoreProgressReporter(ProgressReporter):
    def __init__(
        self,
        task: "Task",
        task_store: TaskStore,
        sub_reporter: ProgressReporter = None,
        iteration_report_frequency: float = 1.0,
        user_id: str | None = None,
    ):
        self.task = task
        self.start_time = time.time()
        self.task_store = task_store
        self.user_id = user_id
        self.logger = logging.getLogger(self.__class__.__name__)

        super().__init__(sub_reporter, iteration_report_frequency)

    def __enter__(self):

        self.sub_reporter.__enter__()

        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.sub_reporter.__exit__(exc_type, exc_value, traceback)

        if exc_type is not None:
            self.task_store.update_task(
                self.task.request.id,
                {"state": 3, "result": str(exc_value)},
                user_id=self.user_id,
            )

    def handle_result(self, result: Dict[str, Any]):
        self.task_store.update_task(
            self.task.request.id,
            {"state": 1, "iteration_status": self.iterator_stack},
            user_id=self.user_id,
        )


class Task[ArgsType: BaseModel, ResultType: BaseModel](ABC):

    def __init__(
        self,
        uuid: str,
        realtime_updates_enabled: bool = True,
        realtime_update_frequency: float = 5,
        realtime_publisher: SupabaseCredentials = None,
        local_progress_bar: bool = True,
    ):
        self.realtime_updates_enabled = realtime_updates_enabled
        self.realtime_update_frequency = realtime_update_frequency
        self.realtime_publisher = realtime_publisher
        self.local_progress_bar = local_progress_bar
        self.args = None

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

        if self.realtime_publisher is not None:
            return TaskStoreProgressReporter(
                self.realtime_publisher.url,
                self.realtime_publisher.key,
                sub_reporter=local_reporter,
                iteration_report_frequency=max(self.realtime_update_frequency, 5),
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
            return self.__execute__(self.args, progress_reporter)

    @abstractmethod
    def __load_args_from_json__(self, json_data: str) -> ArgsType:
        pass

    def initalize_args_from_file(self, file_path: str) -> ArgsType:
        """Load a WeightEnumeratorRequest from a JSON file."""
        with open(file_path, "r") as f:
            data = json.load(f)
        self.args = self.__load_args_from_json__(data)
        return self.args

    def initalize_args_from_supabase(
        self, task_uuid: str, task_store: SupabaseTaskStore
    ) -> ArgsType:
        """Load a WeightEnumeratorRequest from Supabase tasks table."""
        task_data = task_store.get_task(task_uuid)
        if not task_data:
            raise ValueError(f"Task {task_uuid} not found in Supabase")
        self.args = self.__load_args_from_json__(task_data["args"])
        return self.args
