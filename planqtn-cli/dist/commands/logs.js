"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJobLogs = getJobLogs;
const k8s_client_1 = require("../lib/k8s-client");
async function getJobLogs(jobId, env, follow = false) {
    const client = new k8s_client_1.K8sClient(env);
    if (follow) {
        // TODO: Implement log following
        console.log("Log following not implemented yet");
        process.exit(1);
    }
    else {
        const logs = await client.getJobLogs(jobId);
        console.log(logs);
    }
}
