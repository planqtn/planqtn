import { K8sClient } from "../../../supabase/functions/shared/lib/k8s-client";

export async function getJobLogs(
    jobId: string,
    env: string,
    follow: boolean = false,
): Promise<void> {
    const client = new K8sClient(env);

    if (follow) {
        // TODO: Implement log following
        console.log("Log following not implemented yet");
        process.exit(1);
    } else {
        const logs = await client.getJobLogs(jobId);
        console.log(logs);
    }
}
