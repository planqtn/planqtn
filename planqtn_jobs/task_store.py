import abc
import json
import traceback
from typing import Dict, Any, Optional
from celery import Task
import redis
import requests
from datetime import datetime

import supabase

from qlego.progress_reporter import IterationStateEncoder

from logging import getLogger

logger = getLogger(__name__)


class TaskStore(abc.ABC):
    @abc.abstractmethod
    def add_task(self, task: Task, user_id: str | None = None):
        pass

    @abc.abstractmethod
    def store_task_result(self, task_id: str, result: Any, user_id: str | None = None):
        pass

    @abc.abstractmethod
    def update_task(
        self, task_id: str, updates: Dict[str, Any], user_id: str | None = None
    ):
        pass


class SupabaseTaskStore(TaskStore):
    def __init__(self, supabase_url: str, supabase_key: str):
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.supabase = supabase.create_client(supabase_url, supabase_key)

    def add_task(self, task: Task, user_id: str | None = None):
        logger.info(
            "adding task to supabase", task.request.id, task.request.args, user_id
        )

        self.supabase.table("tasks").insert(
            {"uuid": task.request.id, "args": task.request.args, "user_id": user_id}
        ).execute()

        logger.info(
            "task added to supabase", task.request.id, task.request.args, user_id
        )

    def store_task_result(self, task_id: str, result: Any, user_id: str | None = None):
        self.supabase.table("tasks").update({"result": result}).eq("id", task_id).eq(
            "user_id", user_id
        ).execute()

    def update_task(
        self, task_id: str, updates: Dict[str, Any], user_id: str | None = None
    ):

        self.supabase.table("tasks").update(
            {"updates": json.dumps(updates, cls=IterationStateEncoder)}
        ).eq("uuid", task_id).eq("user_id", user_id).execute()


class RedisTaskStore(TaskStore):
    def __init__(
        self,
        redis_url: str = "redis://localhost:6379/0",
        flower_url: str = "http://localhost:5555",
    ):
        self.redis_url = redis_url
        self.redis = redis.from_url(redis_url)
        self.redis_async = redis.asyncio.from_url(redis_url)
        self.flower_url = flower_url

    def add_task(self, task: Task, user_id: str | None = None):
        """Add a task to Redis"""
        self.redis.hset(
            name=f"task_details",
            key=task.request.id,
            value=json.dumps({"task": task.request.task, "args": task.request.args}),
        )

    def store_task_result(self, task_id: str, result: Any, user_id: str | None = None):
        """Store the result of a task"""
        current_task_details = json.loads(self.get_task_details(task_id))
        current_task_details["result"] = result
        self.redis.hset(
            name=f"task_details",
            key=task_id,
            value=json.dumps(current_task_details),
        )

    def get_task_details(self, task_id: str, user_id: str | None = None) -> str:
        """Get task data by ID from Redis"""
        try:
            task_details = self.redis.hget(name=f"task_details", key=task_id)
            if task_details:
                return task_details.decode("utf-8")
            return None
        except requests.RequestException:
            return None

    def update_task(
        self, task_id: str, updates: Dict[str, Any], user_id: str | None = None
    ):
        """Update task status and other fields"""
        n_subscribers = self.redis.publish(
            f"task_updates_{task_id}",
            json.dumps({"updates": updates}, cls=IterationStateEncoder),
        )

    def get_all_tasks(self) -> Dict[str, Dict[str, Any]]:
        """Get all tasks from Flower API"""
        try:
            response = requests.get(f"{self.flower_url}/api/tasks")
            if response.status_code == 200:
                tasks = json.loads(response.text)
                print("tasks", type(tasks), tasks)
                for _, task in tasks.items():
                    task_details = json.loads(self.get_task_details(task["uuid"]))
                    task["args"] = task_details["args"]
                    if "traceback" in task:
                        del task["traceback"]
                    if (
                        "exception" in task
                        and task["exception"] is not None
                        and task["exception"] != ""
                    ):
                        task["exception"] = "Server error"
                    if "result" in task and task["result"] == "SUCCESS":
                        task["result"] = task_details["result"]
                return tasks
            return {}
        except requests.RequestException as e:
            print("Error fetching tasks from Flower API:", e)
            traceback.print_exc()
            return {}

    def clear_all_task_details(self):
        """Clear all tasks from Redis"""
        self.redis.delete("task_details")
