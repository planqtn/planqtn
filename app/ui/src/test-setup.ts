// Mock the config module to avoid import.meta.env issues in tests
jest.mock("./config/config", () => ({
  config: {
    userContextURL: "http://test-url",
    userContextAnonKey: "test-anon-key",
    runtimeStoreUrl: "http://test-runtime-url",
    runtimeStoreAnonKey: "test-runtime-anon-key",
    env: "test" as const,
    endpoints: {
      tensorNetwork: "/functions/v1/tensornetwork",
      planqtnJob: "/functions/v1/planqtn_job_run",
      planqtnJobLogs: "/functions/v1/planqtn_job_logs_run",
      cancelJob: "/functions/v1/cancel_job_run",
      version: "/functions/v1/version"
    }
  },
  getApiUrl: jest.fn(
    (endpoint: string) => `http://test-url/functions/v1/${endpoint}`
  )
}));

// Mock localStorage for tests
Object.defineProperty(window, "localStorage", {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  },
  writable: true
});

// Mock crypto.randomUUID for tests
Object.defineProperty(global, "crypto", {
  value: {
    randomUUID: jest.fn(() => "test-uuid")
  },
  writable: true
});

// Set window.location properties directly for tests
window.location.search = "?canvasId=test-canvas-id";
window.location.pathname = "/test";
window.location.hash = "";
window.history.replaceState = jest.fn();
