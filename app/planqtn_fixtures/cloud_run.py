import base64
import json
import os
from google.cloud.run_v2 import ExecutionsClient
from google.cloud.run_v2.types import execution

import requests
from supabase import ClientOptions
from supabase.client import create_client, Client


def get_execution_details(execution_id):
    GCP_SVC_CREDENTIALS = os.getenv("GCP_SVC_CREDENTIALS")
    if GCP_SVC_CREDENTIALS:
        decoded_key = base64.b64decode(GCP_SVC_CREDENTIALS).decode("utf-8")
        client = ExecutionsClient.from_service_account_info(json.loads(decoded_key))
    else:
        client = ExecutionsClient()
    return client.get_execution(execution.GetExecutionRequest(name=execution_id))
