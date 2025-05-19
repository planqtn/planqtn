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
    endpoints: {
        tensorNetwork: string;
        // Add other endpoints as needed
    };
}

// Define endpoints once
const endpoints = {
    tensorNetwork: "/functions/v1/tensornetwork",
    // Add other endpoints as needed
} as const;

// Environment-specific configurations
const configs: Record<Environment, ApiConfig> = {
    local: {
        baseUrl: "http://localhost:54321",
        anonKey:
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
        endpoints,
    },
    development: {
        baseUrl: "https://rnsnwdwyqkffwrtujgnh.supabase.co",
        anonKey:
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuc253ZHd5cWtmZndydHVqZ25oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzc3MTIsImV4cCI6MjA2MjY1MzcxMn0.K9jQkzph55H3atNXjho3Ih_ZX9TMk8dkAXf0WbLV2Zo",
        endpoints,
    },
    preview: {
        baseUrl: "https://nzcoafnsdupsgxcvayqy.supabase.co",
        anonKey:
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56Y29hZm5zZHVwc2d4Y3ZheXF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcxNDQ4NjYsImV4cCI6MjA2MjcyMDg2Nn0.iijo68UmY8aI35YJZ8DoI5k8exqFn4xHPhvOZouVcYU",
        endpoints,
    },
    production: {
        baseUrl: "https://nzcoafnsdupsgxcvayqy.supabase.co",
        anonKey:
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56Y29hZm5zZHVwc2d4Y3ZheXF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcxNDQ4NjYsImV4cCI6MjA2MjcyMDg2Nn0.iijo68UmY8aI35YJZ8DoI5k8exqFn4xHPhvOZouVcYU",
        endpoints,
    },
};

// Determine current environment
const getEnvironment = (): Environment => {
    if (typeof window !== "undefined") {
        const hostname = window.location.hostname;
        if (hostname === "localhost" || hostname === "127.0.0.1") {
            return "local";
        }
        if (hostname.includes("preview")) {
            return "preview";
        }
        if (hostname.includes("production")) {
            return "production";
        }
        return "development";
    }
    return "local";
};

// Export current configuration
export const config = configs[getEnvironment()];

// Helper function to get full API URL
export const getApiUrl = (endpoint: keyof ApiConfig["endpoints"]): string => {
    return `${config.baseUrl}${config.endpoints[endpoint]}`;
};
