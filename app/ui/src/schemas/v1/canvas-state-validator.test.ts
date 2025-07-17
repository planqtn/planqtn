import {
  validateCanvasStateV1,
  validateEncodedCanvasState,
  isCanvasState
} from "./canvas-state-validator";

describe("Canvas State Validator", () => {
  const validCanvasState = {
    title: "Test Canvas",
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
    hideConnectedLegs: false,
    hideIds: false,
    hideTypeIds: false,
    hideDanglingLegs: false,
    hideLegLabels: false,
    viewport: {
      screenWidth: 800,
      screenHeight: 600,
      zoomLevel: 1,
      logicalPanOffset: { x: 0, y: 0 }
    },
    parityCheckMatrices: [],
    weightEnumerators: [],
    highlightedTensorNetworkLegs: [],
    selectedTensorNetworkParityCheckMatrixRows: []
  };

  const validCanvasStateWithArrays = {
    title: "Test Canvas",
    canvasId: "12345678-1234-1234-1234-123456789abc",
    pieces: [
      {
        id: "steane_code",
        instance_id: "lego-1",
        x: 100,
        y: 200,
        parity_check_matrix: [
          [1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
          [0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1],
          [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1],
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1]
        ],
        logical_legs: [0, 1],
        gauge_legs: [2, 3],
        name: "Steane Code",
        short_name: "[[7,1,3]]",
        description: "CSS quantum error correcting code"
      },
      {
        id: "cnot",
        instance_id: "lego-2",
        x: 300,
        y: 400,
        parity_check_matrix: [
          [1, 0, 1, 0],
          [0, 1, 0, 1]
        ],
        logical_legs: [0, 1],
        gauge_legs: [],
        name: "CNOT",
        short_name: "CNOT",
        description: "Controlled-NOT gate"
      }
    ],
    connections: [
      {
        from: { legoId: "lego-1", leg_index: 0 },
        to: { legoId: "lego-2", leg_index: 1 }
      }
    ],
    hideConnectedLegs: true,
    hideIds: false,
    hideTypeIds: true,
    hideDanglingLegs: false,
    hideLegLabels: true,
    viewport: {
      screenWidth: 1200,
      screenHeight: 800,
      zoomLevel: 1.5,
      logicalPanOffset: { x: 50, y: -25 }
    },
    parityCheckMatrices: [
      {
        key: "matrix-1",
        value: {
          matrix: [
            [1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
            [0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1],
            [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1]
          ],
          legOrdering: [
            { instance_id: "lego-1", leg_index: 0 },
            { instance_id: "lego-1", leg_index: 1 },
            { instance_id: "lego-1", leg_index: 2 },
            { instance_id: "lego-1", leg_index: 3 },
            { instance_id: "lego-1", leg_index: 4 },
            { instance_id: "lego-1", leg_index: 5 },
            { instance_id: "lego-1", leg_index: 6 }
          ]
        }
      },
      {
        key: "matrix-2",
        value: {
          matrix: [
            [1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1]
          ],
          legOrdering: [
            { instance_id: "lego-1", leg_index: 0 },
            { instance_id: "lego-1", leg_index: 1 }
          ]
        }
      }
    ],
    weightEnumerators: [
      {
        key: "enum-1",
        value: [
          {
            taskId: "task-1",
            polynomial: "1 + 7*x^3 + 7*x^5 + x^7",
            openLegs: [
              { instance_id: "lego-1", leg_index: 0 },
              { instance_id: "lego-1", leg_index: 1 }
            ]
          }
        ]
      },
      {
        key: "enum-2",
        value: [
          {
            openLegs: [{ instance_id: "lego-2", leg_index: 0 }]
          }
        ]
      }
    ],
    highlightedTensorNetworkLegs: [
      {
        key: "leg-1",
        value: [
          {
            leg: {
              instance_id: "lego-1",
              leg_index: 0
            },
            operator: "X"
          }
        ]
      },
      {
        key: "leg-2",
        value: [
          {
            leg: {
              instance_id: "lego-1",
              leg_index: 1
            },
            operator: "Z"
          }
        ]
      },
      {
        key: "leg-3",
        value: [
          {
            leg: {
              instance_id: "lego-2",
              leg_index: 0
            },
            operator: "Y"
          }
        ]
      }
    ],
    selectedTensorNetworkParityCheckMatrixRows: [
      {
        key: "matrix-1",
        value: [0, 2, 4]
      }
    ]
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

    it("should validate a correct canvas state without a title", () => {
      const result = validateCanvasStateV1({
        ...validCanvasState,
        title: undefined
      });
      if (!result.isValid) {
        console.log(result);
      }
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it("should validate canvas state with non-trivial array values", () => {
      const result = validateCanvasStateV1(validCanvasStateWithArrays);
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

    it("should reject canvas state with invalid parity check matrix structure", () => {
      const invalidState = {
        ...validCanvasState,
        parityCheckMatrices: [
          {
            name: "Invalid Matrix",
            matrix: [
              [1, 0, "invalid"], // String instead of number
              [0, 1, 0]
            ]
          }
        ]
      };

      const result = validateCanvasStateV1(invalidState);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it("should reject canvas state with invalid weight enumerator", () => {
      const invalidState = {
        ...validCanvasState,
        weightEnumerators: [
          {
            name: "Invalid Enumerator",
            coefficients: [1, 0, "invalid"] // String instead of number
          }
        ]
      };

      const result = validateCanvasStateV1(invalidState);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it("should reject canvas state with invalid highlighted tensor network legs", () => {
      const invalidState = {
        ...validCanvasState,
        highlightedTensorNetworkLegs: [
          {
            legoId: "lego-1",
            legIndex: 0,
            operator: "INVALID_OPERATOR" // Invalid operator
          }
        ]
      };

      const result = validateCanvasStateV1(invalidState);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it("should reject canvas state with invalid selected tensor network parity check matrix rows", () => {
      const invalidState = {
        ...validCanvasState,
        selectedTensorNetworkParityCheckMatrixRows: [0, 1, "invalid"] // String instead of number
      };

      const result = validateCanvasStateV1(invalidState);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it("should reject canvas state with missing required fields in array objects", () => {
      const invalidState = {
        ...validCanvasState,
        parityCheckMatrices: [
          {
            // Missing name
            matrix: [
              [1, 0],
              [0, 1]
            ]
          }
        ]
      };

      const result = validateCanvasStateV1(invalidState);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it("should validate canvas state with complex tensor network configuration", () => {
      const complexState = {
        ...validCanvasStateWithArrays,
        highlightedTensorNetworkLegs: [
          {
            key: "tensornetwork-id-generated-1",
            value: [
              {
                leg: {
                  instance_id: "lego-1",
                  leg_index: 0
                },
                operator: "X"
              },
              {
                leg: {
                  instance_id: "lego-1",
                  leg_index: 1
                },
                operator: "Z"
              }
            ]
          },
          {
            key: "tensornetwork-id-generated-2",
            value: [
              {
                leg: {
                  instance_id: "lego-1",
                  leg_index: 1
                },
                operator: "Z"
              }
            ]
          }
        ],
        selectedTensorNetworkParityCheckMatrixRows: [
          {
            key: "tensornetwork-id-generated-1",
            value: [0, 1, 2]
          }
        ]
      };

      const result = validateCanvasStateV1(complexState);
      if (!result.isValid) {
        console.log(result);
      }
      expect(result.isValid).toBe(true);

      expect(result.errors).toBeUndefined();
    });
  });

  describe("validateEncodedCanvasState", () => {
    it("should validate a correctly encoded canvas state", () => {
      const encoded = btoa(JSON.stringify(validCanvasState));
      const result = validateEncodedCanvasState(encoded);
      console.log(result);
      expect(result.isValid).toBe(true);
    });

    it("should validate encoded canvas state with non-trivial arrays", () => {
      const encoded = btoa(JSON.stringify(validCanvasStateWithArrays));
      const result = validateEncodedCanvasState(encoded);
      if (!result.isValid) {
        console.log(result);
      }
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it("should validate legacy format with fallback", () => {
      const encoded = btoa(JSON.stringify(validLegacyCanvasState));
      const result = validateEncodedCanvasState(encoded);
      if (!result.isValid) {
        console.log(result);
      }
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
      const result = isCanvasState(validCanvasState);
      if (!result) {
        console.log(result);
      }
      expect(result).toBe(true);
    });

    it("should return true for valid canvas state with arrays", () => {
      const result = isCanvasState(validCanvasStateWithArrays);
      if (!result) {
        console.log(result);
      }
      expect(result).toBe(true);
    });

    it("should return false for invalid canvas state", () => {
      const invalidState = { invalid: "data" };
      expect(isCanvasState(invalidState)).toBe(false);
    });
  });
});
