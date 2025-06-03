import datetime
import json
import os
import tempfile
import subprocess
import uuid
import threading
import time
import asyncio
from pathlib import Path
import pytest
import requests
from planqtn_jobs.main import main
from planqtn_types.api_types import WeightEnumeratorCalculationResult
from supabase import create_client, Client
from supabase.client import AsyncClient

# Test data from weight_enum_task_test.py
TEST_JSON = """{"legos":{"1":{"instanceId":"1","shortName":"STN","name":"STN","id":"steane","parity_check_matrix":[[0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0],[0,1,1,0,0,1,1,0,0,0,0,0,0,0,0,0],[1,0,1,0,1,0,1,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0],[0,0,0,0,0,0,0,0,0,1,1,0,0,1,1,0],[0,0,0,0,0,0,0,0,1,0,1,0,1,0,1,0],[1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1]],"logical_legs":[7],"gauge_legs":[]},"2":{"instanceId":"2","shortName":"STN","name":"STN","id":"steane","parity_check_matrix":[[0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0],[0,1,1,0,0,1,1,0,0,0,0,0,0,0,0,0],[1,0,1,0,1,0,1,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0],[0,0,0,0,0,0,0,0,0,1,1,0,0,1,1,0],[0,0,0,0,0,0,0,0,1,0,1,0,1,0,1,0],[1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1]],"logical_legs":[7],"gauge_legs":[]}},"connections":[{"from":{"legoId":"1","legIndex":1},"to":{"legoId":"2","legIndex":5}}],"truncate_length":3,"open_legs":[{"instanceId":"1","legIndex":3},{"instanceId":"1","legIndex":6}]}"""


@pytest.fixture
def temp_input_file():
    """Create a temporary file with the test JSON data."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        f.write(TEST_JSON)
    yield f.name
    os.unlink(f.name)


@pytest.fixture
def temp_output_file():
    """Create a temporary file for output."""
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        pass
    yield f.name
    os.unlink(f.name)


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
    assert res.stabilizer_polynomial == expected.stabilizer_polynomial
    assert res.normalizer_polynomial == expected.normalizer_polynomial
    assert res.time > 0


@pytest.fixture
def supabase_setup():
    """Set up Supabase test environment and create test user."""
    # Get local Supabase status
    result = subprocess.run(
        [
            "npx",
            "supabase",
            "--workdir",
            f"{Path(__file__).parent.parent}",
            "--debug",
            "status",
            "-o",
            "json",
        ],
        capture_output=True,
        text=True,
    )
    print(result.stdout, result.stderr)

    status = json.loads(result.stdout)

    # Get service role key from status
    service_role_key = status["SERVICE_ROLE_KEY"]
    anon_key = status["ANON_KEY"]
    api_url = status["API_URL"]

    # Create Supabase client with service role
    service_client: Client = create_client(api_url, service_role_key)

    # Create test user
    test_user_email = f"integration_test_{uuid.uuid4()}@example.com"
    test_user_password = "test_password123"

    # Create user with service role
    auth_response = service_client.auth.admin.create_user(
        {
            "email": test_user_email,
            "password": test_user_password,
            "email_confirm": True,
        }
    )

    test_user_id = auth_response.user.id

    # Get user token
    auth_response = service_client.auth.sign_in_with_password(
        {"email": test_user_email, "password": test_user_password}
    )

    test_user_token = auth_response.session.access_token

    yield {
        "api_url": api_url,
        "service_role_key": service_role_key,
        "anon_key": anon_key,
        "test_user_id": test_user_id,
        "test_user_token": test_user_token,
        "service_client": service_client,
    }

    # Create Supabase client with service role again
    service_client: Client = create_client(api_url, service_role_key)
    # Cleanup: Delete test user using service role client
    service_client.auth.admin.delete_user(test_user_id)


def test_main_without_progress_bar(temp_input_file, temp_output_file, monkeypatch):
    """Test main.py without local progress bar."""
    # Mock sys.argv to simulate command line arguments
    monkeypatch.setattr(
        "sys.argv",
        ["main.py", "--input-file", temp_input_file, "--output-file", temp_output_file],
    )

    # Run the main function
    main()

    # Validate the result
    validate_weight_enumerator_result_output_file(temp_output_file)


def test_main_with_progress_bar(temp_input_file, temp_output_file, monkeypatch):
    """Test main.py with local progress bar."""
    # Mock sys.argv to simulate command line arguments
    monkeypatch.setattr(
        "sys.argv",
        [
            "main.py",
            "--input-file",
            temp_input_file,
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
def test_main_with_task_store(
    temp_input_file, temp_output_file, supabase_setup, monkeypatch
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
@pytest.mark.asyncio
async def test_main_with_task_store_and_realtime(
    temp_input_file, temp_output_file, supabase_setup, monkeypatch
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
        "args": json.loads("""{"legos":{"1":{"instanceId":"1","shortName":"QRM15","name":"QRM15","id":"15qrm","parity_check_matrix":[[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,1,1,1,1,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1,1,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,1,1,1,1,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,1,0,1,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,1,1,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,1,0,1,0],[0,0,1,0,1,1,0,0,1,1,0,1,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,1,0,1]],"logical_legs":[15],"gauge_legs":[]}},"connections":[],"truncate_length":null,"open_legs":[]}"""),
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


@pytest.mark.integration
def test_e2e_local_through_function_call_and_k3d(
    temp_input_file, temp_output_file, supabase_setup, monkeypatch
):
    # Create Supabase client with test user token
    supabase: Client = create_client(
        supabase_setup["api_url"], supabase_setup["test_user_token"]
    )

    supabase_url = supabase_setup["api_url"]
    supabase_anon_key = supabase_setup["anon_key"]
    supabase_user_key = supabase_setup["test_user_token"]
    url = f"{supabase_url}/functions/v1/planqtn_job"

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
    # Create a task in Supabase
    task_uuid = response.json()["task_id"]

    print(f"Task UUID: {task_uuid}")
    # Insert task using service role client to bypass RLS
    service_client = create_client(
        supabase_setup["api_url"], supabase_setup["service_role_key"]
    )

    try:
        # Wait for the task to be created
        while True:
            task = supabase.table("tasks").select("*").eq("uuid", task_uuid).execute()
            if len(task.data) == 1:
                break
            time.sleep(1)

        assert len(task.data) == 1, f"Task not found, task: {task.data}"

        for _ in range(5):
            task = supabase.table("tasks").select("*").eq("uuid", task_uuid).execute()
            if len(task.data) == 1 and task.data[0]["state"] == 2:
                break
            time.sleep(1)

        # Verify task was updated in Supabase
        task = supabase.table("tasks").select("*").eq("uuid", task_uuid).execute()
        assert len(task.data) == 1
        assert task.data[0]["state"] == 2  # SUCCESS
        validate_weight_enumerator_result(json.loads(task.data[0]["result"]))

    finally:
        # service_client.table("tasks").delete().eq("uuid", task_uuid).execute()
        pass
