import { AxiosError } from "axios";
import { SupabaseClient } from "@supabase/supabase-js";

export function getAxiosErrorMessage(
  error: AxiosError<{ message: string; error: string; status: number }>
): string {
  return `${error.message ? "Message: " + error.message : ""} ${error.response ? "Status: " + error.response.status + " Error: " + error.response.data.error : ""}`;
}

export async function checkSupabaseStatus(
  supabaseClient: SupabaseClient,
  retries = 1
): Promise<{ isHealthy: boolean; message: string }> {
  try {
    // Try to make a simple query to check if Supabase is responding
    const { error } = await supabaseClient.from("").select("1");

    if (error) {
      return {
        isHealthy: false,
        message: `Upstream service error: ${error.message || error.details || "Unknown error"}`
      };
    }

    return {
      isHealthy: true,
      message: "Connected to Supabase"
    };
  } catch (error: unknown) {
    // Check for specific error types
    const err = error as { message?: string };

    if (err.message && err.message.includes("fetch")) {
      // Network error
      if (
        err.message.includes("Failed to fetch") ||
        err.message.includes("NetworkError")
      ) {
        return {
          isHealthy: false,
          message: "Network error: Cannot connect to the backend service"
        };
      }
    }

    // Check for CORS errors
    if (err.message && err.message.includes("CORS")) {
      return {
        isHealthy: false,
        message:
          "CORS error: The backend service is not accessible from this origin"
      };
    }

    // If we have retries left, try again
    if (retries > 0) {
      // Wait a bit before retrying
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return checkSupabaseStatus(supabaseClient, retries - 1);
    }

    // Generic error fallback
    return {
      isHealthy: false,
      message: `Connection error: ${err.message || "Unknown error"}`
    };
  }
}
