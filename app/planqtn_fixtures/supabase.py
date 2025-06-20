import json
import os
from pathlib import Path
import subprocess
import uuid
import pytest
from supabase import Client, create_client
from planqtn_fixtures.env import getEnvironment


def create_supabase_setup():
    # Get local Supabase status
    env = getEnvironment()

    if env == "cloud":
        # Load supabase_config.json
        with open(
            os.path.expanduser("~/.planqtn/.config/generated/supabase_config.json"), "r"
        ) as f:
            config = json.load(f)
    else:
        workdir = (
            f"{Path(__file__).parent.parent}"
            if env == "dev"
            else os.path.expanduser("~/.planqtn")
        )
        print("workdir:", workdir)
        result = subprocess.run(
            [
                "npx",
                "supabase",
                "--workdir",
                workdir,
                "--debug",
                "status",
                "-o",
                "json",
            ],
            capture_output=True,
            text=True,
        )
        print(result.stdout, result.stderr)
        config = json.loads(result.stdout)

    # Get service role key from status
    api_url = config["API_URL"]
    service_role_key = config["SERVICE_ROLE_KEY"]
    anon_key = config["ANON_KEY"]

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
    setup = {
        "api_url": api_url,
        "service_role_key": service_role_key,
        "anon_key": anon_key,
        "test_user_id": test_user_id,
        "test_user_token": test_user_token,
        "user_client": service_client,
    }

    return setup


@pytest.fixture
def supabase_setup():
    """Set up Supabase test environment and create test user."""
    setup = create_supabase_setup()
    yield setup

    service_client: Client = create_client(setup["api_url"], setup["service_role_key"])
    service_client.auth.admin.delete_user(setup["test_user_id"])
