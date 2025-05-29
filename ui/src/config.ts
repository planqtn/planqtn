// Environment types
export type Environment =
    | "local"
    | "development"
    | "preview"
    | "production";

// API configuration
interface ApiConfig {
    taskStoreUrl: string;
    taskStoreAnonKey: string;
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
const getRuntimeConfig = (): Record<string, string> | null => {
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
const runtimeConfig = getRuntimeConfig();

// Override config with runtime config if available
export const config: ApiConfig = {
    taskStoreUrl: import.meta.env.VITE_TASK_STORE_URL,
    taskStoreAnonKey: import.meta.env.VITE_TASK_STORE_KEY,
    runtimeStoreUrl: runtimeConfig?.API_URL ||
        import.meta.env.VITE_SUPABASE_URL,
    runtimeStoreAnonKey: runtimeConfig?.ANON_KEY ||
        import.meta.env.VITE_SUPABASE_ANON_KEY,
    env: (import.meta.env.VITE_ENV || "production") as Environment,
    endpoints: {
        tensorNetwork: "/functions/v1/tensornetwork",
        planqtnJob: "/functions/v1/planqtn_job",
        planqtnJobLogs: "/functions/v1/planqtn_job_logs",
        cancelJob: "/functions/v1/cancel_job",
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
