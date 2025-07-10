import datetime
import json
import os
import uuid
import threading
import time
import asyncio
import pytest
import requests
from planqtn.simple_poly import SimplePoly
from planqtn_fixtures.job_debugger import JobDebugger
from planqtn_fixtures.cloud_run import get_execution_details
from planqtn_jobs.main import main
from planqtn_types.api_types import WeightEnumeratorCalculationResult
from supabase import ClientOptions, create_client, Client
from supabase.client import AsyncClient
from planqtn_fixtures import *


# Test data from weight_enum_task_test.py
TEST_JSON = """{"legos":{"1":{"instance_id":"1","short_name":"STN","name":"STN","type_id":"steane","parity_check_matrix":[[0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0],[0,1,1,0,0,1,1,0,0,0,0,0,0,0,0,0],[1,0,1,0,1,0,1,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0],[0,0,0,0,0,0,0,0,0,1,1,0,0,1,1,0],[0,0,0,0,0,0,0,0,1,0,1,0,1,0,1,0],[1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1]],"logical_legs":[7],"gauge_legs":[]},"2":{"instance_id":"2","short_name":"STN","name":"STN","type_id":"steane","parity_check_matrix":[[0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0],[0,1,1,0,0,1,1,0,0,0,0,0,0,0,0,0],[1,0,1,0,1,0,1,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0],[0,0,0,0,0,0,0,0,0,1,1,0,0,1,1,0],[0,0,0,0,0,0,0,0,1,0,1,0,1,0,1,0],[1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1]],"logical_legs":[7],"gauge_legs":[]}},"connections":[{"from":{"legoId":"1","leg_index":1},"to":{"legoId":"2","leg_index":5}}],"truncate_length":3,"open_legs":[{"instance_id":"1","leg_index":3},{"instance_id":"1","leg_index":6}]}"""
TEST_JSON_SINGLE_LEGO_OPEN_LEGS = """{
  "legos": {
    "2": {
      "instance_id": "2",
      "short_name": "T6",
      "name": "T6",
      "type_id": "t6",
      "parity_check_matrix": [
        [
          1,
          1,
          1,
          1,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0
        ],
        [
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          1,
          1,
          0,
          0
        ],
        [
          1,
          1,
          0,
          0,
          1,
          0,
          0,
          0,
          0,
          0,
          0,
          0
        ],
        [
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          0,
          1,
          0
        ],
        [
          0,
          1,
          1,
          0,
          0,
          1,
          0,
          0,
          0,
          0,
          0,
          0
        ],
        [
          0,
          0,
          0,
          0,
          0,
          0,
          1,
          1,
          0,
          0,
          0,
          1
        ]
      ],
      "logical_legs": [
        4,
        5
      ],
      "gauge_legs": []
    }
  },
  "connections": [],
  "truncate_length": null,
  "open_legs": [
    {
      "instance_id": "2",
      "leg_index": 0
    },
    {
      "instance_id": "2",
      "leg_index": 1
    }
  ]
}"""


@pytest.fixture
def test_data() -> str:
    return TEST_JSON


def validate_weight_enumerator_result_output_file(output_file: str, expected=None):
    """Validate the weight enumerator calculation result.

    Args:
        output_file: Path to the output file containing the result
    """
    assert os.path.exists(output_file)
    with open(output_file, "r") as f:
        result = json.load(f)
        validate_weight_enumerator_result(result, expected)


def validate_weight_enumerator_result(result, expected=None):
    """Validate the weight enumerator calculation result.

    Args:
        output_file: Path to the output file containing the result
    """

    if expected is None:
        expected = WeightEnumeratorCalculationResult(
            stabilizer_polynomial="""II: {0:1}
ZZ: {2:2}
IZ: {3:2}
ZI: {3:2}
XX: {2:2}
YY: {2:2}
IX: {3:2}
IY: {3:2}
XI: {3:2}
YI: {3:2}""",
            normalizer_polynomial="not supported for open legs yet",
            time=0.01,
        )

    assert isinstance(result, dict)

    res = WeightEnumeratorCalculationResult(**result)
    assert res.stabilizer_polynomial == expected.stabilizer_polynomial, (
        "Not equal, got:\n"
        + res.stabilizer_polynomial
        + "\n"
        + expected.stabilizer_polynomial
    )
    assert res.normalizer_polynomial == expected.normalizer_polynomial, (
        "Not equal, got:\n"
        + res.normalizer_polynomial
        + "\n"
        + expected.normalizer_polynomial
    )
    assert res.time > 0


def test_main_without_progress_bar(temp_output_file, monkeypatch):
    input_file = create_temp_file_with_data(TEST_JSON)
    """Test main.py without local progress bar."""
    # Mock sys.argv to simulate command line arguments
    monkeypatch.setattr(
        "sys.argv",
        ["main.py", "--input-file", input_file, "--output-file", temp_output_file],
    )

    # Run the main function
    main()

    # Validate the result
    validate_weight_enumerator_result_output_file(temp_output_file)


# repro https://github.com/planqtn/planqtn/issues/70
def test_open_legs_t6_code(temp_output_file, monkeypatch):
    input_file = create_temp_file_with_data(TEST_JSON_SINGLE_LEGO_OPEN_LEGS)
    """Test main.py with open legs."""
    # Mock sys.argv to simulate command line arguments
    monkeypatch.setattr(
        "sys.argv",
        [
            "main.py",
            "--input-file",
            input_file,
            "--output-file",
            temp_output_file,
            "--debug",
        ],
    )

    # Run the main function
    main()

    # Validate the result
    validate_weight_enumerator_result_output_file(
        temp_output_file,
        expected=WeightEnumeratorCalculationResult(
            stabilizer_polynomial="""II: {0:1, 3:2, 4:1}
IZ: {2:1, 3:2, 4:1}
ZI: {2:1, 3:2, 4:1}
ZZ: {1:1, 2:1, 3:1, 4:1}
IX: {2:1, 3:2, 4:1}
IY: {3:2, 4:2}
ZX: {3:2, 4:2}
ZY: {2:1, 3:2, 4:1}
XI: {2:1, 3:2, 4:1}
XZ: {3:2, 4:2}
YI: {3:2, 4:2}
YZ: {2:1, 3:2, 4:1}
XX: {1:1, 2:1, 3:1, 4:1}
XY: {2:1, 3:2, 4:1}
YX: {2:1, 3:2, 4:1}
YY: {2:2, 3:2}""",
            normalizer_polynomial="not supported for open legs yet",
            time=0.01,
        ),
    )


def test_main_with_progress_bar(temp_output_file, monkeypatch):
    input_file = create_temp_file_with_data(TEST_JSON)
    """Test main.py with local progress bar."""
    # Mock sys.argv to simulate command line arguments
    monkeypatch.setattr(
        "sys.argv",
        [
            "main.py",
            "--input-file",
            input_file,
            "--output-file",
            temp_output_file,
            "--local-progress-bar",
        ],
    )

    # Run the main function
    main()

    # Validate the result
    validate_weight_enumerator_result_output_file(temp_output_file)


@pytest.mark.integration
@pytest.mark.local_only_integration
def test_main_with_task_store(temp_output_file, supabase_setup, monkeypatch):
    """Test main.py with task store integration."""
    # Create Supabase client with test user token
    supabase: Client = create_client(
        supabase_setup["api_url"], supabase_setup["test_user_token"]
    )

    # Create a task in Supabase
    task_uuid = str(uuid.uuid4())
    task_data = {
        "uuid": task_uuid,
        "user_id": supabase_setup["test_user_id"],
        "args": json.loads(TEST_JSON),
        "state": 0,  # PENDING
        "job_type": "weight_enumerator",
    }

    # Insert task using service role client to bypass RLS
    service_client = create_client(
        supabase_setup["api_url"], supabase_setup["service_role_key"]
    )
    try:
        service_client.table("tasks").insert(task_data).execute()

        args = [
            "main.py",
            "--task-uuid",
            task_uuid,
            "--task-store-url",
            supabase_setup["api_url"],
            "--task-store-user-key",
            supabase_setup["test_user_token"],
            "--task-store-anon-key",
            supabase_setup["anon_key"],
            "--user-id",
            supabase_setup["test_user_id"],
            "--output-file",
            temp_output_file,
            "--debug",
        ]
        # Mock sys.argv to simulate command line arguments
        monkeypatch.setattr("sys.argv", args)
        print("Running\n\t", " ".join(args))

        # Run the main function
        main()

        # Validate the result
        validate_weight_enumerator_result_output_file(temp_output_file)

        # Verify task was updated in Supabase
        task = supabase.table("tasks").select("*").eq("uuid", task_uuid).execute()
        assert len(task.data) == 1
        assert task.data[0]["state"] == 2  # SUCCESS
        validate_weight_enumerator_result(json.loads(task.data[0]["result"]))

    finally:
        # service_client.table("tasks").delete().eq("uuid", task_uuid).execute()
        pass


@pytest.mark.integration
@pytest.mark.local_only_integration
@pytest.mark.asyncio
async def test_main_with_task_store_and_realtime(
    temp_output_file, supabase_setup, monkeypatch
):
    """Test main.py with task store integration."""
    # Create Supabase client with test user token
    supabase: Client = create_client(
        supabase_setup["api_url"], supabase_setup["test_user_token"]
    )

    # Create a task in Supabase
    task_uuid = str(uuid.uuid4())
    task_data = {
        "uuid": task_uuid,
        "user_id": supabase_setup["test_user_id"],
        # fmt: off
        "args": json.loads("""{"legos":{"1":{"instance_id":"1","short_name":"QRM15","name":"QRM15","type_id":"15qrm","parity_check_matrix":[[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,1,1,1,1,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,1,1,1,1,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,1,0,1,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,1,1,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,1,0,1,0],[0,0,1,0,1,1,0,0,1,1,0,1,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,1,0,1]],"logical_legs":[15],"gauge_legs":[]}},"connections":[],"truncate_length":null,"open_legs":[]}"""),
        # fmt: on
        "state": 0,  # PENDING
        "job_type": "weight_enumerator",
    }

    # Insert task using service role client to bypass RLS
    service_client = create_client(
        supabase_setup["api_url"], supabase_setup["service_role_key"]
    )
    try:
        service_client.table("tasks").insert(task_data).execute()
        service_client.table("task_updates").insert(
            {
                "uuid": task_uuid,
                "user_id": supabase_setup["test_user_id"],
                "updates": json.dumps({"state": 1}),
            }
        ).execute()
        args = [
            "main.py",
            "--task-uuid",
            task_uuid,
            "--task-store-url",
            supabase_setup["api_url"],
            "--task-store-user-key",
            supabase_setup["test_user_token"],
            "--task-store-anon-key",
            supabase_setup["anon_key"],
            "--user-id",
            supabase_setup["test_user_id"],
            "--output-file",
            temp_output_file,
            # "--debug",
            "--realtime",
            "--realtime-update-frequency",
            "1",
        ]
        # Mock sys.argv to simulate command line arguments
        monkeypatch.setattr("sys.argv", args)
        print("Running\n\t", " ".join(args))

        # Set environment variables for realtime updates
        monkeypatch.setenv("RUNTIME_SUPABASE_URL", supabase_setup["api_url"])
        monkeypatch.setenv("RUNTIME_SUPABASE_KEY", supabase_setup["service_role_key"])

        # Set up realtime listener before running main
        received_updates = []
        update_event = asyncio.Event()

        def handle_update(payload):
            print(f"Received update: {payload}")
            update_event.set()
            received_updates.append(payload["data"]["record"])

        # Create async client for realtime
        async_client = AsyncClient(
            supabase_setup["api_url"], supabase_setup["service_role_key"]
        )

        print("Setting up realtime subscription...")
        channel = async_client.channel("task_updates")
        subscription = channel.on_postgres_changes(
            event="*",
            schema="public",
            table="task_updates",
            filter=f"uuid=eq.{task_uuid}",
            callback=handle_update,
        )
        print("Subscribing to channel...")
        await subscription.subscribe()
        print("Subscription completed")

        # Add a small delay to ensure subscription is fully established
        await asyncio.sleep(0.5)

        # Run the main function in a separate thread
        def run_main():
            print("Starting main function...")
            main()
            print("Main function completed")

        main_thread = threading.Thread(target=run_main)
        main_thread.start()

        # Wait for at least the "started" update with a longer timeout
        try:
            await asyncio.wait_for(update_event.wait(), timeout=5)
        except asyncio.TimeoutError:
            raise AssertionError(
                f"Did not receive 'started' update within timeout, updates: {received_updates}"
            )

        # Wait a bit more to get some iteration updates
        await asyncio.sleep(2)

        # Verify we got the expected updates
        assert (
            len(received_updates) >= 2
        ), f"Expected at least 2 updates, got {len(received_updates)}"

        # Wait for main thread to complete
        main_thread.join()

        expected = WeightEnumeratorCalculationResult(
            stabilizer_polynomial="{0:1, 4:140, 6:448, 8:1350, 10:13888, 12:33740, 14:13440, 16:2529}",
            normalizer_polynomial="{0:1, 4:140, 6:448, 8:1350, 10:13888, 12:33740, 14:13440, 16:2529}",
            time=0.01,
        )

        # Validate the result
        validate_weight_enumerator_result_output_file(
            temp_output_file,
            expected=expected,
        )

        # Verify task was updated in Supabase
        task = supabase.table("tasks").select("*").eq("uuid", task_uuid).execute()
        assert len(task.data) == 1
        assert task.data[0]["state"] == 2  # SUCCESS
        validate_weight_enumerator_result(
            json.loads(task.data[0]["result"]),
            expected=expected,
        )

    finally:
        # Clean up realtime subscription
        if "channel" in locals():
            await channel.unsubscribe()
            # Add a small delay to ensure cleanup is complete
            await asyncio.sleep(0.5)


def assert_properties_of_pod(
    k8s_apis, task_uuid, pod_name, image_tag, memory_limit, cpu_limit
):
    found = False
    for pod in k8s_apis["core_api"].list_namespaced_pod(namespace="default").items:
        if task_uuid in pod.metadata.name and "weightenumerator" in pod.metadata.name:
            assert pod.spec.containers[0].resources.limits["cpu"] == cpu_limit
            assert pod.spec.containers[0].resources.limits["memory"] == memory_limit
            assert pod.spec.containers[0].image.endswith(f"planqtn_jobs:{image_tag}"), (
                "Commit ID mismatch on image: "
                + pod.spec.containers[0].image
                + " != "
                + f"planqtn/planqtn_jobs:{image_tag}"
                + (
                    " run `hack/htn images job --build --load`"
                    if getEnvironment() == "dev"
                    else ""
                )
            )
            found = True
            break
    if not found:
        list_pods(k8s_apis)
    return found


def assert_properties_of_job(
    task_uuid, execution_id, job_name, memory_limit, cpu_limit
):
    execution_details = get_execution_details(execution_id)
    if not execution_details:
        return False
    print(execution_details.template)
    assert execution_details.template.containers[0].resources.limits["cpu"] == cpu_limit
    assert (
        execution_details.template.containers[0].resources.limits["memory"]
        == memory_limit
    )

    assert execution_details.template.max_retries == 0
    assert execution_details.template.timeout.seconds == 300
    return True


def request_job(supabase_setup, payload) -> requests.Response:
    # Create Supabase client with test user token

    supabase_url = supabase_setup["api_url"]
    supabase_anon_key = supabase_setup["anon_key"]
    supabase_user_key = supabase_setup["test_user_token"]

    url = (
        f"{supabase_url}/functions/v1/planqtn_job"
        if getEnvironment() != "cloud"
        else f"{supabase_url}/functions/v1/planqtn_job_run"
    )

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

    return response


@pytest.mark.integration
def test_e2e_through_function_call(
    supabase_setup,
    k8s_apis,
    image_tag,
):
    response = request_job(supabase_setup, json.loads(TEST_JSON))
    assert (
        response.status_code == 200
    ), f"Failed to call function, status code: {response.status_code}, response: {response.json()}"

    print(response.json())
    # Create a task in Supabase
    task_uuid = response.json()["task_id"]

    print(f"Task UUID: {task_uuid}")

    try:
        user_sb_client: Client = create_client(
            supabase_setup["api_url"],
            supabase_setup["anon_key"],
            options=ClientOptions(
                headers={"Authorization": f"Bearer {supabase_setup['test_user_token']}"}
            ),
        )

        # Wait for the task to be created
        while True:
            task = (
                user_sb_client.table("tasks")
                .select("*")
                .eq("uuid", task_uuid)
                .eq("user_id", supabase_setup["test_user_id"])
                .execute()
            )
            if len(task.data) == 1:
                break
            time.sleep(1)

        assert len(task.data) == 1, f"Task not found, task: {task.data}"

        for _ in range(40):
            task = (
                user_sb_client.table("tasks")
                .select("*")
                .eq("uuid", task_uuid)
                .eq("user_id", supabase_setup["test_user_id"])
                .execute()
            )
            if len(task.data) == 1 and task.data[0]["state"] == 2:
                break
            time.sleep(1)

        # Verify task was updated in Supabase
        task = user_sb_client.table("tasks").select("*").eq("uuid", task_uuid).execute()
        assert len(task.data) == 1
        if task.data[0]["state"] != 2:
            print(f"Task data: {task.data[0]}")
            JobDebugger(k8s_apis).debug(task_uuid)

        assert task.data[0]["state"] == 2  # SUCCESS

        validate_weight_enumerator_result(json.loads(task.data[0]["result"]))

        if getEnvironment() != "cloud":
            assert assert_properties_of_pod(
                k8s_apis, task_uuid, "weightenumerator", image_tag, "1Gi", "1"
            ), f"Pod not found, task: {task.data[0]}"
        else:
            assert assert_properties_of_job(
                task_uuid,
                task.data[0]["execution_id"],
                "weightenumerator",
                "512Mi",
                "1000m",
            ), f"Job not found, task: {task.data[0]}"

    finally:
        user_sb_client.table("tasks").delete().eq("uuid", task_uuid).execute()


@pytest.mark.integration
@pytest.mark.cloud_only_integration
def test_job_refused_due_to_quota(supabase_setup):
    service_client: Client = create_client(
        supabase_setup["api_url"], supabase_setup["service_role_key"]
    )

    res = (
        service_client.table("quotas")
        .select("*")
        .eq("user_id", supabase_setup["test_user_id"])
        .execute()
    )

    assert len(res.data) == 1
    assert res.data[0]["user_id"] == supabase_setup["test_user_id"]
    assert res.data[0]["quota_type"] == "cloud-run-minutes"
    assert res.data[0]["monthly_limit"] == 500

    quota_id = res.data[0]["id"]

    res = (
        service_client.table("quota_usage")
        .insert(
            [
                {
                    "quota_id": quota_id,
                    "usage_ts": str(datetime.datetime.now()),
                    "amount_used": 300,
                    "explanation": json.dumps({"reason": "test1"}),
                },
                {
                    "quota_id": quota_id,
                    "usage_ts": str(datetime.datetime.now()),
                    "amount_used": 200,
                    "explanation": json.dumps({"reason": "test2"}),
                },
            ]
        )
        .execute()
    )
    # let's request a job
    response = request_job(supabase_setup, json.loads(TEST_JSON))
    assert response.status_code == 403
    assert (
        response.json()["error"]
        == "Quota cloud-run-minutes exceeded. Current usage: 500, Requested: 5, Limit: 500"
    )


@pytest.mark.integration
@pytest.mark.cloud_only_integration
def test_job_call_adds_quota_usage(supabase_setup):
    service_client: Client = create_client(
        supabase_setup["api_url"], supabase_setup["service_role_key"]
    )

    # let's set the user's quota to below the threshold

    res = (
        service_client.table("quotas")
        .select("*")
        .eq("user_id", supabase_setup["test_user_id"])
        .execute()
    )

    assert len(res.data) == 1
    assert res.data[0]["user_id"] == supabase_setup["test_user_id"]
    assert res.data[0]["quota_type"] == "cloud-run-minutes"
    assert res.data[0]["monthly_limit"] == 500

    quota_id = res.data[0]["id"]

    # let's request a job
    response = request_job(supabase_setup, json.loads(TEST_JSON))
    assert (
        response.status_code == 200
    ), f"Failed to call function, status code: {response.status_code}, response: {response.json()}"

    res = (
        service_client.table("quota_usage")
        .select("*")
        .eq("quota_id", quota_id)
        .execute()
    )
    assert len(res.data) == 1
    # right now 5 minutes used for each job kickoff
    assert res.data[0]["amount_used"] == 5
    assert res.data[0]["explanation"] == {
        "usage_type": "job_run",
        "task_id": response.json()["task_id"],
    }
