import {
  CanvasStateSerializer,
  CompressedCanvasState
} from "./CanvasStateSerializer";
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

    it("should rehydrate a canvas state without a title", async () => {
      const canvasStateString = JSON.stringify({
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

      expect(result.title).toBe("Untitled canvas");
      expect(result.droppedLegos).toHaveLength(0);
      expect(result.connections).toHaveLength(0);
      expect(result.viewport.screenWidth).toBe(800);
    });

    it("should handle empty canvas state", async () => {
      const result = await serializer.rehydrate("");

      expect(result.droppedLegos).toHaveLength(0);
      expect(result.connections).toHaveLength(0);
      expect(result.hideConnectedLegs).toBe(true);
      expect(result.title).toBe("Untitled canvas");
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

  describe("compressed format serialization", () => {
    it("should convert to compressed format", () => {
      const mockStore = createMockCanvasStore({
        title: "Compressed Test Canvas",
        hideConnectedLegs: true,
        hideIds: false,
        hideTypeIds: true,
        hideDanglingLegs: false,
        hideLegLabels: true
      });

      const compressed = serializer.toCompressedCanvasState(mockStore);

      expect(compressed).toHaveLength(6); // Basic required fields
      expect(compressed[0]).toBe("Compressed Test Canvas"); // title
      expect(compressed[1]).toHaveLength(1); // pieces array
      expect(compressed[2]).toHaveLength(1); // connections array
      expect(compressed[3]).toBe(21); // boolean flags (1 + 4 + 16 = 21)
      expect(compressed[4]).toEqual([800, 600, 1, 0, 0]); // viewport
      expect(compressed[5]).toHaveLength(1); // matrix table

      // Check piece structure
      const piece = compressed[1][0];
      expect(piece[0]).toBe("h"); // type_id
      expect(piece[1]).toBe("lego-1"); // instance_id
      expect(piece[2]).toBe(100); // x
      expect(piece[3]).toBe(200); // y
      expect(piece[4]).toBe("pcm_0"); // matrix id

      // Check connection structure
      const connection = compressed[2][0];
      expect(connection).toEqual(["lego-1", 0, "lego-2", 1]);

      // Check matrix table
      expect(compressed[5][0]).toEqual([
        "pcm_0",
        [
          [1, 0],
          [0, 1]
        ]
      ]);
    });

    it("should handle complex compressed state with optional fields", () => {
      const lego = new DroppedLego(
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
        new LogicalPoint(150.123, 250.789),
        "steane-1",
        {
          selectedMatrixRows: [0, 1],
          highlightedLegConstraints: [
            { legIndex: 0, operator: PauliOperator.X },
            { legIndex: 1, operator: PauliOperator.Z }
          ]
        }
      );

      const mockStore = createMockCanvasStore({
        droppedLegos: [lego],
        connections: [],
        parityCheckMatrices: {
          "matrix-1": {
            matrix: [
              [1, 0, 1],
              [0, 1, 1]
            ],
            legOrdering: [
              { instance_id: "steane-1", leg_index: 0 },
              { instance_id: "steane-1", leg_index: 1 }
            ]
          }
        },
        weightEnumerators: {
          "enum-1": [
            new WeightEnumerator({
              taskId: "test-task",
              polynomial: "1 + 7*x^3",
              openLegs: [{ instance_id: "steane-1", leg_index: 0 }]
            })
          ]
        }
      });

      const compressed = serializer.toCompressedCanvasState(mockStore);

      expect(compressed).toHaveLength(8); // Has optional fields

      // Check piece with all optional fields
      const piece = compressed[1][0];
      expect(piece[5]).toEqual([0, 1]); // logical_legs
      expect(piece[6]).toEqual([2, 3]); // gauge_legs
      expect(piece[7]).toBe("[[7,1,3]]"); // short_name
      expect(piece[8]).toBe(true); // is_dynamic
      expect(piece[9]).toEqual({ threshold: 0.1 }); // parameters
      expect(piece[10]).toEqual([0, 1]); // selectedMatrixRows
      expect(piece[11]).toEqual([
        { legIndex: 0, operator: PauliOperator.X },
        { legIndex: 1, operator: PauliOperator.Z }
      ]); // highlightedLegConstraints

      // Check rounded coordinates
      expect(piece[2]).toBe(150.12); // x rounded to 2 decimals
      expect(piece[3]).toBe(250.79); // y rounded to 2 decimals

      // Check optional complex fields
      expect(compressed[6]).toBeDefined(); // parityCheckMatrices
      expect(compressed[7]).toBeDefined(); // weightEnumerators
    });

    it("should handle matrix deduplication in compressed format", () => {
      const sharedMatrix = [
        [1, 0, 1],
        [0, 1, 1]
      ];

      const lego1 = new DroppedLego(
        {
          type_id: "lego_a",
          name: "Lego A",
          short_name: "A",
          description: "First lego",
          parity_check_matrix: sharedMatrix,
          logical_legs: [0],
          gauge_legs: [],
          is_dynamic: false,
          parameters: {}
        },
        new LogicalPoint(100, 200),
        "lego-1"
      );

      const lego2 = new DroppedLego(
        {
          type_id: "lego_b",
          name: "Lego B",
          short_name: "B",
          description: "Second lego",
          parity_check_matrix: sharedMatrix, // Same matrix
          logical_legs: [0],
          gauge_legs: [],
          is_dynamic: false,
          parameters: {}
        },
        new LogicalPoint(300, 400),
        "lego-2"
      );

      const mockStore = createMockCanvasStore({
        droppedLegos: [lego1, lego2],
        connections: []
      });

      const compressed = serializer.toCompressedCanvasState(mockStore);

      // Should have only one matrix entry in the table
      expect(compressed[5]).toHaveLength(1);
      expect(compressed[5][0]).toEqual(["pcm_0", sharedMatrix]);

      // Both pieces should reference the same matrix ID
      expect(compressed[1][0][4]).toBe("pcm_0");
      expect(compressed[1][1][4]).toBe("pcm_0");
    });
  });

  describe("compressed format deserialization", () => {
    it("should convert from compressed format to serializable state", () => {
      const compressed: CompressedCanvasState = [
        "Compressed Test", // title
        [
          // pieces
          [
            "h", // type_id
            "lego-1", // instance_id
            100, // x
            200, // y
            "pcm_0", // matrix_id
            [0, 1], // logical_legs
            [], // gauge_legs
            "H" // short_name
          ]
        ],
        [
          // connections
          ["lego-1", 0, "lego-2", 1]
        ],
        5, // boolean flags (hideConnectedLegs=true, hideIds=false, hideTypeIds=true)
        [800, 600, 1.5, 50, -25], // viewport
        [
          [
            "pcm_0",
            [
              [1, 0],
              [0, 1]
            ]
          ]
        ] // matrix table
      ];

      const result = serializer.fromCompressedCanvasState(compressed);

      expect(result.title).toBe("Compressed Test");
      expect(result.pieces).toHaveLength(1);
      expect(result.connections).toHaveLength(1);
      expect(result.hideConnectedLegs).toBe(true);
      expect(result.hideIds).toBe(false);
      expect(result.hideTypeIds).toBe(true);
      expect(result.hideDanglingLegs).toBe(false);
      expect(result.hideLegLabels).toBe(false);

      // Check piece
      const piece = result.pieces[0];
      expect(piece.id).toBe("h");
      expect(piece.instance_id).toBe("lego-1");
      expect(piece.x).toBe(100);
      expect(piece.y).toBe(200);
      expect(piece.parity_check_matrix).toEqual([
        [1, 0],
        [0, 1]
      ]);
      expect(piece.logical_legs).toEqual([0, 1]);
      expect(piece.gauge_legs).toEqual([]);
      expect(piece.short_name).toBe("H");
      expect(piece.is_dynamic).toBe(false);
      expect(piece.parameters).toEqual({});

      // Check connection
      expect(result.connections[0].from.legoId).toBe("lego-1");
      expect(result.connections[0].from.leg_index).toBe(0);
      expect(result.connections[0].to.legoId).toBe("lego-2");
      expect(result.connections[0].to.leg_index).toBe(1);

      // Check viewport
      expect(result.viewport.screenWidth).toBe(800);
      expect(result.viewport.screenHeight).toBe(600);
      expect(result.viewport.zoomLevel).toBe(1.5);
      expect(result.viewport.logicalPanOffset.x).toBe(50);
      expect(result.viewport.logicalPanOffset.y).toBe(-25);
    });

    it("should handle compressed format with all optional fields", () => {
      const compressed: CompressedCanvasState = [
        "Complex Compressed", // title
        [
          // pieces
          [
            "steane_code", // type_id
            "steane-1", // instance_id
            150, // x
            250, // y
            "pcm_0", // matrix_id
            [0, 1], // logical_legs
            [2, 3], // gauge_legs
            "[[7,1,3]]", // short_name
            true, // is_dynamic
            { threshold: 0.1 }, // parameters
            [0, 1], // selectedMatrixRows
            [{ legIndex: 0, operator: PauliOperator.X }] // highlightedLegConstraints
          ]
        ],
        [], // connections
        31, // all boolean flags true (1+2+4+8+16)
        [1200, 800, 2.0, 100, 50], // viewport
        [
          [
            "pcm_0",
            [
              [1, 0, 1],
              [0, 1, 1]
            ]
          ]
        ], // matrix table
        [
          // parityCheckMatrices
          [
            "matrix-1",
            {
              matrix: [
                [1, 0],
                [0, 1]
              ],
              legOrdering: [{ instance_id: "steane-1", leg_index: 0 }]
            }
          ]
        ],
        [
          // weightEnumerators
          [
            "enum-1",
            [
              new WeightEnumerator({
                taskId: "test-task",
                polynomial: "1 + x^2",
                openLegs: [{ instance_id: "steane-1", leg_index: 0 }]
              })
            ]
          ]
        ]
      ];

      const result = serializer.fromCompressedCanvasState(compressed);

      expect(result.title).toBe("Complex Compressed");
      expect(result.hideConnectedLegs).toBe(true);
      expect(result.hideIds).toBe(true);
      expect(result.hideTypeIds).toBe(true);
      expect(result.hideDanglingLegs).toBe(true);
      expect(result.hideLegLabels).toBe(true);

      // Check piece with all optional fields
      const piece = result.pieces[0];
      expect(piece.is_dynamic).toBe(true);
      expect(piece.parameters).toEqual({ threshold: 0.1 });
      expect(piece.selectedMatrixRows).toEqual([0, 1]);
      expect(piece.highlightedLegConstraints).toEqual([
        { legIndex: 0, operator: PauliOperator.X }
      ]);

      // Check optional complex fields
      expect(result.parityCheckMatrices).toHaveLength(1);
      expect(result.weightEnumerators).toHaveLength(1);
    });

    it("should handle minimal compressed format", () => {
      const compressed: CompressedCanvasState = [
        "", // empty title
        [], // no pieces
        [], // no connections
        0, // no boolean flags
        [800, 600, 1, 0, 0], // default viewport
        [] // no matrices
      ];

      const result = serializer.fromCompressedCanvasState(compressed);

      expect(result.title).toBe("");
      expect(result.pieces).toHaveLength(0);
      expect(result.connections).toHaveLength(0);
      expect(result.hideConnectedLegs).toBe(false);
      expect(result.hideIds).toBe(false);
      expect(result.hideTypeIds).toBe(false);
      expect(result.hideDanglingLegs).toBe(false);
      expect(result.hideLegLabels).toBe(false);
      expect(result.parityCheckMatrices).toHaveLength(0);
      expect(result.weightEnumerators).toHaveLength(0);
    });
  });

  describe("URL compression", () => {
    it("should encode and decode compressed state for URL", () => {
      const mockStore = createMockCanvasStore({
        title: "URL Test Canvas"
      });

      const compressed = serializer.toCompressedCanvasState(mockStore);
      const encoded = serializer.encodeCompressedForUrl(compressed);
      const decoded = serializer.decodeCompressedFromUrl(encoded);

      // Should be able to round-trip (with some type normalization)
      expect(decoded[0]).toBe("URL Test Canvas"); // title preserved
      expect(decoded[1]).toHaveLength(1); // pieces array preserved
      expect(decoded[2]).toHaveLength(1); // connections array preserved
      // Note: Some undefined values may become null during JSON serialization
    });

    it("should handle complex state in URL compression", () => {
      const lego = new DroppedLego(
        {
          type_id: "complex_lego",
          name: "Complex Lego",
          short_name: "COMPLEX",
          description: "A complex lego for URL testing",
          parity_check_matrix: [
            [1, 1, 0, 1, 0],
            [0, 1, 1, 0, 1],
            [1, 0, 1, 1, 0]
          ],
          logical_legs: [0, 1],
          gauge_legs: [2, 3, 4],
          is_dynamic: true,
          parameters: {
            threshold: 0.05,
            iterations: 100,
            method: "advanced"
          }
        },
        new LogicalPoint(123.456, 789.012),
        "complex-1",
        {
          selectedMatrixRows: [0, 2],
          highlightedLegConstraints: [
            { legIndex: 0, operator: PauliOperator.X },
            { legIndex: 1, operator: PauliOperator.Y },
            { legIndex: 2, operator: PauliOperator.Z }
          ]
        }
      );

      const mockStore = createMockCanvasStore({
        droppedLegos: [lego],
        title: "Complex URL Test",
        hideConnectedLegs: true,
        hideIds: true,
        hideTypeIds: false,
        hideDanglingLegs: true,
        hideLegLabels: false,
        parityCheckMatrices: {
          "complex-matrix": {
            matrix: [
              [1, 0, 1, 0, 1],
              [0, 1, 0, 1, 0]
            ],
            legOrdering: [
              { instance_id: "complex-1", leg_index: 0 },
              { instance_id: "complex-1", leg_index: 1 },
              { instance_id: "complex-1", leg_index: 2 },
              { instance_id: "complex-1", leg_index: 3 },
              { instance_id: "complex-1", leg_index: 4 }
            ]
          }
        }
      });

      const compressed = serializer.toCompressedCanvasState(mockStore);
      const encoded = serializer.encodeCompressedForUrl(compressed);
      const decoded = serializer.decodeCompressedFromUrl(encoded);

      expect(decoded).toEqual(compressed);

      // Verify the encoded string is reasonably compact and URL-safe
      expect(encoded).toMatch(/^[A-Za-z0-9\-_.!~*'()+/]*$/); // URL-safe characters (LZ-String base64-like)
      expect(encoded.length).toBeLessThan(JSON.stringify(compressed).length); // Should be compressed
    });

    it("should throw error on invalid compressed URL data", () => {
      expect(() => {
        serializer.decodeCompressedFromUrl("invalid-compressed-data");
      }).toThrow("Failed to decompress canvas state from URL");
    });

    it("should handle empty compressed state in URL format", () => {
      const minimal: CompressedCanvasState = [
        "",
        [],
        [],
        0,
        [800, 600, 1, 0, 0],
        []
      ];

      const encoded = serializer.encodeCompressedForUrl(minimal);
      const decoded = serializer.decodeCompressedFromUrl(encoded);

      expect(decoded).toEqual(minimal);
    });
  });

  describe("compressed format round-trip", () => {
    it("should maintain state consistency through compress -> decompress cycle", () => {
      // Create a comprehensive mock store
      const lego1 = new DroppedLego(
        {
          type_id: "hadamard",
          name: "Hadamard Gate",
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
        "h-1"
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
        "steane-1",
        {
          selectedMatrixRows: [0],
          highlightedLegConstraints: [
            { legIndex: 0, operator: PauliOperator.Z }
          ]
        }
      );

      const connection = new Connection(
        { legoId: "h-1", leg_index: 1 },
        { legoId: "steane-1", leg_index: 0 }
      );

      const mockStore = createMockCanvasStore({
        droppedLegos: [lego1, lego2],
        connections: [connection],
        title: "Round Trip Compressed Test",
        hideConnectedLegs: false,
        hideIds: true,
        hideTypeIds: false,
        hideDanglingLegs: true,
        hideLegLabels: false
      });

      // Compress
      const compressed = serializer.toCompressedCanvasState(mockStore);

      // Decompress
      const decompressed = serializer.fromCompressedCanvasState(compressed);

      // Verify key properties are preserved
      expect(decompressed.title).toBe("Round Trip Compressed Test");
      expect(decompressed.pieces).toHaveLength(2);
      expect(decompressed.connections).toHaveLength(1);
      expect(decompressed.hideConnectedLegs).toBe(false);
      expect(decompressed.hideIds).toBe(true);
      expect(decompressed.hideTypeIds).toBe(false);
      expect(decompressed.hideDanglingLegs).toBe(true);
      expect(decompressed.hideLegLabels).toBe(false);

      // Check piece preservation
      const hadamardPiece = decompressed.pieces.find(
        (p) => p.id === "hadamard"
      );
      const steanePiece = decompressed.pieces.find(
        (p) => p.id === "steane_code"
      );

      expect(hadamardPiece).toBeDefined();
      expect(hadamardPiece!.instance_id).toBe("h-1");
      expect(hadamardPiece!.x).toBe(100);
      expect(hadamardPiece!.y).toBe(200);
      expect(hadamardPiece!.is_dynamic).toBe(false);

      expect(steanePiece).toBeDefined();
      expect(steanePiece!.instance_id).toBe("steane-1");
      expect(steanePiece!.x).toBe(300);
      expect(steanePiece!.y).toBe(400);
      expect(steanePiece!.is_dynamic).toBe(true);
      expect(steanePiece!.parameters).toEqual({ threshold: 0.1 });
      expect(steanePiece!.selectedMatrixRows).toEqual([0]);
      expect(steanePiece!.highlightedLegConstraints).toEqual([
        { legIndex: 0, operator: PauliOperator.Z }
      ]);

      // Check connection preservation
      expect(decompressed.connections[0].from.legoId).toBe("h-1");
      expect(decompressed.connections[0].from.leg_index).toBe(1);
      expect(decompressed.connections[0].to.legoId).toBe("steane-1");
      expect(decompressed.connections[0].to.leg_index).toBe(0);
    });

    it("should handle full compression pipeline: store -> compressed -> URL -> compressed -> store", async () => {
      const mockStore = createMockCanvasStore({
        title: "Full Pipeline Test"
      });

      // Full pipeline
      const compressed = serializer.toCompressedCanvasState(mockStore);
      const urlEncoded = serializer.encodeCompressedForUrl(compressed);
      const urlDecoded = serializer.decodeCompressedFromUrl(urlEncoded);
      const finalState = serializer.fromCompressedCanvasState(urlDecoded);
      const rehydrated = await serializer.rehydrate(JSON.stringify(finalState));

      // Verify end-to-end preservation
      expect(rehydrated.title).toBe("Full Pipeline Test");
      expect(rehydrated.droppedLegos).toHaveLength(1);
      expect(rehydrated.droppedLegos[0].type_id).toBe("h");
      expect(rehydrated.droppedLegos[0].instance_id).toBe("lego-1");
      expect(rehydrated.connections).toHaveLength(1);
    });
  });
});
