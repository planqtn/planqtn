export class RuntimeConfigService {
  static applyConfig(config: Record<string, string>) {
    // Store the config in localStorage
    localStorage.setItem("runtimeConfig", JSON.stringify(config));
    // Set the active flag
    localStorage.setItem("runtimeConfigActive", "true");

    // Reload the page
    window.location.reload();
  }

  static switchToCloud() {
    localStorage.setItem("runtimeConfigActive", "false");

    // Reload the page
    window.location.reload();
  }

  static getCurrentConfig(): Record<string, string> | null {
    const storedConfig = localStorage.getItem("runtimeConfig");
    if (storedConfig) {
      try {
        return JSON.parse(storedConfig);
      } catch {
        return null;
      }
    }
    return null;
  }

  static isLocalRuntime(): boolean {
    return localStorage.getItem("runtimeConfigActive") === "true";
  }
}
