import json
import os
import tempfile
import subprocess
import uuid
from pathlib import Path
import pytest
from planqtn_jobs.main import main
from planqtn_types.api_types import WeightEnumeratorCalculationResult
from supabase import create_client, Client

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


def validate_weight_enumerator_result_output_file(output_file: str):
    """Validate the weight enumerator calculation result.

    Args:
        output_file: Path to the output file containing the result
    """
    assert os.path.exists(output_file)
    with open(output_file, "r") as f:
        result = json.load(f)
        validate_weight_enumerator_result(result)


def validate_weight_enumerator_result(result):
    """Validate the weight enumerator calculation result.

    Args:
        output_file: Path to the output file containing the result
    """

    assert isinstance(result, dict)
    res = WeightEnumeratorCalculationResult(**result)
    assert (
        res.stabilizer_polynomial
        == """II: {0:1}
ZZ: {2:2}
IZ: {3:2}
ZI: {3:2}
XX: {2:2}
YY: {2:2}
IX: {3:2}
IY: {3:2}
XI: {3:2}
YI: {3:2}"""
    )
    assert res.normalizer_polynomial == "not supported for open legs yet"
    assert res.time > 0


@pytest.fixture
def supabase_setup():
    """Set up Supabase test environment and create test user."""
    # Get local Supabase status
    result = subprocess.run(
        ["npx", "supabase", "status", "-o", "json"], capture_output=True, text=True
    )
    status = json.loads(result.stdout)

    # Get service role key from status
    service_role_key = status["SERVICE_ROLE_KEY"]
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
            "--task-store-key",
            supabase_setup["test_user_token"],
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
        service_client.table("tasks").delete().eq("uuid", task_uuid).execute()
