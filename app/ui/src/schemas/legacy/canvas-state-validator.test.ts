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

  const anotherValidLegacyCanvasState = {
    pieces: [
      {
        id: "stopper_i",
        instanceId: "1",
        x: 310.265625,
        y: 164.25,
        shortName: "I",
        is_dynamic: false,
        parameters: {},
        parity_check_matrix: [[0, 0]],
        logical_legs: [],
        gauge_legs: [],
        pushedLegs: [],
        selectedMatrixRows: []
      },
      {
        id: "stopper_i",
        instanceId: "2",
        x: 309.265625,
        y: 248.25,
        shortName: "I",
        is_dynamic: false,
        parameters: {},
        parity_check_matrix: [[0, 0]],
        logical_legs: [],
        gauge_legs: [],
        pushedLegs: [],
        selectedMatrixRows: []
      },
      {
        id: "stopper_i",
        instanceId: "3",
        x: 320.265625,
        y: 342.25,
        shortName: "I",
        is_dynamic: false,
        parameters: {},
        parity_check_matrix: [[0, 0]],
        logical_legs: [],
        gauge_legs: [],
        pushedLegs: [],
        selectedMatrixRows: []
      },
      {
        id: "h",
        instanceId: "4",
        x: 750.265625,
        y: 152.25,
        shortName: "H",
        is_dynamic: false,
        parameters: {},
        parity_check_matrix: [
          [1, 0, 0, 1],
          [0, 1, 1, 0]
        ],
        logical_legs: [],
        gauge_legs: [],
        pushedLegs: [],
        selectedMatrixRows: []
      },
      {
        id: "h",
        instanceId: "5",
        x: 751.265625,
        y: 274.25,
        shortName: "H",
        is_dynamic: false,
        parameters: {},
        parity_check_matrix: [
          [1, 0, 0, 1],
          [0, 1, 1, 0]
        ],
        logical_legs: [],
        gauge_legs: [],
        pushedLegs: [],
        selectedMatrixRows: []
      },
      {
        id: "z_rep_code",
        instanceId: "6",
        x: 620,
        y: 234,
        shortName: "ZREP3",
        is_dynamic: true,
        parameters: { d: 3 },
        parity_check_matrix: [
          [0, 0, 0, 1, 1, 0],
          [0, 0, 0, 0, 1, 1],
          [1, 1, 1, 0, 0, 0]
        ],
        logical_legs: [],
        gauge_legs: [],
        pushedLegs: [],
        selectedMatrixRows: []
      },
      {
        id: "x_rep_code",
        instanceId: "7",
        x: 467,
        y: 238,
        shortName: "XREP3",
        is_dynamic: true,
        parameters: { d: 3 },
        parity_check_matrix: [
          [1, 1, 0, 0, 0, 0, 0, 0],
          [0, 1, 1, 0, 0, 0, 0, 0],
          [0, 0, 1, 1, 0, 0, 0, 0],
          [0, 0, 0, 0, 1, 1, 1, 1]
        ],
        logical_legs: [],
        gauge_legs: [],
        pushedLegs: [],
        selectedMatrixRows: []
      }
    ],
    connections: [
      { from: { legoId: "7", legIndex: 0 }, to: { legoId: "6", legIndex: 2 } },
      { from: { legoId: "7", legIndex: 3 }, to: { legoId: "1", legIndex: 0 } },
      { from: { legoId: "7", legIndex: 2 }, to: { legoId: "2", legIndex: 0 } },
      { from: { legoId: "3", legIndex: 0 }, to: { legoId: "7", legIndex: 1 } },
      { from: { legoId: "6", legIndex: 0 }, to: { legoId: "4", legIndex: 1 } },
      { from: { legoId: "6", legIndex: 1 }, to: { legoId: "5", legIndex: 1 } }
    ],
    hideConnectedLegs: false
  };

  describe("validateLegacyCanvasState", () => {
    it("should validate a correct legacy canvas state", () => {
      const result = validateLegacyCanvasState(validLegacyCanvasState);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it("should validate a correct legacy canvas state for an old link", () => {
      const result = validateLegacyCanvasState(anotherValidLegacyCanvasState);
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
