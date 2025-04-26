import time
import traceback
from celery import Celery
from celery.utils.log import get_task_logger
import os

# Get Redis URL from environment variable or use default
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "mytasks",
    broker=REDIS_URL,
    backend=REDIS_URL,
    broker_connection_retry_on_startup=True,
    loglevel="INFO",
)

# Configure Celery
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

logger = get_task_logger(__name__)


@celery_app.task(bind=True)
def long_running_task(self, user_id, params):
    print("HELLO", self.request.id)
    try:
        for i in range(100):

            # Simulate work
            time.sleep(1)
            print(
                f"progress {i} of 100 for task with user_id {user_id} and params {params}"
            )
            # Update progress
            self.update_state(
                state="PROGRESS",
                meta={"current": i, "total": 100, "user_id": user_id, "params": params},
            )
        return {"status": "completed", "message": "Task completed successfully"}
    except Exception as e:
        print("error", e)
        traceback.print_exc()
        return {"status": "failed", "message": str(e)}
