import { Connection } from "../../stores/connectionStore";
import { DroppedLego } from "../../stores/droppedLegoStore";
import { LogicalPoint } from "../../types/coordinates";
import { Legos } from "../lego/Legos";
import { validateEncodedCanvasState } from "../../schemas/v1/canvas-state-validator";
import { PauliOperator } from "../../lib/types";
import { CanvasStore } from "../../stores/canvasStateStore";
import { Viewport } from "../../stores/canvasUISlice";

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
}
export interface SerializableCanvasState {
  canvasId: string;
  pieces: Array<{
    id: string;
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
  }>;
  connections: Array<Connection>;
  hideConnectedLegs: boolean;
  hideIds: boolean;
  hideTypeIds: boolean;
  hideDanglingLegs: boolean;
  hideLegLabels: boolean;
  viewport: Viewport;
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
      viewport: store.viewport.with({ canvasRef: null })
    };

    return state;
  }

  public async decode(encoded: string): Promise<RehydratedCanvasState> {
    try {
      // Validate the encoded state first
      const validationResult = validateEncodedCanvasState(encoded);
      if (!validationResult.isValid) {
        console.error(
          "Canvas state validation failed:",
          validationResult.errors
        );
        throw new Error(
          `Invalid canvas state: ${validationResult.errors?.join(", ")}`
        );
      }

      const decoded = JSON.parse(atob(encoded));

      // Check if this is legacy format and convert if needed
      const isLegacyFormat = decoded.pieces?.some(
        (piece: Record<string, unknown>) =>
          piece.instanceId !== undefined && piece.shortName !== undefined
      );

      if (isLegacyFormat) {
        console.log("Converting legacy format to current format");
        // Convert legacy format to current format
        decoded.pieces = decoded.pieces.map(
          (piece: Record<string, unknown>) => ({
            ...piece,
            instance_id: piece.instanceId,
            short_name: piece.shortName,
            type_id: piece.id
          })
        );

        // Convert legacy connection format
        if (decoded.connections) {
          decoded.connections = decoded.connections.map(
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

      if (!decoded.pieces || !Array.isArray(decoded.pieces)) {
        return {
          droppedLegos: [],
          connections: [],
          hideConnectedLegs: false,
          hideIds: false,
          hideTypeIds: false,
          hideDanglingLegs: false,
          hideLegLabels: false,
          canvasId: this.canvasId,
          viewport: new Viewport(
            decoded.viewport.screenWidth,
            decoded.viewport.screenHeight,
            decoded.viewport.zoomLevel,
            decoded.viewport.logicalPanOffset,
            null
          )
        };
      }

      // Preserve the canvas ID from the decoded state if it exists
      if (decoded.canvasId) {
        this.canvasId = decoded.canvasId;
      }

      // Fetch legos if not already loaded
      const legosList = Legos.listAvailableLegos();

      // Reconstruct dropped legos with full lego information
      const reconstructedPieces = decoded.pieces.map(
        (piece: {
          id: string;
          instance_id: string;
          x: number;
          y: number;
          is_dynamic?: boolean;
          parameters?: Record<string, unknown>;
          parity_check_matrix: number[][];
          logical_legs?: number[];
          gauge_legs?: number[];
          name?: string;
          short_name?: string;
          description?: string;
          selectedMatrixRows?: number[];
          highlightedLegConstraints?: {
            legIndex: number;
            operator: PauliOperator;
          }[];
        }) => {
          const predefinedLego = legosList.find((l) => l.type_id === piece.id);
          if (
            !piece.parity_check_matrix ||
            piece.parity_check_matrix.length === 0
          ) {
            throw new Error(
              `Piece ${piece.instance_id} (of type ${piece.id}) has no parity check matrix. Full state:\n${atob(encoded)}`
            );
          }

          const legoPrototype = predefinedLego
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
      return {
        droppedLegos: reconstructedPieces,
        connections: decoded.connections.map(
          (conn: Connection) => new Connection(conn.from, conn.to)
        ),
        hideConnectedLegs: decoded.hideConnectedLegs || false,
        hideIds: decoded.hideIds || false,
        hideTypeIds: decoded.hideTypeIds || false,
        hideDanglingLegs: decoded.hideDanglingLegs || false,
        hideLegLabels: decoded.hideLegLabels || false,
        canvasId: this.canvasId,
        viewport: new Viewport(
          decoded.viewport?.screenWidth || 800,
          decoded.viewport?.screenHeight || 600,
          decoded.viewport?.zoomLevel || 1,
          new LogicalPoint(
            decoded.viewport?.logicalPanOffset?.x || 0,
            decoded.viewport?.logicalPanOffset?.y || 0
          ),
          null
        )
      };
    } catch (error) {
      console.error("Error decoding canvas state:", error);
      throw error; // Re-throw the error instead of returning empty state
    }
  }

  public getCanvasId(): string {
    return this.canvasId;
  }
}
