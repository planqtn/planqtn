import os
import tempfile
import pytest


@pytest.fixture
def temp_input_file(test_data: str, suffix: str = ".json"):
    """Create a temporary file with the test JSON data."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=suffix, delete=False) as f:
        f.write(test_data)
    yield f.name
    os.unlink(f.name)


@pytest.fixture
def temp_output_file(suffix: str = ".json"):
    """Create a temporary file for output."""
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        pass
    yield f.name
    os.unlink(f.name)
