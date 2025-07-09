import { Connection } from "../stores/connectionStore";
import { Operation } from "../features/canvas/OperationHistory.ts";
import { DroppedLego } from "../stores/droppedLegoStore.ts";
import { TensorNetwork } from "../lib/TensorNetwork";
import { recognize_parityCheckMatrix } from "../features/lego/Legos.ts";
import { newInstanceId as storeNewInstanceId } from "../stores/droppedLegoStore";
import { LogicalPoint } from "../types/coordinates.ts";

export class FuseLegos {
  static operationCode: string = "fuse";

  constructor(
    private connections: Connection[],
    private droppedLegos: DroppedLego[],
    private newInstanceId: ((legos: DroppedLego[]) => string) | null = null
  ) {
    if (this.newInstanceId === null) {
      this.newInstanceId = storeNewInstanceId;
    }
  }

  public async apply(legosToFuse: DroppedLego[]): Promise<{
    connections: Connection[];
    droppedLegos: DroppedLego[];
    operation: Operation;
  }> {
    try {
      for (const lego of legosToFuse) {
        if (
          !this.droppedLegos.some((l) => l.instance_id === lego.instance_id)
        ) {
          throw new Error("Lego not found");
        }
      }
      // Get all connections between the legos being fused
      const internalConnections = this.connections.filter(
        (conn) =>
          legosToFuse.some((l) => l.instance_id === conn.from.legoId) &&
          legosToFuse.some((l) => l.instance_id === conn.to.legoId)
      );

      // Get all connections to legos outside the fusion group
      const externalConnections = this.connections.filter((conn) => {
        const fromInGroup = legosToFuse.some(
          (l) => l.instance_id === conn.from.legoId
        );
        const toInGroup = legosToFuse.some(
          (l) => l.instance_id === conn.to.legoId
        );
        return (fromInGroup && !toInGroup) || (!fromInGroup && toInGroup);
      });

      const remainingConnections = this.connections.filter(
        (conn) =>
          !internalConnections.some((ic) => ic.equals(conn)) &&
          !externalConnections.some((ec) => ec.equals(conn))
      );

      // Create a map of old leg indices to track external connections
      const legMap = new Map<string, { legoId: string; leg_index: number }>();
      externalConnections.forEach((conn) => {
        const isFromInGroup = legosToFuse.some(
          (l) => l.instance_id === conn.from.legoId
        );
        if (isFromInGroup) {
          legMap.set(`${conn.from.legoId}-${conn.from.leg_index}`, {
            legoId: conn.to.legoId,
            leg_index: conn.to.leg_index
          });
        } else {
          legMap.set(`${conn.to.legoId}-${conn.to.leg_index}`, {
            legoId: conn.from.legoId,
            leg_index: conn.from.leg_index
          });
        }
      });

      // Create a TensorNetwork and perform the fusion
      const network = new TensorNetwork({
        legos: legosToFuse,
        connections: internalConnections
      });
      const result = network.conjoin_nodes();

      if (!result) {
        throw new Error("Cannot fuse these legos");
      }

      // Try to recognize the type of the fused lego
      const recognized_type =
        recognize_parityCheckMatrix(result.h) || "fused_lego";

      // Create a new lego with the calculated parity check matrix
      const newLego: DroppedLego = new DroppedLego(
        {
          type_id: recognized_type,
          short_name: "Fused",
          name: "Fused Lego",
          description: "Fused " + legosToFuse.length + " legos",
          parity_check_matrix: result.h.getMatrix(),
          logical_legs: [],
          gauge_legs: []
        },
        new LogicalPoint(
          legosToFuse.reduce((sum, l) => sum + l.logicalPosition.x, 0) /
            legosToFuse.length,
          legosToFuse.reduce((sum, l) => sum + l.logicalPosition.y, 0) /
            legosToFuse.length
        ),
        this.newInstanceId!(this.droppedLegos)
      );

      // Create new connections based on the leg mapping
      const newConnections = externalConnections.map((conn) => {
        const isFromInGroup = legosToFuse.some(
          (l) => l.instance_id === conn.from.legoId
        );
        if (isFromInGroup) {
          // Find the new leg index from the legs array
          const newLegIndex = result.legs.findIndex(
            (leg) =>
              leg.instance_id === conn.from.legoId &&
              leg.leg_index === conn.from.leg_index
          );

          return new Connection(
            { legoId: newLego.instance_id, leg_index: newLegIndex },
            conn.to
          );
        } else {
          const newLegIndex = result.legs.findIndex(
            (leg) =>
              leg.instance_id === conn.to.legoId &&
              leg.leg_index === conn.to.leg_index
          );
          return new Connection(conn.from, {
            legoId: newLego.instance_id,
            leg_index: newLegIndex
          });
        }
      });

      // Update state
      const resultingDroppedLegos = [
        ...this.droppedLegos.filter(
          (l) => !legosToFuse.some((fl) => fl.instance_id === l.instance_id)
        ),
        newLego
      ];
      const resultingConnections = [...remainingConnections, ...newConnections];

      return {
        connections: resultingConnections,
        droppedLegos: resultingDroppedLegos,
        operation: {
          type: "fuse",
          data: {
            legosToRemove: legosToFuse,
            legosToAdd: [newLego],
            connectionsToRemove: [
              ...internalConnections,
              ...externalConnections
            ],
            connectionsToAdd: newConnections
          }
        }
      };
    } catch (error) {
      console.error("Error fusing legos:", error);
      throw new Error("Failed to fuse legos");
    }
  }
}
