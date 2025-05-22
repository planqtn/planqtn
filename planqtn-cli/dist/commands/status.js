"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJobStatus = getJobStatus;
const k8s_client_1 = require("../lib/k8s-client");
async function getJobStatus(jobId, env) {
    const client = new k8s_client_1.K8sClient(env);
    return await client.getJobStatus(jobId);
}
