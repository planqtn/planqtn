import { createClient } from "jsr:@supabase/supabase-js@2";
import { JobConfig } from "../config/jobs_config.ts";

export class CloudRunClient {
    async createJob(
        jobType: string,
        command: string[],
        args: string[],
        config: JobConfig,
        serviceAccountName?: string,
        postfix?: string,
        env?: Record<string, string>,
    ): Promise<string> {
        console.log(
            "Creating job",
            jobType,
            command,
            args,
            config,
            serviceAccountName,
            postfix,
            env,
        );
        console.log(
            "Container command: " + command.join(",") + "," + args.join(","),
        );
        console.log("Env: " + JSON.stringify(env));
        return "Container command: " + command.join(",") + "," + args.join(",");
    }
    constructor() {
    }
}
