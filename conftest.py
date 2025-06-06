import pytest

from app.planqtn_fixtures.env import getEnvironment


def pytest_addoption(parser):
    parser.addoption(
        "--integration",
        action="store_true",
        default=False,
        help="run integration tests",
    )

    parser.addoption(
        "--local-only-integration",
        action="store_true",
        default=False,
        help="run local integration tests",
    )


def pytest_configure(config):
    config.addinivalue_line("markers", "integration: mark test as integration test")
    config.addinivalue_line(
        "markers", "local_only_integration: mark test as local-only integration test"
    )


def pytest_collection_modifyitems(config, items):
    env = getEnvironment()

    skip_integration = pytest.mark.skip(reason="need --integration option to run")

    if config.getoption("--integration"):
        for item in items:
            if "integration" not in item.keywords:
                item.add_marker(skip_integration)
            elif "local_only_integration" in item.keywords and env != "local":
                item.add_marker(skip_integration)
        return
    for item in items:
        if "integration" in item.keywords:
            item.add_marker(skip_integration)
