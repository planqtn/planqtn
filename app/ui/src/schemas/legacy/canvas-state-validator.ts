import Ajv, { ErrorObject } from "ajv";
import legacyCanvasStateSchema from "./canvas-state.json";

// Initialize Ajv validator for legacy schema
const ajvLegacy = new Ajv({
  allErrors: true,
  verbose: true
});

// Add the legacy schema to Ajv
const validateLegacyCanvasStateCompiled = ajvLegacy.compile(
  legacyCanvasStateSchema
);

export interface LegacyCanvasStateValidationResult {
  isValid: boolean;
  errors?: string[];
}

/**
 * Validates a canvas state object against the legacy schema
 * @param state - The canvas state object to validate
 * @returns Validation result with success status and any errors
 */
export function validateLegacyCanvasState(
  state: unknown
): LegacyCanvasStateValidationResult {
  const isValid = validateLegacyCanvasStateCompiled(state);

  if (isValid) {
    return { isValid: true };
  }

  const errors =
    validateLegacyCanvasStateCompiled.errors?.map(
      (error: ErrorObject) =>
        `${error.instancePath} ${error.message || "Unknown error"}`
    ) || [];

  return {
    isValid: false,
    errors
  };
}

/**
 * Validates a base64 encoded canvas state string against the legacy schema
 * @param encoded - The base64 encoded canvas state string
 * @returns Validation result with success status and any errors
 */
export function validateEncodedLegacyCanvasState(
  encoded: string
): LegacyCanvasStateValidationResult {
  try {
    const decoded = JSON.parse(atob(encoded));
    return validateLegacyCanvasState(decoded);
  } catch (error) {
    return {
      isValid: false,
      errors: [
        `Failed to decode base64 string: ${error instanceof Error ? error.message : String(error)}`
      ]
    };
  }
}

/**
 * Type guard to check if an object is a valid legacy canvas state
 * @param state - The object to check
 * @returns True if the object is a valid legacy canvas state
 */
export function isLegacyCanvasState(
  state: unknown
): state is Record<string, unknown> {
  return validateLegacyCanvasState(state).isValid;
}
