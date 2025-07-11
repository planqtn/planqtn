import { Connection } from "../../stores/connectionStore";
import { DroppedLego } from "../../stores/droppedLegoStore";
import { LogicalPoint } from "../../types/coordinates";
import { Legos } from "../lego/Legos";
import { validateEncodedCanvasState } from "../../schemas/v1/canvas-state-validator";

interface CanvasState {
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
  }>;
  connections: Array<Connection>;
  hideConnectedLegs: boolean;
  hideIds: boolean;
  hideTypeIds: boolean;
  hideDanglingLegs: boolean;
  hideLegLabels: boolean;
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

  public encode(
    pieces: DroppedLego[],
    connections: Connection[],
    hideConnectedLegs: boolean,
    hideIds: boolean = false,
    hideTypeIds: boolean = false,
    hideDanglingLegs: boolean = false,
    hideLegLabels: boolean = false
  ): void {
    const state: CanvasState = {
      canvasId: this.canvasId,
      pieces: pieces.map((piece) => ({
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
        selectedMatrixRows: piece.selectedMatrixRows
      })),
      connections,
      hideConnectedLegs,
      hideIds,
      hideTypeIds,
      hideDanglingLegs,
      hideLegLabels
    };

    const encoded = btoa(JSON.stringify(state));
    // console.log("Encoding state:", state, "encoded", encoded);
    window.history.replaceState(null, "", `#state=${encoded}`);
  }

  public async decode(encoded: string): Promise<{
    pieces: DroppedLego[];
    connections: Connection[];
    hideConnectedLegs: boolean;
    hideIds: boolean;
    hideTypeIds: boolean;
    hideDanglingLegs: boolean;
    hideLegLabels: boolean;
    canvasId: string;
  }> {
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
      console.log("Decoded state:", decoded);

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
          pieces: [],
          connections: [],
          hideConnectedLegs: false,
          hideIds: false,
          hideTypeIds: false,
          hideDanglingLegs: false,
          hideLegLabels: false,
          canvasId: this.canvasId
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

          // For pieces not in lego list, construct from saved data
          if (!predefinedLego) {
            return new DroppedLego(
              {
                type_id: piece.id,
                name: piece.name || piece.id,
                short_name: piece.short_name || piece.id,
                description: piece.description || "",

                is_dynamic: piece.is_dynamic || false,
                parameters: piece.parameters || {},
                parity_check_matrix: piece.parity_check_matrix || [],
                logical_legs: piece.logical_legs || [],
                gauge_legs: piece.gauge_legs || []
              },
              new LogicalPoint(piece.x, piece.y),
              piece.instance_id,
              { selectedMatrixRows: piece.selectedMatrixRows || [] }
            );
          }

          // For dynamic legos, use the saved parameters and matrix
          if (
            piece.is_dynamic &&
            piece.parameters &&
            piece.parity_check_matrix
          ) {
            return new DroppedLego(
              {
                ...predefinedLego,
                parameters: piece.parameters,
                parity_check_matrix: piece.parity_check_matrix,
                logical_legs: piece.logical_legs || [],
                gauge_legs: piece.gauge_legs || []
              },

              new LogicalPoint(piece.x, piece.y),
              piece.instance_id,

              { selectedMatrixRows: piece.selectedMatrixRows || [] }
            );
          }

          // For regular legos, use the template
          return new DroppedLego(
            {
              ...predefinedLego,
              parity_check_matrix:
                piece.parity_check_matrix || predefinedLego.parity_check_matrix
            },
            new LogicalPoint(piece.x, piece.y),
            piece.instance_id,
            { selectedMatrixRows: piece.selectedMatrixRows || [] }
          );
        }
      );
      // console.log("Reconstructed pieces:", reconstructedPieces, "connections", decoded.connections);
      return {
        pieces: reconstructedPieces,
        connections: decoded.connections.map(
          (conn: Connection) => new Connection(conn.from, conn.to)
        ),
        hideConnectedLegs: decoded.hideConnectedLegs || false,
        hideIds: decoded.hideIds || false,
        hideTypeIds: decoded.hideTypeIds || false,
        hideDanglingLegs: decoded.hideDanglingLegs || false,
        hideLegLabels: decoded.hideLegLabels || false,
        canvasId: this.canvasId
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
