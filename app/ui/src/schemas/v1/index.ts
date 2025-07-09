export {
  validateCanvasStateV1,
  validateEncodedCanvasState,
  isCanvasState
} from "./canvas-state-validator";
export type { CanvasStateValidationResult } from "./canvas-state-validator";
export { default as canvasStateSchema } from "./canvas-state.json";

// Re-export legacy schema for convenience
export * from "../legacy";
