import { K8sClient } from "../../../supabase/functions/shared/lib/k8s-client";

export async function getJobStatus(
    jobId: string,
    env: string,
): Promise<string> {
    const client = new K8sClient(env);
    return await client.getJobStatus(jobId);
}
