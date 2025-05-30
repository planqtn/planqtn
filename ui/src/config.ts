// Environment types
export type Environment =
    | "local"
    | "development"
    | "preview"
    | "production";

// API configuration
interface ApiConfig {
    userContextURL: string;
    userContextAnonKey: string;
    runtimeStoreUrl: string;
    runtimeStoreAnonKey: string;
    env: Environment;
    endpoints: {
        tensorNetwork: string;
        planqtnJob: string;
        planqtnJobLogs: string;
        cancelJob: string;
    };
}

// Function to get runtime config from localStorage
const getLocalSupabaseConfig = (): Record<string, string> | null => {
    const isActive = localStorage.getItem("runtimeConfigActive");
    if (isActive === "false") return null;
    const storedConfig = localStorage.getItem("runtimeConfig");
    if (!storedConfig) return null;
    try {
        console.log("LOCAL RUNTIME CONFIG ENABLED!", storedConfig);
        return JSON.parse(storedConfig);
    } catch {
        return null;
    }
};

// Get the runtime config if available
const localRuntimeConfig = getLocalSupabaseConfig();

// Override config with runtime config if available
export const config: ApiConfig = {
    userContextURL: import.meta.env.VITE_TASK_STORE_URL,
    userContextAnonKey: import.meta.env.VITE_TASK_STORE_ANON_KEY,
    runtimeStoreUrl: localRuntimeConfig?.API_URL ||
        import.meta.env.VITE_RUNTIME_STORE_URL,
    runtimeStoreAnonKey: localRuntimeConfig?.SERVICE_ROLE_KEY ||
        import.meta.env.VITE_RUNTIME_STORE_ANON_KEY,
    env: (import.meta.env.VITE_ENV || "production") as Environment,
    endpoints: {
        tensorNetwork: "/functions/v1/tensornetwork",
        planqtnJob: localRuntimeConfig
            ? "/functions/v1/planqtn_job"
            : "/functions/v1/planqtn_job_run",
        planqtnJobLogs: localRuntimeConfig
            ? "/functions/v1/planqtn_job_logs"
            : "/functions/v1/planqtn_job_logs_run",
        cancelJob: localRuntimeConfig
            ? "/functions/v1/cancel_job"
            : "/functions/v1/cancel_job_run",
    },
};

export const getApiUrl = (endpoint: keyof ApiConfig["endpoints"]): string => {
    console.log(
        "resolved API url for endpoint",
        endpoint,
        config.runtimeStoreUrl,
        config.endpoints[endpoint],
    );
    return `${config.runtimeStoreUrl}${config.endpoints[endpoint]}`;
};
