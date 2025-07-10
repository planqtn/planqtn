import os
import tempfile
import pytest


def create_temp_file_with_data(data: str, suffix: str = ".json"):
    """Create a temporary file with the test JSON data."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=suffix, delete=False) as f:
        f.write(data)
    return f.name


@pytest.fixture
def temp_output_file(suffix: str = ".json"):
    """Create a temporary file for output."""
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        pass
    yield f.name
    os.unlink(f.name)
