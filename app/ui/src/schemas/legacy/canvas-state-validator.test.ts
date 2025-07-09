import {
  validateLegacyCanvasState,
  validateEncodedLegacyCanvasState,
  isLegacyCanvasState
} from "./canvas-state-validator";

describe("Legacy Canvas State Validator", () => {
  const validLegacyCanvasState = {
    canvasId: "12345678-1234-1234-1234-123456789abc",
    pieces: [
      {
        id: "h",
        instanceId: "lego-1",
        x: 100,
        y: 200,
        parity_check_matrix: [
          [1, 0],
          [0, 1]
        ],
        logical_legs: [0, 1],
        gauge_legs: [],
        name: "Hadamard",
        shortName: "H",
        description: "Hadamard gate"
      }
    ],
    connections: [
      {
        from: { legoId: "lego-1", legIndex: 0 },
        to: { legoId: "lego-2", legIndex: 1 }
      }
    ],
    hideConnectedLegs: false
  };

  describe("validateLegacyCanvasState", () => {
    it("should validate a correct legacy canvas state", () => {
      const result = validateLegacyCanvasState(validLegacyCanvasState);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it("should reject canvas state with missing required fields", () => {
      const invalidState = {
        canvasId: "test",
        pieces: [
          {
            id: "h",
            // Missing instanceId, x, y, parity_check_matrix
            name: "Hadamard"
          }
        ],
        connections: [],
        hideConnectedLegs: false
      };

      const result = validateLegacyCanvasState(invalidState);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it("should reject canvas state with invalid connection format", () => {
      const invalidState = {
        ...validLegacyCanvasState,
        connections: [
          {
            from: { legoId: "lego-1" }, // Missing legIndex
            to: { legoId: "lego-2", legIndex: 1 }
          }
        ]
      };

      const result = validateLegacyCanvasState(invalidState);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe("validateEncodedLegacyCanvasState", () => {
    it("should validate a correctly encoded legacy canvas state", () => {
      const encoded = btoa(JSON.stringify(validLegacyCanvasState));
      const result = validateEncodedLegacyCanvasState(encoded);
      expect(result.isValid).toBe(true);
    });

    it("should reject invalid base64 string", () => {
      const result = validateEncodedLegacyCanvasState("invalid-base64");
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe("isLegacyCanvasState", () => {
    it("should return true for valid legacy canvas state", () => {
      expect(isLegacyCanvasState(validLegacyCanvasState)).toBe(true);
    });

    it("should return false for invalid canvas state", () => {
      const invalidState = { invalid: "data" };
      expect(isLegacyCanvasState(invalidState)).toBe(false);
    });
  });
});
