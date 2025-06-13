import datetime
from supabase import Client, create_client
from planqtn_fixtures import supabase_setup
import pytest


@pytest.mark.integration
def test_quota_creation(supabase_setup):
    user_client = supabase_setup["user_client"]
    service_client: Client = create_client(
        supabase_setup["api_url"], supabase_setup["service_role_key"]
    )

    res = user_client.table("quotas").select("*").limit(1).execute()

    assert res.data == []

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

    res = (
        service_client.table("quota_usage")
        .select("*")
        .eq("quota_id", res.data[0]["id"])
        .execute()
    )

    assert len(res.data) == 1
    assert res.data[0]["quota_id"] == res.data[0]["id"], res.data[0]
    assert res.data[0]["usage_date"] == datetime.now().strftime("%Y-%m-%d")
    assert res.data[0]["amount_used"] == 0
