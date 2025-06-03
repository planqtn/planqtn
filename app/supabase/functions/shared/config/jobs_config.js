"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JOBS_CONFIG = void 0;
exports.JOBS_CONFIG = {
    weightenumerator: {
        image: "planqtn/planqtn_jobs:e66b90c",
        timeout: 3600, // 1 hour
        memoryLimit: "4Gi",
        cpuLimit: "2",
    },
    "job-monitor": {
        image: "planqtn/planqtn_jobs:e66b90c",
        timeout: 3600, // 1 hour
        memoryLimit: "1Gi",
        cpuLimit: "1",
    },
};
