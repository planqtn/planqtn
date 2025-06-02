import pytest


def pytest_addoption(parser):
    parser.addoption(
        "--integration",
        action="store_true",
        default=False,
        help="run integration tests",
    )


def pytest_configure(config):
    config.addinivalue_line("markers", "integration: mark test as integration test")


def pytest_collection_modifyitems(config, items):
    skip_integration = pytest.mark.skip(reason="need --integration option to run")

    if config.getoption("--integration"):
        for item in items:
            if "integration" not in item.keywords:
                item.add_marker(skip_integration)
        return
    for item in items:
        if "integration" in item.keywords:
            item.add_marker(skip_integration)
