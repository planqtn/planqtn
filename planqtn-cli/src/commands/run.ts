import { K8sClient } from "../../../supabase/functions/shared/lib/k8s-client";
import { JOBS_CONFIG } from "../../../supabase/functions/shared/config/jobs_config";

export async function runJob(
    jobType: string,
    env: string,
    args: string[],
): Promise<string> {
    const config = JOBS_CONFIG[jobType];
    if (!config) {
        throw new Error(`Unknown job type: ${jobType}`);
    }

    const client = new K8sClient(env);
    return await client.createJob(jobType, args, config);
}
