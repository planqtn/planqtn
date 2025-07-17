import { Connection } from "../../stores/connectionStore";
import { DroppedLego, LegoPiece } from "../../stores/droppedLegoStore";
import { LogicalPoint } from "../../types/coordinates";
import { Legos } from "../lego/Legos";
import { validateCanvasStateString } from "../../schemas/v1/canvas-state-validator";
import { PauliOperator } from "../../lib/types";
import { CanvasStore } from "../../stores/canvasStateStore";
import { Viewport } from "../../stores/canvasUISlice";
import {
  ParityCheckMatrix,
  WeightEnumerator
} from "../../stores/tensorNetworkStore";
import { TensorNetworkLeg } from "../../lib/TensorNetwork";
import * as LZString from "lz-string";
import {
  SerializableCanvasState,
  SerializedLego
} from "../../schemas/v1/serializable-canvas-state";

// Compressed format types for URL sharing (array-based, no field names)
export type CompressedCanvasState = [
  string, // 0: title
  CompressedPiece[], // 1: pieces
  CompressedConnection[], // 2: connections
  number, // 3: boolean flags packed as bits (hideConnectedLegs, hideIds, etc.)
  CompressedViewport, // 4: viewport
  [string, number[][]][], // 5: parity_check_matrix_table
  // Optional fields (can be omitted if empty/default)
  [string, ParityCheckMatrix][]?, // 6: parityCheckMatrices
  [string, WeightEnumerator[]][]?, // 7: weightEnumerators
  [string, { leg: TensorNetworkLeg; operator: PauliOperator }[]][]?, // 8: highlightedTensorNetworkLegs
  [string, number[]][]? // 9: selectedTensorNetworkParityCheckMatrixRows
];

export type CompressedPiece = [
  string, // 0: id
  string, // 1: instance_id
  number, // 2: x
  number, // 3: y
  string, // 4: parity_check_matrix_id
  number[]?, // 5: logical_legs (optional)
  number[]?, // 6: gauge_legs (optional)
  string?, // 7: short_name (optional)
  boolean?, // 8: is_dynamic (optional)
  Record<string, unknown>?, // 9: parameters (optional)
  number[]?, // 10: selectedMatrixRows (optional)
  { legIndex: number; operator: PauliOperator }[]? // 11: highlightedLegConstraints (optional)
];

export type CompressedConnection = [
  string, // 0: from.legoId
  number, // 1: from.leg_index
  string, // 2: to.legoId
  number // 3: to.leg_index
];

export type CompressedViewport = [
  number, // 0: screenWidth
  number, // 1: screenHeight
  number, // 2: zoomLevel
  number, // 3: logicalPanOffset.x
  number // 4: logicalPanOffset.y
];

export interface RehydratedCanvasState {
  title: string;
  droppedLegos: DroppedLego[];
  connections: Connection[];
  hideConnectedLegs: boolean;
  hideIds: boolean;
  hideTypeIds: boolean;
  hideDanglingLegs: boolean;
  hideLegLabels: boolean;
  viewport: Viewport;
  parityCheckMatrices: Record<string, ParityCheckMatrix>;
  weightEnumerators: Record<string, WeightEnumerator[]>;
  highlightedTensorNetworkLegs: Record<
    string,
    {
      leg: TensorNetworkLeg;
      operator: PauliOperator;
    }[]
  >;
  selectedTensorNetworkParityCheckMatrixRows: Record<string, number[]>;
}
export class CanvasStateSerializer {
  public canvasId: string;

  constructor(canvasId?: string) {
    // Generate a unique canvas ID if not already set
    this.canvasId = canvasId || this.generateCanvasId();
  }

  private generateCanvasId(): string {
    // Generate a UUID v4
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }

  public toSerializableCanvasState(
    store: CanvasStore
  ): SerializableCanvasState {
    const state: SerializableCanvasState = {
      title: store.title, // Assuming store.title is available
      pieces: store.droppedLegos.map((piece) => ({
        id: piece.type_id,
        instance_id: piece.instance_id,
        x: piece.logicalPosition.x,
        y: piece.logicalPosition.y,
        short_name: piece.short_name,
        is_dynamic: piece.is_dynamic,
        parameters: piece.parameters,
        parity_check_matrix: piece.parity_check_matrix,
        logical_legs: piece.logical_legs,
        gauge_legs: piece.gauge_legs,
        selectedMatrixRows: piece.selectedMatrixRows,
        highlightedLegConstraints: piece.highlightedLegConstraints
      })),
      connections: store.connections,
      hideConnectedLegs: store.hideConnectedLegs,
      hideIds: store.hideIds,
      hideTypeIds: store.hideTypeIds,
      hideDanglingLegs: store.hideDanglingLegs,
      hideLegLabels: store.hideLegLabels,
      viewport: store.viewport.with({ canvasRef: null }),
      parityCheckMatrices: Object.entries(store.parityCheckMatrices).map(
        ([key, value]) => ({ key, value })
      ),
      weightEnumerators: Object.entries(store.weightEnumerators).map(
        ([key, value]) => ({ key, value })
      ),
      highlightedTensorNetworkLegs: Object.entries(
        store.highlightedTensorNetworkLegs
      ).map(([key, value]) => ({ key, value })),
      selectedTensorNetworkParityCheckMatrixRows: Object.entries(
        store.selectedTensorNetworkParityCheckMatrixRows
      ).map(([key, value]) => ({ key, value }))
    };

    return state;
  }

  public async rehydrate(
    canvasStateString: string
  ): Promise<RehydratedCanvasState> {
    const result: RehydratedCanvasState = {
      droppedLegos: [],
      connections: [],
      hideConnectedLegs: false,
      hideIds: false,
      hideTypeIds: false,
      hideDanglingLegs: false,
      hideLegLabels: false,
      title: "", // Initialize title
      viewport: new Viewport(800, 600, 1, new LogicalPoint(0, 0), null),
      parityCheckMatrices: {},
      weightEnumerators: {},
      highlightedTensorNetworkLegs: {},
      selectedTensorNetworkParityCheckMatrixRows: {}
    };

    if (canvasStateString === "") {
      return result;
    }

    try {
      // Validate the encoded state first
      const validationResult = validateCanvasStateString(canvasStateString);
      if (!validationResult.isValid) {
        console.error(
          "Canvas state validation failed:",
          validationResult.errors
        );
        throw new Error(
          `Invalid canvas state: ${validationResult.errors?.join(", ")}`
        );
      }

      const rawCanvasStateObj = JSON.parse(canvasStateString);

      // Check if this is legacy format and convert if needed
      const isLegacyFormat = rawCanvasStateObj.pieces?.some(
        (piece: Record<string, unknown>) =>
          piece.instanceId !== undefined && piece.shortName !== undefined
      );

      if (isLegacyFormat) {
        console.log("Converting legacy format to current format");
        // Convert legacy format to current format
        rawCanvasStateObj.pieces = rawCanvasStateObj.pieces.map(
          (piece: Record<string, unknown>) => ({
            ...piece,
            instance_id: piece.instanceId,
            short_name: piece.shortName,
            type_id: piece.id
          })
        );

        // Convert legacy connection format
        if (rawCanvasStateObj.connections) {
          rawCanvasStateObj.connections = rawCanvasStateObj.connections.map(
            (conn: Record<string, unknown>) => ({
              from: {
                legoId: (conn.from as Record<string, unknown>).legoId,
                leg_index: (conn.from as Record<string, unknown>).legIndex
              },
              to: {
                legoId: (conn.to as Record<string, unknown>).legoId,
                leg_index: (conn.to as Record<string, unknown>).legIndex
              }
            })
          );
        }
      }

      const decodedViewport = new Viewport(
        rawCanvasStateObj.viewport?.screenWidth || 800,
        rawCanvasStateObj.viewport?.screenHeight || 600,
        rawCanvasStateObj.viewport?.zoomLevel || 1,
        new LogicalPoint(
          rawCanvasStateObj.viewport?.logicalPanOffset?.x || 0,
          rawCanvasStateObj.viewport?.logicalPanOffset?.y || 0
        ),
        null
      );

      result.viewport = decodedViewport;
      result.parityCheckMatrices = rawCanvasStateObj.parityCheckMatrices
        ? Object.fromEntries(
            rawCanvasStateObj.parityCheckMatrices.map(
              (item: { key: string; value: ParityCheckMatrix }) => [
                item.key,
                item.value
              ]
            )
          )
        : {};
      result.weightEnumerators = rawCanvasStateObj.weightEnumerators
        ? Object.fromEntries(
            rawCanvasStateObj.weightEnumerators.map(
              (item: { key: string; value: WeightEnumerator[] }) => [
                item.key,
                item.value
              ]
            )
          )
        : {};
      result.highlightedTensorNetworkLegs =
        rawCanvasStateObj.highlightedTensorNetworkLegs
          ? Object.fromEntries(
              rawCanvasStateObj.highlightedTensorNetworkLegs.map(
                (item: {
                  key: string;
                  value: { leg: TensorNetworkLeg; operator: PauliOperator }[];
                }) => [item.key, item.value]
              )
            )
          : {};
      result.selectedTensorNetworkParityCheckMatrixRows =
        rawCanvasStateObj.selectedTensorNetworkParityCheckMatrixRows
          ? Object.fromEntries(
              rawCanvasStateObj.selectedTensorNetworkParityCheckMatrixRows.map(
                (item: { key: string; value: number[] }) => [
                  item.key,
                  item.value
                ]
              )
            )
          : {};
      result.hideConnectedLegs = rawCanvasStateObj.hideConnectedLegs || false;
      result.hideIds = rawCanvasStateObj.hideIds || false;
      result.hideTypeIds = rawCanvasStateObj.hideTypeIds || false;
      result.hideDanglingLegs = rawCanvasStateObj.hideDanglingLegs || false;
      result.hideLegLabels = rawCanvasStateObj.hideLegLabels || false;

      // Preserve the title from the decoded state if it exists
      if (rawCanvasStateObj.title) {
        result.title = rawCanvasStateObj.title;
      }

      if (
        !rawCanvasStateObj.pieces ||
        !Array.isArray(rawCanvasStateObj.pieces)
      ) {
        return result;
      }

      // Fetch legos if not already loaded
      const legosList = Legos.listAvailableLegos();

      // Reconstruct dropped legos with full lego information
      const reconstructedPieces = rawCanvasStateObj.pieces.map(
        (piece: SerializedLego) => {
          const predefinedLego = legosList.find((l) => l.type_id === piece.id);
          if (
            !piece.parity_check_matrix ||
            piece.parity_check_matrix.length === 0
          ) {
            throw new Error(
              `Piece ${piece.instance_id} (of type ${piece.id}) has no parity check matrix. Full state:\n${canvasStateString}`
            );
          }

          const legoPrototype: LegoPiece = predefinedLego
            ? {
                ...predefinedLego,

                is_dynamic: piece.is_dynamic || false,
                parameters: piece.parameters || {},
                parity_check_matrix: piece.parity_check_matrix || []
              }
            : {
                type_id: piece.id,
                name: piece.name || piece.id,
                short_name: piece.short_name || piece.id,
                description: piece.description || "",

                is_dynamic: piece.is_dynamic || false,
                parameters: piece.parameters || {},
                parity_check_matrix: piece.parity_check_matrix || [],
                logical_legs: piece.logical_legs || [],
                gauge_legs: piece.gauge_legs || []
              };

          // For regular legos, use the template
          return new DroppedLego(
            legoPrototype,
            new LogicalPoint(piece.x, piece.y),
            piece.instance_id,
            {
              selectedMatrixRows: piece.selectedMatrixRows || [],
              highlightedLegConstraints: piece.highlightedLegConstraints || []
            }
          );
        }
      );
      result.droppedLegos = reconstructedPieces;
      result.connections = rawCanvasStateObj.connections.map(
        (conn: Connection) => new Connection(conn.from, conn.to)
      );

      return result;
    } catch (error) {
      console.error("Error decoding canvas state:", error);
      throw error; // Re-throw the error instead of returning empty state
    }
  }

  public async decode(encoded: string): Promise<RehydratedCanvasState> {
    return this.rehydrate(atob(encoded));
  }

  public getCanvasId(): string {
    return this.canvasId;
  }

  /**
   * Convert standard canvas state to compressed format for URL sharing
   */
  public toCompressedCanvasState(store: CanvasStore): CompressedCanvasState {
    // Create symbol table for parity check matrices
    const matrixToId = new Map<string, string>();
    const matrixTable: [string, number[][]][] = [];
    let matrixCounter = 0;

    // Helper function to get or create matrix ID
    const getMatrixId = (matrix: number[][]): string => {
      const matrixKey = JSON.stringify(matrix);
      if (!matrixToId.has(matrixKey)) {
        const matrixId = `pcm_${matrixCounter++}`;
        matrixToId.set(matrixKey, matrixId);
        matrixTable.push([matrixId, matrix]);
      }
      return matrixToId.get(matrixKey)!;
    };

    // Pack boolean flags into a single number (bit flags)
    const packBooleanFlags = (
      hideConnectedLegs: boolean,
      hideIds: boolean,
      hideTypeIds: boolean,
      hideDanglingLegs: boolean,
      hideLegLabels: boolean
    ): number => {
      return (
        (hideConnectedLegs ? 1 : 0) |
        (hideIds ? 2 : 0) |
        (hideTypeIds ? 4 : 0) |
        (hideDanglingLegs ? 8 : 0) |
        (hideLegLabels ? 16 : 0)
      );
    };

    // Convert pieces to compressed format
    const compressedPieces: CompressedPiece[] = store.droppedLegos.map(
      (piece) => {
        const compressed: CompressedPiece = [
          piece.type_id, // 0: id
          piece.instance_id, // 1: instance_id
          Math.round(piece.logicalPosition.x * 100) / 100, // 2: x (rounded)
          Math.round(piece.logicalPosition.y * 100) / 100, // 3: y (rounded)
          getMatrixId(piece.parity_check_matrix) // 4: parity_check_matrix_id
        ];

        // Add optional fields only if they differ from defaults
        if (piece.logical_legs && piece.logical_legs.length > 0) {
          compressed[5] = piece.logical_legs;
        }
        if (piece.gauge_legs && piece.gauge_legs.length > 0) {
          compressed[6] = piece.gauge_legs;
        }
        if (piece.short_name && piece.short_name !== piece.type_id) {
          compressed[7] = piece.short_name;
        }
        if (piece.is_dynamic) {
          compressed[8] = piece.is_dynamic;
        }
        if (piece.parameters && Object.keys(piece.parameters).length > 0) {
          compressed[9] = piece.parameters;
        }
        if (piece.selectedMatrixRows && piece.selectedMatrixRows.length > 0) {
          compressed[10] = piece.selectedMatrixRows;
        }
        if (
          piece.highlightedLegConstraints &&
          piece.highlightedLegConstraints.length > 0
        ) {
          compressed[11] = piece.highlightedLegConstraints;
        }

        return compressed;
      }
    );

    // Convert connections to compressed format
    const compressedConnections: CompressedConnection[] = store.connections.map(
      (conn) => [
        conn.from.legoId, // 0: from.legoId
        conn.from.leg_index, // 1: from.leg_index
        conn.to.legoId, // 2: to.legoId
        conn.to.leg_index // 3: to.leg_index
      ]
    );

    // Convert viewport to compressed format
    const compressedViewport: CompressedViewport = [
      Math.round(store.viewport.screenWidth), // 0: screenWidth
      Math.round(store.viewport.screenHeight), // 1: screenHeight
      Math.round(store.viewport.zoomLevel * 1000) / 1000, // 2: zoomLevel (rounded)
      Math.round(store.viewport.logicalPanOffset.x * 100) / 100, // 3: logicalPanOffset.x
      Math.round(store.viewport.logicalPanOffset.y * 100) / 100 // 4: logicalPanOffset.y
    ];

    const compressed: CompressedCanvasState = [
      store.title, // 0: title
      compressedPieces, // 1: pieces
      compressedConnections, // 2: connections
      packBooleanFlags(
        // 3: boolean flags
        store.hideConnectedLegs,
        store.hideIds,
        store.hideTypeIds,
        store.hideDanglingLegs,
        store.hideLegLabels
      ),
      compressedViewport, // 4: viewport
      matrixTable // 5: parity_check_matrix_table
    ];

    // Add optional fields only if they have content
    if (Object.keys(store.parityCheckMatrices).length > 0) {
      compressed[6] = Object.entries(store.parityCheckMatrices);
    }
    if (Object.keys(store.weightEnumerators).length > 0) {
      compressed[7] = Object.entries(store.weightEnumerators);
    }
    if (Object.keys(store.highlightedTensorNetworkLegs).length > 0) {
      compressed[8] = Object.entries(store.highlightedTensorNetworkLegs);
    }
    if (
      Object.keys(store.selectedTensorNetworkParityCheckMatrixRows).length > 0
    ) {
      compressed[9] = Object.entries(
        store.selectedTensorNetworkParityCheckMatrixRows
      );
    }

    return compressed;
  }

  /**
   * Convert compressed format back to standard canvas state
   */
  public fromCompressedCanvasState(
    compressed: CompressedCanvasState
  ): SerializableCanvasState {
    // Unpack boolean flags
    const unpackBooleanFlags = (flags: number) => ({
      hideConnectedLegs: !!(flags & 1),
      hideIds: !!(flags & 2),
      hideTypeIds: !!(flags & 4),
      hideDanglingLegs: !!(flags & 8),
      hideLegLabels: !!(flags & 16)
    });

    // Build matrix lookup table
    const matrixTable: Record<string, number[][]> = {};
    compressed[5].forEach(([id, matrix]) => {
      matrixTable[id] = matrix;
    });
    console.log("matrix table:", matrixTable);

    // Convert pieces from compressed format
    const pieces: SerializedLego[] = compressed[1].map((compressedPiece) => {
      const matrixId = compressedPiece[4];
      const matrix = matrixTable[matrixId];

      console.log("lego id:", compressedPiece[0], "matrix:", matrix);
      const piece: SerializedLego = {
        id: compressedPiece[0],
        instance_id: compressedPiece[1],
        x: compressedPiece[2],
        y: compressedPiece[3],
        parity_check_matrix: matrix,
        logical_legs: compressedPiece[5] || [],
        gauge_legs: compressedPiece[6] || [],
        short_name: compressedPiece[7] || compressedPiece[0],
        is_dynamic: compressedPiece[8] || false,
        parameters: compressedPiece[9] || {},
        selectedMatrixRows: compressedPiece[10] || [],
        highlightedLegConstraints: compressedPiece[11] || []
      };

      return piece;
    });

    // Convert connections from compressed format
    const connections: Connection[] = compressed[2].map(
      (compressedConn) =>
        new Connection(
          { legoId: compressedConn[0], leg_index: compressedConn[1] },
          { legoId: compressedConn[2], leg_index: compressedConn[3] }
        )
    );

    // Convert viewport from compressed format
    const viewport = new Viewport(
      compressed[4][0], // screenWidth
      compressed[4][1], // screenHeight
      compressed[4][2], // zoomLevel
      new LogicalPoint(compressed[4][3], compressed[4][4]), // logicalPanOffset
      null
    );

    const booleanFlags = unpackBooleanFlags(compressed[3]);

    const result: SerializableCanvasState = {
      title: compressed[0],
      pieces,
      connections,
      hideConnectedLegs: booleanFlags.hideConnectedLegs,
      hideIds: booleanFlags.hideIds,
      hideTypeIds: booleanFlags.hideTypeIds,
      hideDanglingLegs: booleanFlags.hideDanglingLegs,
      hideLegLabels: booleanFlags.hideLegLabels,
      viewport,
      parityCheckMatrices: (compressed[6] || []).map(([key, value]) => ({
        key,
        value
      })),
      weightEnumerators: (compressed[7] || []).map(([key, value]) => ({
        key,
        value
      })),
      highlightedTensorNetworkLegs: (compressed[8] || []).map(
        ([key, value]) => ({ key, value })
      ),
      selectedTensorNetworkParityCheckMatrixRows: (compressed[9] || []).map(
        ([key, value]) => ({ key, value })
      )
    };
    console.log(
      "hello - deserialized result from compressed canvas state",
      result
    );

    return result;
  }

  /**
   * Encode compressed canvas state to URL-safe string
   */
  public encodeCompressedForUrl(compressed: CompressedCanvasState): string {
    const jsonString = JSON.stringify(compressed);
    // Use lz-string for additional compression
    return LZString.compressToEncodedURIComponent(jsonString);
  }

  /**
   * Decode URL-safe string back to compressed canvas state
   */
  public decodeCompressedFromUrl(encoded: string): CompressedCanvasState {
    const decompressed = LZString.decompressFromEncodedURIComponent(encoded);
    if (!decompressed) {
      throw new Error("Failed to decompress canvas state from URL");
    }
    return JSON.parse(decompressed) as CompressedCanvasState;
  }
}
