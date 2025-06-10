from google.cloud.run_v2 import ExecutionsClient
from google.cloud.run_v2.types import execution

import requests
from supabase import ClientOptions
from supabase.client import create_client, Client


def get_execution_details(execution_id):
    client = ExecutionsClient()
    return client.get_execution(execution.GetExecutionRequest(name=execution_id))


def get_job_logs(execution_id):
    client = ExecutionsClient()
    return client.get_job_logs(execution_id)
