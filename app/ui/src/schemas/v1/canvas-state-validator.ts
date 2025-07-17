import Ajv from "ajv";
import * as LZString from "lz-string";

import canvasStateSchemaV1 from "./canvas-state.json";
import { validateLegacyCanvasState } from "../legacy/canvas-state-validator";

// Initialize Ajv validator
const ajv = new Ajv({
  allErrors: true,
  verbose: true
});

// Add the schema to Ajv
const validateCanvasState = ajv.compile(canvasStateSchemaV1);

export interface CanvasStateValidationResult {
  isValid: boolean;
  errors?: string[];
}

/**
 * Validates a canvas state object against the v1 schema
 * @param state - The canvas state object to validate
 * @returns Validation result with success status and any errors
 */
export function validateCanvasStateV1(
  state: unknown
): CanvasStateValidationResult {
  const isValid = validateCanvasState(state);

  if (isValid) {
    return { isValid: true };
  }

  const errors =
    validateCanvasState.errors?.map((error) => {
      const path = error.instancePath || "root";
      return `${path}: ${error.message}`;
    }) || [];

  return {
    isValid: false,
    errors
  };
}

/**
 * Validates a JSON canvas state string with fallback to legacy schema
 * @param canvasStateString - JSON canvas state string
 * @returns Validation result with success status and any errors
 */
export function validateCanvasStateString(
  canvasStateString: string
): CanvasStateValidationResult {
  try {
    const parsedCanvasStateObj = JSON.parse(canvasStateString);

    // First try v1 schema validation
    const v1Result = validateCanvasStateV1(parsedCanvasStateObj);
    if (v1Result.isValid) {
      return v1Result;
    }
    console.log("v1 failed...", v1Result);

    // If v1 validation fails, try legacy schema validation
    const legacyResult = validateLegacyCanvasState(parsedCanvasStateObj);
    if (legacyResult.isValid) {
      console.warn(
        "Canvas state validated against legacy schema. Consider updating to v1 format."
      );
      return { isValid: true };
    }

    console.log("legacy failed...", legacyResult);

    // If both fail, return the v1 errors
    return v1Result;
  } catch (error) {
    return {
      isValid: false,
      errors: [
        `Failed to validate canvas state string: ${error instanceof Error ? error.message : "Unknown error"}`
      ]
    };
  }
}

/**
 * Validates an encoded canvas state string with fallback to legacy schema
 * Supports both lz-string compressed and base64 encoded formats
 * @param encodedState - Encoded canvas state string (lz-string or base64)
 * @returns Validation result with success status and any errors
 */
export function validateEncodedCanvasState(
  encodedState: string
): CanvasStateValidationResult {
  try {
    // Try to decode as lz-string compressed format first (new format)
    const decompressed =
      LZString.decompressFromEncodedURIComponent(encodedState);
    if (decompressed) {
      return validateCanvasStateString(decompressed);
    }
  } catch (error) {
    console.log(
      "Failed to validate as lz-string, trying legacy base64 format",
      error
    );
  }

  try {
    // Fall back to legacy base64 format for backward compatibility
    const decoded = atob(encodedState);
    return validateCanvasStateString(decoded);
  } catch (error) {
    return {
      isValid: false,
      errors: [
        `Failed to validate encoded canvas state string: ${error instanceof Error ? error.message : "Unknown error"}`
      ]
    };
  }
}

/**
 * Type guard to check if an object is a valid canvas state
 * @param state - The object to check
 * @returns True if the object is a valid canvas state
 */
export function isCanvasState(state: unknown): state is {
  canvasId: string;
  pieces: Array<{
    id: string;
    instance_id: string;
    x: number;
    y: number;
    is_dynamic?: boolean;
    parameters?: Record<string, unknown>;
    parity_check_matrix: number[][];
    logical_legs?: number[];
    gauge_legs?: number[];
    name?: string;
    short_name?: string;
    description?: string;
    selectedMatrixRows?: number[];
  }>;
  connections: Array<{
    from: { legoId: string; leg_index: number };
    to: { legoId: string; leg_index: number };
  }>;
  hideConnectedLegs: boolean;
} {
  return validateCanvasStateV1(state).isValid;
}
