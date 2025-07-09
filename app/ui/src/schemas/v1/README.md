# Canvas State Schema v1

This directory contains the JSON schema and validation utilities for canvas state in PlanqTN Studio.

## Files

- `canvas-state.json` - JSON Schema definition for canvas state v1
- `canvas-state-validator.ts` - TypeScript validation utilities using Ajv
- `canvas-state-validator.test.ts` - Tests for the validation utilities
- `index.ts` - Export file for easy imports

## Usage

### Basic Validation

```typescript
import {
  validateCanvasStateV1,
  validateEncodedCanvasState
} from "./schemas/v1";

// Validate a canvas state object
const result = validateCanvasStateV1(canvasState);
if (!result.isValid) {
  console.error("Validation errors:", result.errors);
}

// Validate a base64 encoded string
const encodedResult = validateEncodedCanvasState(encodedString);
if (!encodedResult.isValid) {
  console.error("Validation errors:", encodedResult.errors);
}
```

### Type Guard

```typescript
import { isCanvasState } from "./schemas/v1";

if (isCanvasState(someObject)) {
  // TypeScript now knows someObject is a valid canvas state
  console.log(someObject.canvasId);
}
```

## Schema Structure

The canvas state schema validates the following structure:

```typescript
interface CanvasState {
  canvasId: string; // UUID format
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
}
```

## Validation Rules

- `canvasId` must be a valid UUID v4 format
- `pieces` must be an array of objects with required fields
- Each piece must have a non-empty `parity_check_matrix`
- `connections` must be an array of valid connection objects
- Connection `leg_index` values must be non-negative integers
- All required fields must be present
- No additional properties are allowed

## Integration with CanvasStateSerializer

The `CanvasStateSerializer` class now uses this validation in its `decode` method to ensure that incoming canvas state strings are valid before processing them.
