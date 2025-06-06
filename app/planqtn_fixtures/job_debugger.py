import os
import subprocess
from app.planqtn_fixtures.env import getEnvironment
from app.planqtn_fixtures.k8s import k8s_apis, list_pods


class JobDebugger:
    def __init__(self, k8s_apis):
        self.k8s_apis = k8s_apis

    def debug(self, job_id: str):
        if getEnvironment() == "cloud":
            self.debug_cloud(job_id)
        else:
            self.debug_local(job_id)

    def debug_cloud(self, job_id: str):
        print(
            f"Cloud debugging not implemented...but eventually we'll see {job_id} debugged here"
        )
        pass

    def debug_local(self, job_id: str):
        print("Docker containers: ")
        logs = subprocess.run(
            ["docker", "ps", "-a"],
            capture_output=True,
            text=True,
        )
        print(logs.stdout)

        print("k3d situation:")
        k3d_logs = subprocess.run(
            [os.path.expanduser("~/.planqtn/k3d"), "cluster", "list"],
            capture_output=True,
            text=True,
        )
        list_pods(self.k8s_apis)
        print(k3d_logs.stdout)
