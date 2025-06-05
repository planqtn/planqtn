import kubernetes
import os
import pytest
import yaml


@pytest.fixture
def k8s_apis():
    """Create Kubernetes API clients based on environment."""
    # Determine postfix based on KERNEL_ENV
    postfix = "-local" if os.environ.get("KERNEL_ENV") == "local" else "-dev"
    kubeconfig_path = os.path.expanduser(f"~/.planqtn/kubeconfig{postfix}.yaml")

    with open(kubeconfig_path) as f:
        kubeconfig = yaml.safe_load(f)

    client = kubernetes.config.new_client_from_config_dict(kubeconfig)
    batch_api = kubernetes.client.BatchV1Api(client)
    core_api = kubernetes.client.CoreV1Api(client)

    return {"batch_api": batch_api, "core_api": core_api}


def list_pods(k8s_apis):
    pods = k8s_apis["core_api"].list_namespaced_pod(namespace="default")
    for pod in pods.items:
        print("========================")
        print(pod.metadata.name)
        print(pod.status)
        print("========================")
        print("pod logs:")
        try:
            pod_logs = k8s_apis["core_api"].read_namespaced_pod_log(
                name=pod.metadata.name, namespace="default"
            )
            print(pod_logs)
        except Exception as e:
            print(f"Failed to get logs for pod {pod.metadata.name}: {e}")
        print("========================")
