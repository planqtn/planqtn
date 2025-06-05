import os
import subprocess

import pytest


@pytest.fixture
def image_tag():
    image_tag = subprocess.run(
        ["hack/image_tag"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()

    return image_tag


def isDev():
    return os.environ.get("KERNEL_ENV") != "local"
