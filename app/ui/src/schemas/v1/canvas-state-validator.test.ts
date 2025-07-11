import {
  validateCanvasStateV1,
  validateEncodedCanvasState,
  isCanvasState
} from "./canvas-state-validator";

describe("Canvas State Validator", () => {
  const validCanvasState = {
    canvasId: "12345678-1234-1234-1234-123456789abc",
    pieces: [
      {
        id: "h",
        instance_id: "lego-1",
        x: 100,
        y: 200,
        parity_check_matrix: [
          [1, 0],
          [0, 1]
        ],
        logical_legs: [0, 1],
        gauge_legs: [],
        name: "Hadamard",
        short_name: "H",
        description: "Hadamard gate"
      }
    ],
    connections: [
      {
        from: { legoId: "lego-1", leg_index: 0 },
        to: { legoId: "lego-2", leg_index: 1 }
      }
    ],
    hideConnectedLegs: false
  };

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

  describe("validateCanvasStateV1", () => {
    it("should validate a correct canvas state", () => {
      const result = validateCanvasStateV1(validCanvasState);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it("should reject canvas state with missing required fields", () => {
      const invalidState = {
        canvasId: "test",
        pieces: [
          {
            id: "h",
            // Missing instance_id, x, y, parity_check_matrix
            name: "Hadamard"
          }
        ],
        connections: [],
        hideConnectedLegs: false
      };

      const result = validateCanvasStateV1(invalidState);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it("should reject canvas state with invalid connection format", () => {
      const invalidState = {
        ...validCanvasState,
        connections: [
          {
            from: { legoId: "lego-1" }, // Missing leg_index
            to: { legoId: "lego-2", leg_index: 1 }
          }
        ]
      };

      const result = validateCanvasStateV1(invalidState);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe("validateEncodedCanvasState", () => {
    it("should validate a correctly encoded canvas state", () => {
      const encoded = btoa(JSON.stringify(validCanvasState));
      const result = validateEncodedCanvasState(encoded);
      console.log(result);
      expect(result.isValid).toBe(true);
    });

    it("should validate legacy format with fallback", () => {
      const encoded = btoa(JSON.stringify(validLegacyCanvasState));
      const result = validateEncodedCanvasState(encoded);
      expect(result.isValid).toBe(true);
    });

    it("should reject invalid base64 string", () => {
      const result = validateEncodedCanvasState("invalid-base64");
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it("should reject invalid JSON in base64", () => {
      const result = validateEncodedCanvasState(btoa("invalid json"));
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe("isCanvasState", () => {
    it("should return true for valid canvas state", () => {
      expect(isCanvasState(validCanvasState)).toBe(true);
    });

    it("should return false for invalid canvas state", () => {
      const invalidState = { invalid: "data" };
      expect(isCanvasState(invalidState)).toBe(false);
    });
  });
});
