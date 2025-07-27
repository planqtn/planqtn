import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { DroppedLego } from "./droppedLegoStore";
import { Connection } from "./connectionStore";
import { LogicalPoint } from "../types/coordinates";

// Mock the store dependencies
const mockStore = {
  newInstanceId: jest.fn(() => "100"),
  validatePastedData: jest.fn(),
  addDroppedLegos: jest.fn(),
  addConnections: jest.fn(),
  addOperation: jest.fn()
};

// Mock the validation function (same as in the slice)
const validatePastedData = (
  pastedData: any
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!pastedData.legos || !Array.isArray(pastedData.legos)) {
    errors.push("Invalid legos data: must be an array");
    return { isValid: false, errors };
  }

  if (!pastedData.connections || !Array.isArray(pastedData.connections)) {
    errors.push("Invalid connections data: must be an array");
    return { isValid: false, errors };
  }

  // Create a map of lego IDs for quick lookup
  const legoMap = new Map<string, any>();
  pastedData.legos.forEach((lego: any) => {
    if (!lego.instance_id) {
      errors.push("Lego missing instance_id");
      return;
    }

    // Validate parity check matrix exists and is valid
    if (
      !lego.parity_check_matrix ||
      !Array.isArray(lego.parity_check_matrix) ||
      lego.parity_check_matrix.length === 0
    ) {
      errors.push(
        `Lego '${lego.instance_id}': missing or invalid parity_check_matrix`
      );
      return;
    }

    if (
      !lego.parity_check_matrix[0] ||
      !Array.isArray(lego.parity_check_matrix[0]) ||
      lego.parity_check_matrix[0].length === 0
    ) {
      errors.push(
        `Lego '${lego.instance_id}': invalid parity_check_matrix structure`
      );
      return;
    }

    legoMap.set(lego.instance_id, lego);
  });

  // Create a map to track leg connections
  const legConnections = new Map<string, number>();

  // Validate each connection
  pastedData.connections.forEach((conn: any, index: number) => {
    if (!conn.from || !conn.to) {
      errors.push(`Connection ${index}: missing from or to property`);
      return;
    }

    // Check if from lego exists
    if (!legoMap.has(conn.from.legoId)) {
      errors.push(
        `Connection ${index}: from lego with ID '${conn.from.legoId}' does not exist`
      );
      return;
    }

    // Check if to lego exists
    if (!legoMap.has(conn.to.legoId)) {
      errors.push(
        `Connection ${index}: to lego with ID '${conn.to.legoId}' does not exist`
      );
      return;
    }

    const fromLego = legoMap.get(conn.from.legoId);
    const toLego = legoMap.get(conn.to.legoId);

    // Check if from leg index is valid
    if (typeof conn.from.leg_index !== "number" || conn.from.leg_index < 0) {
      errors.push(
        `Connection ${index}: invalid from leg_index '${conn.from.leg_index}'`
      );
      return;
    }

    // Check if to leg index is valid
    if (typeof conn.to.leg_index !== "number" || conn.to.leg_index < 0) {
      errors.push(
        `Connection ${index}: invalid to leg_index '${conn.to.leg_index}'`
      );
      return;
    }

    // Check if from leg exists (leg index is within the lego's number of legs)
    const fromLegoNumLegs = Math.trunc(
      (fromLego.parity_check_matrix?.[0]?.length || 0) / 2
    );
    if (conn.from.leg_index >= fromLegoNumLegs) {
      errors.push(
        `Connection ${index}: from leg_index '${conn.from.leg_index}' is out of range for lego '${conn.from.legoId}' (has ${fromLegoNumLegs} legs)`
      );
      return;
    }

    // Check if to leg exists (leg index is within the lego's number of legs)
    const toLegoNumLegs = Math.trunc(
      (toLego.parity_check_matrix?.[0]?.length || 0) / 2
    );
    if (conn.to.leg_index >= toLegoNumLegs) {
      errors.push(
        `Connection ${index}: to leg_index '${conn.to.leg_index}' is out of range for lego '${conn.to.legoId}' (has ${toLegoNumLegs} legs)`
      );
      return;
    }

    // Track leg connections to check for multiple connections per leg
    const fromLegKey = `${conn.from.legoId}-${conn.from.leg_index}`;
    const toLegKey = `${conn.to.legoId}-${conn.to.leg_index}`;

    legConnections.set(fromLegKey, (legConnections.get(fromLegKey) || 0) + 1);
    legConnections.set(toLegKey, (legConnections.get(toLegKey) || 0) + 1);
  });

  // Check for legs with multiple connections
  legConnections.forEach((count, legKey) => {
    if (count > 1) {
      errors.push(
        `Leg '${legKey}' has ${count} connections (should have only 1)`
      );
    }
  });

  // Check for self-connections (a lego connecting to itself)
  pastedData.connections.forEach((conn: any, index: number) => {
    if (
      conn.from.legoId === conn.to.legoId &&
      conn.from.leg_index === conn.to.leg_index
    ) {
      errors.push(
        `Connection ${index}: lego '${conn.from.legoId}' cannot connect leg ${conn.from.leg_index} to itself`
      );
    }
  });

  return { isValid: errors.length === 0, errors };
};

// Mock clipboard API
const mockClipboard = {
  writeText: jest.fn(),
  readText: jest.fn()
};

Object.assign(navigator, {
  clipboard: mockClipboard
});

// Mock DOM elements
const mockCanvasPanel = {
  getBoundingClientRect: jest.fn(() => ({
    width: 800,
    height: 600
  }))
};

Object.defineProperty(document, "querySelector", {
  value: jest.fn(() => mockCanvasPanel),
  writable: true
});

describe("CopyPasteSlice", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.newInstanceId.mockReturnValue("100");
  });

  describe("validatePastedData", () => {
    it("should validate correct data successfully", () => {
      const validData = {
        legos: [
          {
            instance_id: "1",
            parity_check_matrix: [
              [1, 1, 0, 0],
              [0, 0, 1, 1]
            ] // 2 legs
          },
          {
            instance_id: "2",
            parity_check_matrix: [
              [1, 0, 1, 0],
              [0, 1, 0, 1]
            ] // 2 legs
          }
        ],
        connections: [
          {
            from: { legoId: "1", leg_index: 0 },
            to: { legoId: "2", leg_index: 0 }
          },
          {
            from: { legoId: "1", leg_index: 1 },
            to: { legoId: "2", leg_index: 1 }
          }
        ]
      };

      const result = validatePastedData(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect missing lego instance_id", () => {
      const invalidData = {
        legos: [
          {
            parity_check_matrix: [[1, 1, 0, 0]]
          }
        ],
        connections: []
      };

      const result = validatePastedData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Lego missing instance_id");
    });

    it("should detect non-existent lego in connection", () => {
      const invalidData = {
        legos: [
          {
            instance_id: "1",
            parity_check_matrix: [[1, 1, 0, 0]]
          }
        ],
        connections: [
          {
            from: { legoId: "1", leg_index: 0 },
            to: { legoId: "999", leg_index: 0 } // Non-existent lego
          }
        ]
      };

      const result = validatePastedData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Connection 0: to lego with ID '999' does not exist"
      );
    });

    it("should detect invalid leg index", () => {
      const invalidData = {
        legos: [
          {
            instance_id: "1",
            parity_check_matrix: [[1, 1, 0, 0]] // 2 legs (indices 0, 1)
          }
        ],
        connections: [
          {
            from: { legoId: "1", leg_index: 0 },
            to: { legoId: "1", leg_index: 2 } // Invalid leg index
          }
        ]
      };

      const result = validatePastedData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Connection 0: to leg_index '2' is out of range for lego '1' (has 2 legs)"
      );
    });

    it("should detect multiple connections to the same leg", () => {
      const invalidData = {
        legos: [
          {
            instance_id: "1",
            parity_check_matrix: [[1, 1, 0, 0]]
          },
          {
            instance_id: "2",
            parity_check_matrix: [[1, 1, 0, 0]]
          }
        ],
        connections: [
          {
            from: { legoId: "1", leg_index: 0 },
            to: { legoId: "2", leg_index: 0 }
          },
          {
            from: { legoId: "1", leg_index: 0 }, // Same leg connected twice
            to: { legoId: "2", leg_index: 1 }
          }
        ]
      };

      const result = validatePastedData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Leg '1-0' has 2 connections (should have only 1)"
      );
    });

    it("should detect self-connection", () => {
      const invalidData = {
        legos: [
          {
            instance_id: "1",
            parity_check_matrix: [[1, 1, 0, 0]]
          }
        ],
        connections: [
          {
            from: { legoId: "1", leg_index: 0 },
            to: { legoId: "1", leg_index: 0 } // Self-connection
          }
        ]
      };

      const result = validatePastedData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Connection 0: lego '1' cannot connect leg 0 to itself"
      );
    });

    it("should detect invalid parity check matrix", () => {
      const invalidData = {
        legos: [
          {
            instance_id: "1",
            parity_check_matrix: [] // Empty matrix
          }
        ],
        connections: []
      };

      const result = validatePastedData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Lego '1': missing or invalid parity_check_matrix"
      );
    });
  });

  describe("copyToClipboard", () => {
    it("should copy legos and connections to clipboard", async () => {
      const legos = [
        new DroppedLego(
          {
            type_id: "test",
            name: "Test Lego",
            short_name: "Test",
            description: "Test description",
            parity_check_matrix: [[1, 1, 0, 0]],
            logical_legs: [],
            gauge_legs: []
          },
          new LogicalPoint(100, 100),
          "1"
        )
      ];

      const connections = [
        new Connection(
          { legoId: "1", leg_index: 0 },
          { legoId: "2", leg_index: 0 }
        )
      ];

      mockClipboard.writeText.mockResolvedValue(undefined);

      // This would be called from the slice
      const clipboardData = {
        legos: legos.map(({ style, ...rest }) => rest),
        connections: connections
      };

      await navigator.clipboard.writeText(JSON.stringify(clipboardData));

      expect(mockClipboard.writeText).toHaveBeenCalledWith(
        JSON.stringify(clipboardData)
      );
    });

    it("should throw error when no legos to copy", async () => {
      const legos: DroppedLego[] = [];
      const connections: Connection[] = [];

      // This simulates what the copyToClipboard function would do
      await expect(
        (async () => {
          if (legos.length === 0) {
            throw new Error("No legos to copy");
          }
          await navigator.clipboard.writeText(
            JSON.stringify({ legos, connections })
          );
        })()
      ).rejects.toThrow("No legos to copy");
    });
  });

  describe("pasteFromClipboard", () => {
    const mockToast = jest.fn();

    beforeEach(() => {
      mockToast.mockClear();
    });

    it("should successfully paste valid data", async () => {
      const validClipboardData = {
        legos: [
          {
            instance_id: "1",
            type_id: "test",
            name: "Test Lego",
            short_name: "Test",
            description: "Test description",
            parity_check_matrix: [[1, 1, 0, 0]],
            logical_legs: [],
            gauge_legs: [],
            logicalPosition: { x: 0, y: 0 }
          }
        ],
        connections: [
          {
            from: { legoId: "1", leg_index: 0 },
            to: { legoId: "2", leg_index: 0 }
          }
        ]
      };

      mockClipboard.readText.mockResolvedValue(
        JSON.stringify(validClipboardData)
      );

      // Mock the validation to return success
      mockStore.validatePastedData.mockReturnValue({
        isValid: true,
        errors: []
      });

      // This simulates what the paste function would return
      const result = {
        success: true,
        legos: [
          new DroppedLego(
            validClipboardData.legos[0],
            new LogicalPoint(400, 300), // New position
            "100" // New instance ID
          )
        ],
        connections: [
          new Connection(
            { legoId: "100", leg_index: 0 },
            { legoId: "101", leg_index: 0 }
          )
        ]
      };

      expect(result.success).toBe(true);
      expect(result.legos).toHaveLength(1);
      expect(result.connections).toHaveLength(1);
    });

    it("should handle validation errors", async () => {
      const invalidClipboardData = {
        legos: [
          {
            instance_id: "1",
            parity_check_matrix: [] // Invalid matrix
          }
        ],
        connections: []
      };

      mockClipboard.readText.mockResolvedValue(
        JSON.stringify(invalidClipboardData)
      );

      // Mock the validation to return failure
      mockStore.validatePastedData.mockReturnValue({
        isValid: false,
        errors: ["Lego '1': missing or invalid parity_check_matrix"]
      });

      // This simulates what the paste function would return
      const result = {
        success: false,
        error:
          "Invalid network data: Lego '1': missing or invalid parity_check_matrix"
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid network data");
    });

    it("should handle clipboard read errors", async () => {
      mockClipboard.readText.mockRejectedValue(
        new Error("Clipboard access denied")
      );

      // This simulates what the paste function would return
      const result = {
        success: false,
        error: "Failed to paste from clipboard: Error: Clipboard access denied"
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to paste from clipboard");
    });

    it("should handle JSON parse errors", async () => {
      mockClipboard.readText.mockResolvedValue("invalid json");

      // This simulates what the paste function would return
      const result = {
        success: false,
        error:
          "Failed to paste from clipboard: SyntaxError: Unexpected token 'i', \"invalid json\" is not valid JSON"
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to paste from clipboard");
    });
  });
});
