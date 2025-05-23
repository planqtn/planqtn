#!/usr/bin/env python3

import os
import sys
import time
import traceback
from typing import Optional
from kubernetes import client, config
from supabase import create_client, Client
import logging

from planqtn_jobs.task import (
    SupabaseCredentials,
    SupabaseTaskStore,
    TaskDetails,
    TaskState,
)

# Set up logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class JobMonitor:
    def __init__(
        self,
        job_name: str,
        task_uuid: str,
        user_id: str,
        supabase_url: str,
        supabase_key: str,
    ):
        self.job_name = job_name
        self.task_details = TaskDetails(
            user_id=user_id,
            uuid=task_uuid,
        )
        self.namespace = "default"

        # Initialize Supabase client
        self.task_store = SupabaseTaskStore(
            task_db_credentials=SupabaseCredentials(url=supabase_url, key=supabase_key)
        )

        # Load in-cluster configuration
        try:
            config.load_incluster_config()
            logger.info("Loaded in-cluster configuration")
        except config.ConfigException:
            logger.error("Failed to load in-cluster configuration")
            sys.exit(1)

        # Initialize Kubernetes clients
        self.batch_api = client.BatchV1Api()
        self.core_api = client.CoreV1Api()

        # Track the last known state
        self.last_state: Optional[str] = None

    def get_job_status(self) -> str:
        """Get the current status of the monitored job."""
        try:
            job = self.batch_api.read_namespaced_job(self.job_name, self.namespace)

            if not job.status:
                return "pending"

            if job.status.failed and job.status.failed > 0:
                # Check pod events for OOM
                pods = self.core_api.list_namespaced_pod(
                    self.namespace, label_selector=f"job-name={self.job_name}"
                )

                for pod in pods.items:
                    events = self.core_api.list_namespaced_event(
                        self.namespace,
                        field_selector=f"involvedObject.name={pod.metadata.name}",
                    )

                    for event in events.items:
                        if event.reason == "OOMKilled":
                            return "oom"
                return "stopped"

            if job.status.succeeded and job.status.succeeded > 0:
                return "stopped"

            if job.status.active and job.status.active > 0:
                return "running"

            return "pending"

        except Exception as e:
            logger.error(f"Error getting job status: {e}")
            return "error"

    def update_task_state(self, state: str):
        """Update the task state in Supabase."""
        try:
            if state != "stopped":
                logger.info(f"Task {self.task_uuid} failed, storing result")
                self.task_store.store_task_result(
                    task=self.task_details,
                    result=state,
                    state=TaskState.FAILED,
                )
            else:
                logger.info(f"Task {self.task_uuid} completed successfully")
        except Exception as e:
            logger.error(f"Error updating task state: {e}")
            traceback.print_exc()

    def monitor(self):
        """Monitor the job and update task state when it changes."""
        logger.info(f"Starting to monitor job {self.job_name}")

        while True:
            current_state = self.get_job_status()

            # Update state if it has changed
            if current_state != self.last_state:
                logger.info(
                    f"Job state changed from {self.last_state} to {current_state}"
                )
                self.update_task_state(current_state)
                self.last_state = current_state

                # Exit if the job is in a final state
                if current_state in ["stopped", "oom", "error"]:
                    logger.info(f"Job reached final state: {current_state}")
                    break

            time.sleep(5)  # Check every 5 seconds


def main():
    if len(sys.argv) != 6:
        print(
            "Usage: monitor.py <job_name> <task_uuid> <user_id> <supabase_url> <supabase_key>"
        )
        sys.exit(1)

    job_name = sys.argv[1]
    task_uuid = sys.argv[2]
    user_id = sys.argv[3]
    supabase_url = sys.argv[4]
    supabase_key = sys.argv[5]

    monitor = JobMonitor(job_name, task_uuid, user_id, supabase_url, supabase_key)
    monitor.monitor()


if __name__ == "__main__":
    main()
