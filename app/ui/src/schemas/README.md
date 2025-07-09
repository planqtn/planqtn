# Canvas State Schemas

This directory contains JSON schemas and validation utilities for canvas state in PlanqTN Studio.

## Overview

The canvas state validation system supports two formats:

1. **v1 Schema** - Current format with snake_case field naming
2. **Legacy Schema** - Previous format with camelCase field naming

The system automatically detects and validates against the appropriate schema, with fallback support for legacy formats.

## Directory Structure

```
schemas/
├── v1/
│   ├── canvas-state.json          # Current schema (snake_case)
│   ├── canvas-state-validator.ts  # v1 validation utilities
│   ├── canvas-state-validator.test.ts
│   ├── index.ts                   # v1 exports
│   └── README.md
├── legacy/
│   ├── canvas-state.json          # Legacy schema (camelCase)
│   ├── canvas-state-validator.ts  # Legacy validation utilities
│   ├── canvas-state-validator.test.ts
│   └── index.ts                   # Legacy exports
└── README.md                      # This file
```

## Field Naming Differences

### Current Format (v1)

- `instance_id` - Unique instance identifier
- `short_name` - Short display name
- `leg_index` - Leg index in connections
- `type_id` - Type identifier (in some contexts)

### Legacy Format

- `instanceId` - Unique instance identifier
- `shortName` - Short display name
- `legIndex` - Leg index in connections
- `id` - Type identifier

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

// Validate a base64 encoded string (with legacy fallback)
const encodedResult = validateEncodedCanvasState(encodedString);
if (!encodedResult.isValid) {
  console.error("Validation errors:", encodedResult.errors);
}
```

### Legacy Validation

```typescript
import {
  validateLegacyCanvasState,
  validateEncodedLegacyCanvasState
} from "./schemas/legacy";

// Validate legacy format directly
const legacyResult = validateLegacyCanvasState(legacyCanvasState);
if (legacyResult.isValid) {
  console.log("Valid legacy format");
}
```

## Fallback System

The `validateEncodedCanvasState` function implements automatic fallback:

1. **Primary Validation**: Attempts to validate against v1 schema
2. **Legacy Fallback**: If v1 validation fails, attempts legacy schema validation
3. **Conversion**: If legacy validation succeeds, the data is automatically converted to current format
4. **Error Reporting**: Returns v1 validation errors if both schemas fail

### Example

```typescript
// This will work with both current and legacy formats
const result = validateEncodedCanvasState(encodedString);

if (result.isValid) {
  // Data is valid (either v1 or legacy format)
  console.log("Canvas state is valid");
} else {
  // Both v1 and legacy validation failed
  console.error("Invalid canvas state:", result.errors);
}
```

## Integration with CanvasStateSerializer

The `CanvasStateSerializer` class automatically:

1. Validates incoming encoded strings
2. Detects legacy format and converts to current format
3. Provides backward compatibility for old URLs and saved states

### Legacy Format Detection

```typescript
// The serializer automatically detects legacy format by checking for:
// - instanceId instead of instance_id
// - shortName instead of short_name
// - legIndex instead of leg_index

const isLegacyFormat = decoded.pieces?.some(
  (piece) => piece.instanceId !== undefined && piece.shortName !== undefined
);
```

### Automatic Conversion

When legacy format is detected, the serializer automatically converts:

```typescript
// Legacy to Current conversion
decoded.pieces = decoded.pieces.map((piece) => ({
  ...piece,
  instance_id: piece.instanceId,
  short_name: piece.shortName,
  type_id: piece.id
}));

// Connection format conversion
decoded.connections = decoded.connections.map((conn) => ({
  from: {
    legoId: conn.from.legoId,
    leg_index: conn.from.legIndex
  },
  to: {
    legoId: conn.to.legoId,
    leg_index: conn.to.legIndex
  }
}));
```

## Testing

Both schemas include comprehensive test suites:

```bash
# Test v1 schema
npm test -- --testPathPattern=v1/canvas-state-validator.test.ts

# Test legacy schema
npm test -- --testPathPattern=legacy/canvas-state-validator.test.ts
```

## Migration Guide

### For Developers

1. **New Code**: Use the current v1 schema format
2. **Existing Code**: Legacy format is automatically supported via fallback
3. **URLs**: Old URLs with legacy format will continue to work
4. **Data Migration**: No manual migration required - automatic conversion

### For Users

- **Existing URLs**: Continue to work without changes
- **New URLs**: Use current format (automatic)
- **Saved States**: Automatically converted when loaded

## Schema Evolution

When introducing new schema versions:

1. Create a new schema file in a versioned directory
2. Update the fallback chain in `validateEncodedCanvasState`
3. Add conversion logic to `CanvasStateSerializer`
4. Include comprehensive tests
5. Update this documentation

## Error Handling

The validation system provides detailed error messages:

```typescript
const result = validateEncodedCanvasState(encodedString);
if (!result.isValid) {
  console.error("Validation failed:");
  result.errors?.forEach((error) => {
    console.error(`- ${error}`);
  });
}
```

Common error patterns:

- Missing required fields
- Invalid field types
- Malformed JSON
- Invalid base64 encoding
- Schema version mismatches
