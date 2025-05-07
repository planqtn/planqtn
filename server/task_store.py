import json
import time
import traceback
from typing import Dict, Any, Optional
from celery import Task
import redis
import requests
from datetime import datetime

from qlego.progress_reporter import IterationStateEncoder


class TaskStore:
    def __init__(
        self,
        redis_url: str = "redis://localhost:6379/0",
        flower_url: str = "http://localhost:5555",
    ):
        self.redis_url = redis_url
        self.redis = redis.from_url(redis_url)
        self.redis_async = redis.asyncio.from_url(redis_url)
        self.flower_url = flower_url

    def add_task(self, task: Task):
        """Add a task to Redis"""
        self.redis.hset(
            name=f"task_details",
            key=task.request.id,
            value=json.dumps({"task": task.request.task, "args": task.request.args}),
        )

    def store_task_result(self, task_id: str, result: Any):
        """Store the result of a task"""
        current_task_details = json.loads(self.get_task_details(task_id))
        current_task_details["result"] = result
        self.redis.hset(
            name=f"task_details",
            key=task_id,
            value=json.dumps(current_task_details),
        )

    def get_task_details(self, task_id: str) -> str:
        """Get task data by ID from Redis"""
        try:
            task_details = self.redis.hget(name=f"task_details", key=task_id)
            if task_details:
                return task_details.decode("utf-8")
            return None
        except requests.RequestException:
            return None

    def get_all_tasks(self) -> Dict[str, Dict[str, Any]]:
        """Get all tasks from Flower API"""
        try:
            response = requests.get(f"{self.flower_url}/api/tasks")
            if response.status_code == 200:
                tasks = json.loads(response.text)
                print("tasks", type(tasks), tasks)
                for _, task in tasks.items():
                    task_details = self.get_task_details(task["uuid"])
                    task["args"] = json.loads(task_details)["args"]
                return tasks
            return {}
        except requests.RequestException as e:
            print("Error fetching tasks from Flower API:", e)
            traceback.print_exc()
            return {}

    def update_task(self, task_id: str, updates: Dict[str, Any]):
        """Update task status and other fields"""
        n_subscribers = self.redis.publish(
            f"task_updates_{task_id}",
            json.dumps({"updates": updates}, cls=IterationStateEncoder),
        )

    def clear_all_task_details(self):
        """Clear all tasks from Redis"""
        self.redis.delete("task_details")
