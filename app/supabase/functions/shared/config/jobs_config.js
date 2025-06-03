"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JOBS_CONFIG = void 0;
exports.JOBS_CONFIG = {
    weightenumerator: {
        image: "balopat/planqtn_jobs:75f440d",
        timeout: 3600, // 1 hour
        memoryLimit: "4Gi",
        cpuLimit: "2",
    },
    "job-monitor": {
        image: "balopat/planqtn_jobs:75f440d",
        timeout: 3600, // 1 hour
        memoryLimit: "1Gi",
        cpuLimit: "1",
    },
};
