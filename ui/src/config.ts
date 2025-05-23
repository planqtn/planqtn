// Environment types
export type Environment =
    | "local"
    | "development"
    | "preview"
    | "production";

// API configuration
interface ApiConfig {
    baseUrl: string;
    anonKey: string;
    env: Environment;
    endpoints: {
        tensorNetwork: string;
        planqtnJob: string;
        planqtnJobLogs: string;
    };
}

// Function to get runtime config from localStorage
const getRuntimeConfig = (): Record<string, string> | null => {
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
    baseUrl: runtimeConfig?.API_URL || import.meta.env.VITE_SUPABASE_URL,
    anonKey: runtimeConfig?.ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY,
    env: (import.meta.env.VITE_ENV || "production") as Environment,
    endpoints: {
        tensorNetwork: "/functions/v1/tensornetwork",
        planqtnJob: "/functions/v1/planqtn_job",
        planqtnJobLogs: "/functions/v1/planqtn_job_logs",
    },
};

export const getApiUrl = (endpoint: keyof ApiConfig["endpoints"]): string => {
    console.log(
        "resolved API url for endpoint",
        endpoint,
        config.baseUrl,
        config.endpoints[endpoint],
    );
    return `${config.baseUrl}${config.endpoints[endpoint]}`;
};
