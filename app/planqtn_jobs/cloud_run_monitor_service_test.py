import base64
import json
import os
import subprocess
import threading
import time

from fastapi.testclient import TestClient
import pytest
import requests
from supabase import create_client
from cloud_run_monitor_service import (
    extract_details,
    extract_details_from_decoded_data,
    app,
)
from planqtn_fixtures import supabase_setup


def test_extract_job_id():
    decoded_data = open(
        "app/planqtn_jobs/test_files/failed_job_example_message.json", "r"
    ).read()
    uuid, user_id, result = extract_details_from_decoded_data(decoded_data)
    assert uuid == "12345"
    assert user_id == "user12345"
    assert (
        result
        == "Task planqtn-jobs-q5mr7-task0 failed with message: The container exited with an error."
    )


def test_extract_data_from_failure_message():
    message_with_encoded_data = open(
        "app/planqtn_jobs/test_files/failure_msg.json", "r"
    ).read()
    uuid, user_id, result = extract_details(json.loads(message_with_encoded_data))
    assert uuid == "df5688de-0ad4-4cc3-83a0-f0c6a21577fc"
    assert user_id == "95f5b295-530f-42f1-98b1-76f2ce2ba37b"
    assert (
        result
        == "Task planqtn-jobs-crrgf-task0 failed with message: The container exited with an error."
    )


def test_extract_data_from_timeout_message():
    decoded_data = open("app/planqtn_jobs/test_files/test_timeout_job.json", "r").read()
    uuid, user_id, result = extract_details_from_decoded_data(decoded_data)
    assert uuid == "dbf7464b-9f36-486c-8383-2ca3dd194b05"
    assert user_id == "f96cb362-b3ab-4750-b5f7-43cb629e887f"
    assert (
        result
        == "Task planqtn-jobs-fxf45-task0 failed with message: The configured timeout was reached."
    )


@pytest.fixture()
def run_monitor_service(supabase_setup):
    # Set required environment variables for Supabase
    env = os.environ.copy()
    env["SUPABASE_URL"] = supabase_setup["api_url"]
    env["SUPABASE_KEY"] = supabase_setup["service_role_key"]
    # Add any other required env vars here

    # Start the FastAPI service
    proc = subprocess.Popen(
        ["python", "app/planqtn_jobs/cloud_run_monitor_service.py"],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    log_lines = []

    def stream_logs():
        for line in proc.stdout:
            print("[monitor_service]", line, end="")
            log_lines.append(line)

    log_thread = threading.Thread(target=stream_logs, daemon=True)
    log_thread.start()
    # Wait for the service to start
    for _ in range(20):
        try:
            requests.get("http://localhost:8080")
            break
        except Exception:
            time.sleep(0.5)
    else:
        proc.terminate()
        raise RuntimeError("cloud_run_monitor_service.py did not start in time")

    yield "http://localhost:8080"

    proc.terminate()
    proc.wait()

    # Print any remaining logs after process ends
    if proc.stdout:
        for line in proc.stdout:
            print("[monitor_service]", line, end="")
            log_lines.append(line)


def create_encoded_message_with_user_id(user_id: str):
    message_with_encoded_data = open(
        "app/planqtn_jobs/test_files/failure_msg.json", "r"
    ).read()
    message_with_encoded_data = json.loads(message_with_encoded_data)
    decoded_data = (
        base64.b64decode(message_with_encoded_data["message"]["data"])
        .decode("utf-8")
        .replace("95f5b295-530f-42f1-98b1-76f2ce2ba37b", user_id)
    )
    message_with_encoded_data["message"]["data"] = base64.b64encode(
        decoded_data.encode("utf-8")
    ).decode("utf-8")

    return json.dumps(message_with_encoded_data)


@pytest.mark.integration
def test_call_service_monitor_for_failed_job(supabase_setup, run_monitor_service):
    service_client = create_client(
        supabase_setup["api_url"], supabase_setup["service_role_key"]
    )

    try:
        res = (
            service_client.table("tasks")
            .delete()
            .eq("uuid", "df5688de-0ad4-4cc3-83a0-f0c6a21577fc")
            .execute()
        )
    except Exception as e:
        print("Can't delete task: ", e)
        pass

    try:
        # Create a task in the database
        service_client.table("tasks").insert(
            {
                "uuid": "df5688de-0ad4-4cc3-83a0-f0c6a21577fc",
                "user_id": supabase_setup["test_user_id"],
                "job_type": "weightenumerator",
                "state": 0,
            }
        ).execute()
        message_with_encoded_data = create_encoded_message_with_user_id(
            supabase_setup["test_user_id"]
        )

        response = requests.post(
            f"http://localhost:8080/job-failed",
            json=json.loads(message_with_encoded_data),
        )
        assert response.status_code == 200, response
    finally:
        try:
            service_client.table("tasks").delete().eq(
                "uuid", "df5688de-0ad4-4cc3-83a0-f0c6a21577fc"
            ).execute()
        except Exception as e:
            print("Can't delete task: ", e)
            pass
