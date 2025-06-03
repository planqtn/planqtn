#!/usr/bin/env node

import { Command } from "commander";
import { getJobStatus } from "./commands/status";

const program = new Command();

program
    .command("htn")
    .description("CLI tool for PlanqTN")
    .version("1.0.0");

program
    .command("up")
    .description("Start the local PlanqTN kernel")
    .option(
        "-e, --env <environment>",
        "Environment to check in (local/dev/prod)",
        "local",
    )
    .action(async (jobId: string, options: { env: string }) => {
        try {
            const status = await getJobStatus(jobId, options.env);
            console.log(`Job status: ${status}`);
        } catch (error) {
            console.error("Error getting job status:", error);
            process.exit(1);
        }
    });

program.parse();
