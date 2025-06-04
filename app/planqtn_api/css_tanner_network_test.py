import json
from fastapi.testclient import TestClient
from galois import GF2
from app.planqtn_types.api_types import TensorNetworkRequest, TensorNetworkResponse
from planqtn_api.planqtn_server import app


from fastapi.testclient import TestClient

from qlego.codes.css_tanner_code import CssTannerCodeTN
from qlego.linalg import gauss
from qlego.tensor_network import TensorNetwork


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
        CssTannerCodeTN(hx=GF2([[1, 1, 0, 0]]), hz=GF2([[0, 0, 1, 1]])),
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
        from_key = f"{conn['from']['legoId']}-{conn['from']['legIndex']}"
        to_key = f"{conn['to']['legoId']}-{conn['to']['legIndex']}"

        leg_usage[from_key] = leg_usage.get(from_key, 0) + 1
        leg_usage[to_key] = leg_usage.get(to_key, 0) + 1

    # Verify each leg is used exactly once
    for leg, count in leg_usage.items():
        assert (
            count == 1
        ), f"Leg {leg} is used {count} times, should be used exactly once"

    # assert gauss(expected_response.to_tensor_network().conjoin_nodes().h) == gauss(
    #     response.to_tensor_network().conjoin_nodes().h
    # )
