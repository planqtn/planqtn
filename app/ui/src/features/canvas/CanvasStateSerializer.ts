import { Connection } from "../../stores/connectionStore";
import { DroppedLego } from "../../stores/droppedLegoStore";
import { LogicalPoint } from "../../types/coordinates";
import { Legos } from "../lego/Legos";

interface CanvasState {
  canvasId: string;
  pieces: Array<{
    id: string;
    instanceId: string;
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
    hideConnectedLegs: boolean
  ): void {
    const state: CanvasState = {
      canvasId: this.canvasId,
      pieces: pieces.map((piece) => ({
        id: piece.type_id,
        instanceId: piece.instanceId,
        x: piece.logicalPosition.x,
        y: piece.logicalPosition.y,
        shortName: piece.shortName,
        is_dynamic: piece.is_dynamic,
        parameters: piece.parameters,
        parity_check_matrix: piece.parity_check_matrix,
        logical_legs: piece.logical_legs,
        gauge_legs: piece.gauge_legs,
        selectedMatrixRows: piece.selectedMatrixRows
      })),
      connections,
      hideConnectedLegs
    };

    const encoded = btoa(JSON.stringify(state));
    // console.log("Encoding state:", state, "encoded", encoded);
    window.history.replaceState(null, "", `#state=${encoded}`);
  }

  public async decode(encoded: string): Promise<{
    pieces: DroppedLego[];
    connections: Connection[];
    hideConnectedLegs: boolean;
    canvasId: string;
  }> {
    try {
      const decoded = JSON.parse(atob(encoded));
      if (!decoded.pieces || !Array.isArray(decoded.pieces)) {
        return {
          pieces: [],
          connections: [],
          hideConnectedLegs: false,
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
          instanceId: string;
          x: number;
          y: number;
          is_dynamic?: boolean;
          parameters?: Record<string, unknown>;
          parity_check_matrix: number[][];
          logical_legs?: number[];
          gauge_legs?: number[];
          name?: string;
          shortName?: string;
          description?: string;
          selectedMatrixRows?: number[];
        }) => {
          const predefinedLego = legosList.find((l) => l.type_id === piece.id);
          if (
            !piece.parity_check_matrix ||
            piece.parity_check_matrix.length === 0
          ) {
            throw new Error(
              `Piece ${piece.instanceId} (of type ${piece.id}) has no parity check matrix. Full state:\n${atob(encoded)}`
            );
          }

          // For pieces not in lego list, construct from saved data
          if (!predefinedLego) {
            return new DroppedLego(
              {
                type_id: piece.id,
                name: piece.name || piece.id,
                shortName: piece.shortName || piece.id,
                description: piece.description || "",

                is_dynamic: piece.is_dynamic || false,
                parameters: piece.parameters || {},
                parity_check_matrix: piece.parity_check_matrix || [],
                logical_legs: piece.logical_legs || [],
                gauge_legs: piece.gauge_legs || []
              },
              new LogicalPoint(piece.x, piece.y),
              piece.instanceId,
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
              piece.instanceId,

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
            piece.instanceId,
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
