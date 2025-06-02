#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const run_1 = require("./commands/run");
const status_1 = require("./commands/status");
const logs_1 = require("./commands/logs");
const jobs_config_1 = require("./config/jobs_config");
const program = new commander_1.Command();
program
    .name("planqtn")
    .description("CLI tool for PlanQTN")
    .version("1.0.0");
program
    .command("run")
    .description("Run a PlanQTN job")
    .argument("<job_type>", "Type of job to run")
    .option("-e, --env <environment>", "Environment to run in (local/dev/prod)", "local")
    .option("--args <args...>", "Arguments to pass to the job")
    .action(async (jobType, options) => {
    try {
        if (!jobs_config_1.JOBS_CONFIG[jobType]) {
            throw new Error(`Unknown job type: ${jobType}`);
        }
        const jobId = await (0, run_1.runJob)(jobType, options.env, options.args || []);
        console.log(`Job started with ID: ${jobId}`);
    }
    catch (error) {
        console.error("Error running job:", error);
        process.exit(1);
    }
});
program
    .command("status")
    .description("Get the status of a job")
    .argument("<job_id>", "ID of the job to check")
    .option("-e, --env <environment>", "Environment to check in (local/dev/prod)", "local")
    .action(async (jobId, options) => {
    try {
        const status = await (0, status_1.getJobStatus)(jobId, options.env);
        console.log(`Job status: ${status}`);
    }
    catch (error) {
        console.error("Error getting job status:", error);
        process.exit(1);
    }
});
program
    .command("logs")
    .description("Get the logs of a job")
    .argument("<job_id>", "ID of the job to get logs for")
    .option("-e, --env <environment>", "Environment to get logs from (local/dev/prod)", "local")
    .option("-f, --follow", "Follow the logs")
    .action(async (jobId, options) => {
    try {
        await (0, logs_1.getJobLogs)(jobId, options.env, options.follow);
    }
    catch (error) {
        console.error("Error getting job logs:", error);
        process.exit(1);
    }
});
program.parse();
