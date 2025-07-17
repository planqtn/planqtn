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

export interface SerializedLego {
  id: string;
  name?: string;
  short_name?: string;
  description?: string;
  instance_id: string;
  x: number;
  y: number;
  is_dynamic?: boolean;
  parameters?: Record<string, unknown>;
  parity_check_matrix?: number[][];
  logical_legs?: number[];
  gauge_legs?: number[];
  selectedMatrixRows?: number[];
  highlightedLegConstraints?: {
    legIndex: number;
    operator: PauliOperator;
  }[];
}

export interface RehydratedCanvasState {
  canvasId: string;
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
export interface SerializableCanvasState {
  canvasId: string;
  pieces: Array<SerializedLego>;
  connections: Array<Connection>;
  hideConnectedLegs: boolean;
  hideIds: boolean;
  hideTypeIds: boolean;
  hideDanglingLegs: boolean;
  hideLegLabels: boolean;
  viewport: Viewport;
  parityCheckMatrices: { key: string; value: ParityCheckMatrix }[];
  weightEnumerators: { key: string; value: WeightEnumerator[] }[];
  highlightedTensorNetworkLegs: {
    key: string;
    value: {
      leg: TensorNetworkLeg;
      operator: PauliOperator;
    }[];
  }[];
  selectedTensorNetworkParityCheckMatrixRows: {
    key: string;
    value: number[];
  }[];
}

export class CanvasStateSerializer {
  private canvasId: string;

  constructor() {
    // Generate a unique canvas ID if not already set
    this.canvasId = this.generateCanvasId();
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
      canvasId: this.canvasId,
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
      canvasId: this.canvasId,
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
      result.parityCheckMatrices = Object.fromEntries(
        rawCanvasStateObj.parityCheckMatrices.map(
          (item: { key: string; value: ParityCheckMatrix }) => [
            item.key,
            item.value
          ]
        )
      );
      result.weightEnumerators = Object.fromEntries(
        rawCanvasStateObj.weightEnumerators.map(
          (item: { key: string; value: WeightEnumerator[] }) => [
            item.key,
            item.value
          ]
        )
      );
      result.highlightedTensorNetworkLegs = Object.fromEntries(
        rawCanvasStateObj.highlightedTensorNetworkLegs.map(
          (item: {
            key: string;
            value: { leg: TensorNetworkLeg; operator: PauliOperator }[];
          }) => [item.key, item.value]
        )
      );
      result.selectedTensorNetworkParityCheckMatrixRows = Object.fromEntries(
        rawCanvasStateObj.selectedTensorNetworkParityCheckMatrixRows.map(
          (item: { key: string; value: number[] }) => [item.key, item.value]
        )
      );
      result.hideConnectedLegs = rawCanvasStateObj.hideConnectedLegs || false;
      result.hideIds = rawCanvasStateObj.hideIds || false;
      result.hideTypeIds = rawCanvasStateObj.hideTypeIds || false;
      result.hideDanglingLegs = rawCanvasStateObj.hideDanglingLegs || false;
      result.hideLegLabels = rawCanvasStateObj.hideLegLabels || false;

      // Preserve the canvas ID from the decoded state if it exists
      if (rawCanvasStateObj.canvasId) {
        this.canvasId = rawCanvasStateObj.canvasId;
      }
      result.canvasId = this.canvasId;

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
}
