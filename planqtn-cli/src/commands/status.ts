import { K8sClient } from "../lib/k8s-client";

export async function getJobStatus(
    jobId: string,
    env: string,
): Promise<string> {
    const client = new K8sClient(env);
    return await client.getJobStatus(jobId);
}
