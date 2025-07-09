import datetime
import json
from fastapi.testclient import TestClient
from galois import GF2
import numpy as np
import pytest
import requests
from app.planqtn_types.api_types import TensorNetworkRequest, TensorNetworkResponse
from planqtn_api.planqtn_server import app


from fastapi.testclient import TestClient

from planqtn.codes.css_tanner_code import CssTannerCodeTN
from planqtn.linalg import gauss
from planqtn.tensor_network import TensorNetwork
from planqtn_fixtures import *


client = TestClient(app)


def test_css_tanner_network_bell_state():
    client = TestClient(app)

    # Bell state parity check matrix
    # [1 1 0 0] - X stabilizer
    # [0 0 1 1] - Z stabilizer
    matrix = [
        [0, 0, 1, 1],
        [1, 1, 0, 0],
    ]

    expected_response = TensorNetworkResponse.from_tensor_network(
        CssTannerCodeTN(hx=GF2([[1, 1]]), hz=GF2([[1, 1]])),
        start_node_index=10,
    )

    response = client.post(
        "/csstannernetwork",
        json={"matrix": matrix, "start_node_index": 10},
    )
    assert response.status_code == 200

    data = response.json()

    assert len(data["legos"]) == 12, "Expected 12 legos, got %d" % len(data["legos"])

    assert len(data["connections"]) == 12, "Expected 12 connections, got %d" % len(
        data["connections"]
    )

    # Create a dictionary to track how many times each leg is used
    leg_usage = {}

    # Count usage of each leg
    for conn in data["connections"]:
        from_key = f"{conn['from']['legoId']}-{conn['from']['leg_index']}"
        to_key = f"{conn['to']['legoId']}-{conn['to']['leg_index']}"

        leg_usage[from_key] = leg_usage.get(from_key, 0) + 1
        leg_usage[to_key] = leg_usage.get(to_key, 0) + 1

    # Verify each leg is used exactly once
    for leg, count in leg_usage.items():
        assert (
            count == 1
        ), f"Leg {leg} is used {count} times, should be used exactly once"

    response_h = gauss(
        TensorNetworkResponse(legos=data["legos"], connections=data["connections"])
        .to_tensor_network()
        .conjoin_nodes()
        .h
    )
    print(response_h)
    expected_h = gauss(expected_response.to_tensor_network().conjoin_nodes().h)
    print(expected_h)
    assert np.array_equal(expected_h, response_h)


def sample_tensornetwork_call(supabase_setup, network_type, matrix):
    supabase_url = supabase_setup["api_url"]
    supabase_user_key = supabase_setup["test_user_token"]
    url = f"{supabase_url}/functions/v1/tensornetwork"

    return requests.post(
        url,
        json={
            "matrix": matrix,
            "networkType": network_type,
            "start_node_index": 10,
        },
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {supabase_user_key}",
        },
    )


@pytest.mark.integration
@pytest.mark.parametrize("network_type", ["MSP", "CSS_TANNER", "TANNER"])
def test_tensornetwork_call_e2e_integration(supabase_setup, network_type):
    matrix = [
        [0, 0, 1, 1],
        [1, 1, 0, 0],
    ]

    response = sample_tensornetwork_call(supabase_setup, network_type, matrix)

    assert (
        response.status_code == 200
    ), f"Failed to call function, status code: {response.status_code}, response: {response}"

    data = response.json()
    response_h = gauss(
        TensorNetworkResponse(legos=data["legos"], connections=data["connections"])
        .to_tensor_network()
        .conjoin_nodes()
        .h
    )
    print(response_h)
    assert np.array_equal(response_h, gauss(GF2(matrix)))


@pytest.mark.integration
@pytest.mark.cloud_only_integration
def test_tensornetwork_call_quota_exceeded(supabase_setup):
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

    response = sample_tensornetwork_call(
        supabase_setup,
        "CSS_TANNER",
        [
            [0, 0, 1, 1],
            [1, 1, 0, 0],
        ],
    )
    assert response.status_code == 403
    assert (
        response.json()["error"]
        == "Quota cloud-run-minutes exceeded. Current usage: 500, Requested: 0.5, Limit: 500"
    )


@pytest.mark.integration
@pytest.mark.cloud_only_integration
def test_tensornetwork_call_adds_quota_usage(supabase_setup):
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

    # let's request a tensornetwork call
    response = sample_tensornetwork_call(
        supabase_setup,
        "CSS_TANNER",
        [
            [0, 0, 1, 1],
            [1, 1, 0, 0],
        ],
    )
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
    # right now 0.5 minutes used for each tensornetwork call
    assert res.data[0]["amount_used"] == 0.5
    assert res.data[0]["explanation"] == {
        "usage_type": "tensornetwork_call",
    }
