import datetime
import json
import pytest
import requests
from supabase import ClientOptions
from supabase.client import create_client, Client

from planqtn_fixtures.cloud_run import get_execution_details
from planqtn_fixtures.env import getEnvironment
from planqtn_jobs.weight_enum_task_test import TEST_JSON
from planqtn_fixtures.supabase import create_supabase_setup
from google.cloud.run_v2 import ExecutionsClient
from google.cloud.run_v2.types import execution


def get_logs_run(task_id, supabase_setup):
    # Create Supabase client with test user token
    user_sb_client: Client = create_client(
        supabase_setup["api_url"],
        supabase_setup["anon_key"],
        options=ClientOptions(
            headers={"Authorization": f"Bearer {supabase_setup['test_user_token']}"}
        ),
    )

    supabase_url = supabase_setup["api_url"]
    supabase_user_key = supabase_setup["test_user_token"]

    url = f"{supabase_url}/functions/v1/planqtn_job_logs_run"

    response = requests.post(
        url,
        json={"task_uuid": task_id},
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {supabase_user_key}",
        },
    )
    return response.json()


def create_cloud_run_job(supabase_setup):
    # Create Supabase client with test user token
    user_sb_client: Client = create_client(
        supabase_setup["api_url"],
        supabase_setup["anon_key"],
        options=ClientOptions(
            headers={"Authorization": f"Bearer {supabase_setup['test_user_token']}"}
        ),
    )

    supabase_url = supabase_setup["api_url"]
    supabase_anon_key = supabase_setup["anon_key"]
    supabase_user_key = supabase_setup["test_user_token"]

    url = f"{supabase_url}/functions/v1/planqtn_job_run"

    response = requests.post(
        url,
        json={
            "payload": json.loads(TEST_JSON),
            "user_id": supabase_setup["test_user_id"],
            "job_type": "weightenumerator",
            "request_time": datetime.datetime.now().isoformat(),
            "task_store_url": supabase_url,
            "task_store_anon_key": supabase_anon_key,
            "task_store_user_key": supabase_user_key,
            "memory_limit": "1Gi",
            "cpu_limit": "1",
        },
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {supabase_user_key}",
        },
    )
    assert (
        response.status_code == 200
    ), f"Failed to call function, status code: {response.status_code}, response: {response.json()}"

    print(response.json())

    task_id = response.json()["task_id"]

    execution_id = (
        user_sb_client.table("tasks")
        .select("*")
        .eq("uuid", task_id)
        .execute()
        .data[0]["execution_id"]
    )

    return task_id, execution_id


def main():

    setup = create_supabase_setup()
    # task_id, execution_id = create_cloud_run_job(setup)
    # print("Got execution id and task id", execution_id, task_id)
    execution_id = "projects/planqtn2/locations/us-east1/jobs/planqtn-jobs/executions/planqtn-jobs-rcp4z"

    execution_details = get_execution_details(execution_id)
    print(execution_details.template.containers[0].resources)
    print(execution_details.template.max_retries)
    print(execution_details.template.timeout.seconds)

    # task_id = "8eff9c6a-4026-4c92-8361-104845b1b6b9"

    # print("--------- logs for task", task_id, "-------------")
    # logs = get_logs_run(task_id, setup)
    # print("Got logs", logs["logs"])
    # print("------------------- end of logs ---------------")


if __name__ == "__main__":
    main()
