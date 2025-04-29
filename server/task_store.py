import json
import time
from typing import Callable, Dict, Any, Optional
import redis
from datetime import datetime

from qlego.progress_reporter import IterationStateEncoder


class TaskStore:
    def __init__(self, redis_url: str = "redis://localhost:6379/0"):
        self.redis = redis.from_url(redis_url)
        self.redis_async = redis.asyncio.from_url(redis_url)
        self.task_list_key = "weight_enumerator_tasks"
        self.max_tasks = 1000  # Keep last 1000 tasks

    def clear_all(self):
        """Clear all task data when server starts"""
        self.redis.delete(self.task_list_key)

    def add_task(self, task_id: str, task_data: Dict[str, Any]):
        """Add a new task to the list"""
        task_data["created_at"] = datetime.now().isoformat()
        self.redis.hset(self.task_list_key, task_id, json.dumps(task_data))
        # Trim old tasks if needed
        if self.redis.hlen(self.task_list_key) > self.max_tasks:
            # Get all tasks and sort by creation time
            tasks = self.redis.hgetall(self.task_list_key)
            sorted_tasks = sorted(
                [(k, json.loads(v)) for k, v in tasks.items()],
                key=lambda x: x[1]["created_at"],
            )
            # Remove oldest tasks
            for k, _ in sorted_tasks[: len(sorted_tasks) - self.max_tasks]:
                self.redis.hdel(self.task_list_key, k)

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get task data by ID"""
        data = self.redis.hget(self.task_list_key, task_id)
        return json.loads(data) if data else None

    def get_all_tasks(self) -> Dict[str, Dict[str, Any]]:
        """Get all tasks"""
        tasks = self.redis.hgetall(self.task_list_key)
        return {k.decode(): json.loads(v) for k, v in tasks.items()}

    def update_task(self, task_id: str, updates: Dict[str, Any]):
        """Update task status and other fields"""
        n_subscribers = self.redis.publish(
            f"task_updates_{task_id}",
            json.dumps({"updates": updates}, cls=IterationStateEncoder),
        )
        # print(f"Updated task {task_id} and notified {n_subscribers} subscribers")
