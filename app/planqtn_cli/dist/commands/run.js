"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runJob = runJob;
const k8s_client_1 = require("../lib/k8s-client");
const jobs_config_1 = require("../config/jobs_config");
async function runJob(jobType, env, args) {
    const config = jobs_config_1.JOBS_CONFIG[jobType];
    if (!config) {
        throw new Error(`Unknown job type: ${jobType}`);
    }
    const client = new k8s_client_1.K8sClient(env);
    return await client.createJob(jobType, args, config);
}
