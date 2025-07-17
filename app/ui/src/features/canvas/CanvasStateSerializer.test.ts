import { CanvasStateSerializer } from "./CanvasStateSerializer";
import { DroppedLego } from "../../stores/droppedLegoStore";
import { Connection } from "../../stores/connectionStore";
import { LogicalPoint } from "../../types/coordinates";
import { Viewport } from "../../stores/canvasUISlice";
import { PauliOperator } from "../../lib/types";
import {
  ParityCheckMatrix,
  WeightEnumerator
} from "../../stores/tensorNetworkStore";
import { TensorNetworkLeg } from "../../lib/TensorNetwork";
import { validateCanvasStateString } from "../../schemas/v1/canvas-state-validator";
import { CanvasStore } from "../../stores/canvasStateStore";

jest.mock("../../config/config");

// Mock the validation function
jest.mock("../../schemas/v1/canvas-state-validator", () => ({
  validateCanvasStateString: jest.fn().mockReturnValue({ isValid: true })
}));

// Mock the Legos class
jest.mock("../lego/Legos", () => ({
  Legos: {
    listAvailableLegos: jest.fn().mockReturnValue([
      {
        type_id: "h",
        name: "Hadamard",
        short_name: "H",
        description: "Hadamard gate",
        parity_check_matrix: [
          [1, 0],
          [0, 1]
        ],
        logical_legs: [0, 1],
        gauge_legs: []
      },
      {
        type_id: "steane_code",
        name: "Steane Code",
        short_name: "[[7,1,3]]",
        description: "CSS quantum error correcting code",
        parity_check_matrix: [
          [1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
          [0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1],
          [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1],
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1]
        ],
        logical_legs: [0, 1],
        gauge_legs: [2, 3]
      }
    ])
  }
}));

describe("CanvasStateSerializer", () => {
  let serializer: CanvasStateSerializer;

  beforeEach(() => {
    serializer = new CanvasStateSerializer();
  });

  // Helper function to create a mock canvas store
  const createMockCanvasStore = (overrides: Partial<CanvasStore> = {}) => {
    const mockLego = new DroppedLego(
      {
        type_id: "h",
        name: "Hadamard",
        short_name: "H",
        description: "Hadamard gate",
        parity_check_matrix: [
          [1, 0],
          [0, 1]
        ],
        logical_legs: [0, 1],
        gauge_legs: [],
        is_dynamic: false,
        parameters: {}
      },
      new LogicalPoint(100, 200),
      "lego-1"
    );

    const mockConnection = new Connection(
      { legoId: "lego-1", leg_index: 0 },
      { legoId: "lego-2", leg_index: 1 }
    );

    const mockViewport = new Viewport(
      800,
      600,
      1,
      new LogicalPoint(0, 0),
      null
    );

    const baseStore = {
      droppedLegos: [mockLego],
      connections: [mockConnection],
      title: "Test Canvas",
      hideConnectedLegs: false,
      hideIds: false,
      hideTypeIds: false,
      hideDanglingLegs: false,
      hideLegLabels: false,
      viewport: mockViewport,
      parityCheckMatrices: {},
      weightEnumerators: {},
      highlightedTensorNetworkLegs: {},
      selectedTensorNetworkParityCheckMatrixRows: {},
      ...overrides
    };

    return baseStore as CanvasStore;
  };

  describe("toSerializableCanvasState", () => {
    it("should serialize a basic canvas state", () => {
      const mockStore = createMockCanvasStore();
      const result = serializer.toSerializableCanvasState(mockStore);

      expect(result).toEqual({
        title: "Test Canvas",
        pieces: [
          {
            id: "h",
            instance_id: "lego-1",
            x: 100,
            y: 200,
            short_name: "H",
            is_dynamic: false,
            parameters: {},
            parity_check_matrix: [
              [1, 0],
              [0, 1]
            ],
            logical_legs: [0, 1],
            gauge_legs: [],
            selectedMatrixRows: [],
            highlightedLegConstraints: []
          }
        ],
        connections: [
          expect.objectContaining({
            from: { legoId: "lego-1", leg_index: 0 },
            to: { legoId: "lego-2", leg_index: 1 }
          })
        ],
        hideConnectedLegs: false,
        hideIds: false,
        hideTypeIds: false,
        hideDanglingLegs: false,
        hideLegLabels: false,
        viewport: expect.objectContaining({
          screenWidth: 800,
          screenHeight: 600,
          zoomLevel: 1,
          logicalPanOffset: expect.objectContaining({ x: 0, y: 0 })
        }),
        parityCheckMatrices: [],
        weightEnumerators: [],
        highlightedTensorNetworkLegs: [],
        selectedTensorNetworkParityCheckMatrixRows: []
      });
    });

    it("should serialize canvas state with complex arrays", () => {
      const mockParityCheckMatrix: ParityCheckMatrix = {
        matrix: [
          [1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
          [0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0]
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
      };

      const mockWeightEnumerator = new WeightEnumerator({
        taskId: "test-task",
        polynomial: "1 + 7*x^3 + 7*x^5 + x^7",
        openLegs: [{ instance_id: "lego-1", leg_index: 0 }]
      });

      const mockTensorNetworkLeg: TensorNetworkLeg = {
        instance_id: "lego-1",
        leg_index: 0
      };

      const mockStore = createMockCanvasStore({
        parityCheckMatrices: { "matrix-1": mockParityCheckMatrix },
        weightEnumerators: { "enum-1": [mockWeightEnumerator] },
        highlightedTensorNetworkLegs: {
          "leg-1": [{ leg: mockTensorNetworkLeg, operator: PauliOperator.X }]
        },
        selectedTensorNetworkParityCheckMatrixRows: { "matrix-1": [0, 2, 4] }
      });

      const result = serializer.toSerializableCanvasState(mockStore);

      expect(result.parityCheckMatrices).toEqual([
        { key: "matrix-1", value: mockParityCheckMatrix }
      ]);
      expect(result.weightEnumerators).toEqual([
        { key: "enum-1", value: [mockWeightEnumerator] }
      ]);
      expect(result.highlightedTensorNetworkLegs).toEqual([
        {
          key: "leg-1",
          value: [{ leg: mockTensorNetworkLeg, operator: PauliOperator.X }]
        }
      ]);
      expect(result.selectedTensorNetworkParityCheckMatrixRows).toEqual([
        { key: "matrix-1", value: [0, 2, 4] }
      ]);
    });

    it("should handle multiple legos with different properties", () => {
      const lego1 = new DroppedLego(
        {
          type_id: "h",
          name: "Hadamard",
          short_name: "H",
          description: "Hadamard gate",
          parity_check_matrix: [
            [1, 0],
            [0, 1]
          ],
          logical_legs: [0, 1],
          gauge_legs: [],
          is_dynamic: false,
          parameters: {}
        },
        new LogicalPoint(100, 200),
        "lego-1"
      );

      const lego2 = new DroppedLego(
        {
          type_id: "steane_code",
          name: "Steane Code",
          short_name: "[[7,1,3]]",
          description: "CSS quantum error correcting code",
          parity_check_matrix: [
            [1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
            [0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0]
          ],
          logical_legs: [0, 1],
          gauge_legs: [2, 3],
          is_dynamic: true,
          parameters: { threshold: 0.1 }
        },
        new LogicalPoint(300, 400),
        "lego-2",
        {
          selectedMatrixRows: [0, 1],
          highlightedLegConstraints: [
            { legIndex: 0, operator: PauliOperator.X },
            { legIndex: 1, operator: PauliOperator.Z }
          ]
        }
      );

      const mockStore = createMockCanvasStore({
        droppedLegos: [lego1, lego2]
      });

      const result = serializer.toSerializableCanvasState(mockStore);

      expect(result.pieces).toHaveLength(2);
      expect(result.pieces[1]).toEqual({
        id: "steane_code",
        instance_id: "lego-2",
        x: 300,
        y: 400,
        short_name: "[[7,1,3]]",
        is_dynamic: true,
        parameters: { threshold: 0.1 },
        parity_check_matrix: [
          [1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
          [0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0]
        ],
        logical_legs: [0, 1],
        gauge_legs: [2, 3],
        selectedMatrixRows: [0, 1],
        highlightedLegConstraints: [
          { legIndex: 0, operator: PauliOperator.X },
          { legIndex: 1, operator: PauliOperator.Z }
        ]
      });
    });
  });

  describe("rehydrate", () => {
    it("should rehydrate a basic canvas state", async () => {
      const canvasStateString = JSON.stringify({
        title: "Test Canvas Title",
        pieces: [
          {
            id: "h",
            instance_id: "lego-1",
            x: 100,
            y: 200,
            short_name: "H",
            is_dynamic: false,
            parameters: {},
            parity_check_matrix: [
              [1, 0],
              [0, 1]
            ],
            logical_legs: [0, 1],
            gauge_legs: [],
            selectedMatrixRows: [],
            highlightedLegConstraints: []
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
      });

      const result = await serializer.rehydrate(canvasStateString);

      expect(result.title).toBe("Test Canvas Title");
      expect(result.droppedLegos).toHaveLength(1);
      expect(result.droppedLegos[0].type_id).toBe("h");
      expect(result.droppedLegos[0].instance_id).toBe("lego-1");
      expect(result.droppedLegos[0].logicalPosition.x).toBe(100);
      expect(result.droppedLegos[0].logicalPosition.y).toBe(200);
      expect(result.connections).toHaveLength(1);
      expect(result.connections[0].from.legoId).toBe("lego-1");
      expect(result.viewport.screenWidth).toBe(800);
    });

    it("should handle empty canvas state", async () => {
      const result = await serializer.rehydrate("");

      expect(result.droppedLegos).toHaveLength(0);
      expect(result.connections).toHaveLength(0);
      expect(result.hideConnectedLegs).toBe(false);
      expect(result.title).toBe("");
    });

    it("should rehydrate complex canvas state with arrays", async () => {
      const canvasStateString = JSON.stringify({
        title: "Complex Test Canvas",
        pieces: [
          {
            id: "steane_code",
            instance_id: "lego-1",
            x: 100,
            y: 200,
            short_name: "[[7,1,3]]",
            is_dynamic: true,
            parameters: { threshold: 0.1 },
            parity_check_matrix: [
              [1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
              [0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0]
            ],
            logical_legs: [0, 1],
            gauge_legs: [2, 3],
            selectedMatrixRows: [0, 1],
            highlightedLegConstraints: [
              { legIndex: 0, operator: PauliOperator.X }
            ]
          }
        ],
        connections: [],
        hideConnectedLegs: true,
        hideIds: true,
        hideTypeIds: true,
        hideDanglingLegs: true,
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
                [0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0]
              ],
              legOrdering: [
                "lego-1:0",
                "lego-1:1",
                "lego-1:2",
                "lego-1:3",
                "lego-1:4",
                "lego-1:5",
                "lego-1:6"
              ]
            }
          }
        ],
        weightEnumerators: [
          {
            key: "enum-1",
            value: [
              {
                taskId: "test-task",
                polynomial: "1 + 7*x^3 + 7*x^5 + x^7",
                openLegs: [{ instance_id: "lego-1", leg_index: 0 }]
              }
            ]
          }
        ],
        highlightedTensorNetworkLegs: [
          {
            key: "leg-1",
            value: [
              {
                leg: { instance_id: "lego-1", leg_index: 0 },
                operator: PauliOperator.X
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
      });

      const result = await serializer.rehydrate(canvasStateString);

      expect(result.title).toBe("Complex Test Canvas");
      expect(result.droppedLegos).toHaveLength(1);
      expect(result.droppedLegos[0].selectedMatrixRows).toEqual([0, 1]);
      expect(result.droppedLegos[0].highlightedLegConstraints).toEqual([
        { legIndex: 0, operator: PauliOperator.X }
      ]);
      expect(result.hideConnectedLegs).toBe(true);
      expect(result.hideIds).toBe(true);
      expect(result.viewport.zoomLevel).toBe(1.5);
      expect(result.parityCheckMatrices["matrix-1"]).toEqual({
        matrix: [
          [1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
          [0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0]
        ],
        legOrdering: [
          "lego-1:0",
          "lego-1:1",
          "lego-1:2",
          "lego-1:3",
          "lego-1:4",
          "lego-1:5",
          "lego-1:6"
        ]
      });
      expect(
        result.selectedTensorNetworkParityCheckMatrixRows["matrix-1"]
      ).toEqual([0, 2, 4]);
    });

    it("should handle legacy format conversion", async () => {
      const legacyCanvasStateString = JSON.stringify({
        title: "Legacy Test Canvas",
        pieces: [
          {
            id: "h",
            instanceId: "lego-1", // Legacy field
            shortName: "H", // Legacy field
            x: 100,
            y: 200,
            parity_check_matrix: [
              [1, 0],
              [0, 1]
            ],
            logical_legs: [0, 1],
            gauge_legs: []
          }
        ],
        connections: [
          {
            from: { legoId: "lego-1", legIndex: 0 }, // Legacy field
            to: { legoId: "lego-2", legIndex: 1 } // Legacy field
          }
        ],
        hideConnectedLegs: false,
        // Add the missing arrays for legacy format
        parityCheckMatrices: [],
        weightEnumerators: [],
        highlightedTensorNetworkLegs: [],
        selectedTensorNetworkParityCheckMatrixRows: []
      });

      const result = await serializer.rehydrate(legacyCanvasStateString);

      expect(result.title).toBe("Legacy Test Canvas");
      expect(result.droppedLegos).toHaveLength(1);
      expect(result.droppedLegos[0].instance_id).toBe("lego-1");
      expect(result.droppedLegos[0].short_name).toBe("H");
      expect(result.connections).toHaveLength(1);
      expect(result.connections[0].from.leg_index).toBe(0);
      expect(result.connections[0].to.leg_index).toBe(1);
    });

    it("should throw error when piece has no parity check matrix", async () => {
      const invalidCanvasStateString = JSON.stringify({
        title: "Invalid Test Canvas",
        pieces: [
          {
            id: "h",
            instance_id: "lego-1",
            x: 100,
            y: 200,
            // Missing parity_check_matrix
            logical_legs: [0, 1],
            gauge_legs: []
          }
        ],
        connections: [],
        hideConnectedLegs: false,
        parityCheckMatrices: [],
        weightEnumerators: [],
        highlightedTensorNetworkLegs: [],
        selectedTensorNetworkParityCheckMatrixRows: []
      });

      await expect(
        serializer.rehydrate(invalidCanvasStateString)
      ).rejects.toThrow("Piece lego-1 (of type h) has no parity check matrix");
    });

    it("should handle custom dynamic lego not in predefined list", async () => {
      const canvasStateString = JSON.stringify({
        title: "Custom Lego Test Canvas",
        pieces: [
          {
            id: "custom_lego",
            instance_id: "lego-1",
            name: "Custom Lego",
            short_name: "CUSTOM",
            description: "A custom lego",
            x: 100,
            y: 200,
            is_dynamic: true,
            parameters: { param1: "value1" },
            parity_check_matrix: [
              [1, 1],
              [1, 0]
            ],
            logical_legs: [0],
            gauge_legs: [1]
          }
        ],
        connections: [],
        hideConnectedLegs: false,
        parityCheckMatrices: [],
        weightEnumerators: [],
        highlightedTensorNetworkLegs: [],
        selectedTensorNetworkParityCheckMatrixRows: []
      });

      const result = await serializer.rehydrate(canvasStateString);

      expect(result.droppedLegos).toHaveLength(1);
      expect(result.droppedLegos[0].type_id).toBe("custom_lego");
      expect(result.droppedLegos[0].name).toBe("Custom Lego");
      expect(result.droppedLegos[0].short_name).toBe("CUSTOM");
      expect(result.droppedLegos[0].is_dynamic).toBe(true);
      expect(result.droppedLegos[0].parameters).toEqual({ param1: "value1" });
    });
  });

  describe("decode", () => {
    it("should decode base64 encoded canvas state", async () => {
      const canvasState = {
        title: "Encoded Test Canvas",
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
            gauge_legs: []
          }
        ],
        connections: [],
        hideConnectedLegs: false,
        parityCheckMatrices: [],
        weightEnumerators: [],
        highlightedTensorNetworkLegs: [],
        selectedTensorNetworkParityCheckMatrixRows: []
      };

      const encoded = btoa(JSON.stringify(canvasState));
      const result = await serializer.decode(encoded);

      expect(result.title).toBe("Encoded Test Canvas");
      expect(result.droppedLegos).toHaveLength(1);
      expect(result.droppedLegos[0].type_id).toBe("h");
    });
  });

  describe("round-trip serialization", () => {
    it("should maintain state consistency through serialize -> deserialize cycle", async () => {
      // Create a complex mock store
      const mockLego = new DroppedLego(
        {
          type_id: "steane_code",
          name: "Steane Code",
          short_name: "[[7,1,3]]",
          description: "CSS quantum error correcting code",
          parity_check_matrix: [
            [1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
            [0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0]
          ],
          logical_legs: [0, 1],
          gauge_legs: [2, 3],
          is_dynamic: true,
          parameters: { threshold: 0.1 }
        },
        new LogicalPoint(100, 200),
        "lego-1",
        {
          selectedMatrixRows: [0, 1],
          highlightedLegConstraints: [
            { legIndex: 0, operator: PauliOperator.X }
          ]
        }
      );

      const mockStore = createMockCanvasStore({
        droppedLegos: [mockLego],
        title: "Round Trip Test Canvas",
        hideConnectedLegs: true,
        hideIds: true,
        parityCheckMatrices: {
          "matrix-1": {
            matrix: [
              [1, 0, 1],
              [0, 1, 1]
            ],
            legOrdering: [
              { instance_id: "lego-1", leg_index: 0 },
              { instance_id: "lego-1", leg_index: 1 },
              { instance_id: "lego-1", leg_index: 2 }
            ]
          }
        }
      });

      // Serialize
      const serialized = serializer.toSerializableCanvasState(mockStore);
      const jsonString = JSON.stringify(serialized);

      // Deserialize
      const deserialized = await serializer.rehydrate(jsonString);

      // Verify key properties are preserved
      expect(deserialized.droppedLegos).toHaveLength(1);
      expect(deserialized.title).toBe("Round Trip Test Canvas");
      expect(deserialized.droppedLegos[0].type_id).toBe("steane_code");
      expect(deserialized.droppedLegos[0].instance_id).toBe("lego-1");
      expect(deserialized.droppedLegos[0].logicalPosition.x).toBe(100);
      expect(deserialized.droppedLegos[0].logicalPosition.y).toBe(200);
      expect(deserialized.droppedLegos[0].selectedMatrixRows).toEqual([0, 1]);
      expect(deserialized.droppedLegos[0].highlightedLegConstraints).toEqual([
        { legIndex: 0, operator: PauliOperator.X }
      ]);
      expect(deserialized.hideConnectedLegs).toBe(true);
      expect(deserialized.hideIds).toBe(true);
      expect(deserialized.parityCheckMatrices["matrix-1"]).toEqual({
        matrix: [
          [1, 0, 1],
          [0, 1, 1]
        ],
        legOrdering: [
          { instance_id: "lego-1", leg_index: 0 },
          { instance_id: "lego-1", leg_index: 1 },
          { instance_id: "lego-1", leg_index: 2 }
        ]
      });
    });
  });

  describe("error handling", () => {
    it("should handle validation errors", async () => {
      (validateCanvasStateString as jest.Mock).mockReturnValueOnce({
        isValid: false,
        errors: ["Invalid canvas state format"]
      });

      const invalidCanvasStateString = JSON.stringify({
        invalid: "state"
      });

      await expect(
        serializer.rehydrate(invalidCanvasStateString)
      ).rejects.toThrow("Invalid canvas state: Invalid canvas state format");
    });

    it("should handle JSON parsing errors", async () => {
      const invalidJsonString = "invalid json";

      await expect(serializer.rehydrate(invalidJsonString)).rejects.toThrow();
    });
  });

  describe("tensornetwork property management", () => {
    it("should handle undefined tensornetwork properties when rehydrating", async () => {
      const canvasStateString = JSON.stringify({
        title: "TensorNetwork Test Canvas",
        pieces: [],
        connections: [],
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
        }
      });

      const result = await serializer.rehydrate(canvasStateString);
      expect(result.highlightedTensorNetworkLegs).toEqual({});
      expect(result.selectedTensorNetworkParityCheckMatrixRows).toEqual({});
      expect(result.parityCheckMatrices).toEqual({});
      expect(result.weightEnumerators).toEqual({});
    });
  });
});
