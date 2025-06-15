from pkg_resources import parse_requirements
from setuptools import setup, find_packages
import os
from setuptools import setup

with open("requirements.txt") as f:
    required = f.read().splitlines()

setup(
    name="planqtn",
    version="0.1.0",
    packages=find_packages(),
    install_requires=required,
    author="PlanqTN Contributors",
    author_email="planqtn@planqtn.com",
    description="An implementation of the PlanqTN framework for weight enumerator calculations.",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    url="https://github.com/planqtn/planqtn",
    classifiers=[
        "Programming Language :: Python :: 3s",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.6",
)
