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
        if (!this.droppedLegos.some((l) => l.instanceId === lego.instanceId)) {
          throw new Error("Lego not found");
        }
      }
      // Get all connections between the legos being fused
      const internalConnections = this.connections.filter(
        (conn) =>
          legosToFuse.some((l) => l.instanceId === conn.from.legoId) &&
          legosToFuse.some((l) => l.instanceId === conn.to.legoId)
      );

      // Get all connections to legos outside the fusion group
      const externalConnections = this.connections.filter((conn) => {
        const fromInGroup = legosToFuse.some(
          (l) => l.instanceId === conn.from.legoId
        );
        const toInGroup = legosToFuse.some(
          (l) => l.instanceId === conn.to.legoId
        );
        return (fromInGroup && !toInGroup) || (!fromInGroup && toInGroup);
      });

      const remainingConnections = this.connections.filter(
        (conn) =>
          !internalConnections.some((ic) => ic.equals(conn)) &&
          !externalConnections.some((ec) => ec.equals(conn))
      );

      // Create a map of old leg indices to track external connections
      const legMap = new Map<string, { legoId: string; legIndex: number }>();
      externalConnections.forEach((conn) => {
        const isFromInGroup = legosToFuse.some(
          (l) => l.instanceId === conn.from.legoId
        );
        if (isFromInGroup) {
          legMap.set(`${conn.from.legoId}-${conn.from.legIndex}`, {
            legoId: conn.to.legoId,
            legIndex: conn.to.legIndex
          });
        } else {
          legMap.set(`${conn.to.legoId}-${conn.to.legIndex}`, {
            legoId: conn.from.legoId,
            legIndex: conn.from.legIndex
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
          typeId: recognized_type,
          shortName: "Fused",
          name: "Fused Lego",
          description: "Fused " + legosToFuse.length + " legos",
          parityCheckMatrix: result.h.getMatrix(),
          logicalLegs: [],
          gaugeLegs: []
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
          (l) => l.instanceId === conn.from.legoId
        );
        if (isFromInGroup) {
          // Find the new leg index from the legs array
          const newLegIndex = result.legs.findIndex(
            (leg) =>
              leg.instanceId === conn.from.legoId &&
              leg.legIndex === conn.from.legIndex
          );

          return new Connection(
            { legoId: newLego.instanceId, legIndex: newLegIndex },
            conn.to
          );
        } else {
          const newLegIndex = result.legs.findIndex(
            (leg) =>
              leg.instanceId === conn.to.legoId &&
              leg.legIndex === conn.to.legIndex
          );
          return new Connection(conn.from, {
            legoId: newLego.instanceId,
            legIndex: newLegIndex
          });
        }
      });

      // Update state
      const resultingDroppedLegos = [
        ...this.droppedLegos.filter(
          (l) => !legosToFuse.some((fl) => fl.instanceId === l.instanceId)
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
