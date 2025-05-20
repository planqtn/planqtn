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
    };
}
export const config: ApiConfig = {
    baseUrl: import.meta.env.VITE_REACT_APP_SUPABASE_URL,
    anonKey: import.meta.env.VITE_REACT_APP_SUPABASE_ANON_KEY,
    env: import.meta.env.VITE_ENV as Environment,
    endpoints: {
        tensorNetwork: "/functions/v1/tensornetwork",
    },
};

export const getApiUrl = (endpoint: keyof ApiConfig["endpoints"]): string => {
    return `${config.baseUrl}${config.endpoints[endpoint]}`;
};
