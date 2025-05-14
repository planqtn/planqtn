import {
  Connection,
  DroppedLego,
  LegoServerPayload,
  Operation,
  TensorNetworkLeg,
} from "../types";
import axios from "axios";
import { getLegoStyle } from "../LegoStyles";
export class FuseLegos {
  static operationCode: string = "fuse";

  constructor(
    private connections: Connection[],
    private droppedLegos: DroppedLego[],
  ) {}

  public async apply(legosToFuse: DroppedLego[]): Promise<{
    connections: Connection[];
    droppedLegos: DroppedLego[];
    operation: Operation;
  }> {
    try {
      // Get all connections between the legos being fused
      const internalConnections = this.connections.filter(
        (conn) =>
          legosToFuse.some((l) => l.instanceId === conn.from.legoId) &&
          legosToFuse.some((l) => l.instanceId === conn.to.legoId),
      );

      // Get all connections to legos outside the fusion group
      const externalConnections = this.connections.filter((conn) => {
        const fromInGroup = legosToFuse.some(
          (l) => l.instanceId === conn.from.legoId,
        );
        const toInGroup = legosToFuse.some(
          (l) => l.instanceId === conn.to.legoId,
        );
        return (fromInGroup && !toInGroup) || (!fromInGroup && toInGroup);
      });

      const remainingConnections = this.connections.filter(
        (conn) =>
          !internalConnections.some((ic) => ic.equals(conn)) &&
          !externalConnections.some((ec) => ec.equals(conn)),
      );

      // Create a map of old leg indices to track external connections
      const legMap = new Map<string, { legoId: string; legIndex: number }>();
      externalConnections.forEach((conn) => {
        const isFromInGroup = legosToFuse.some(
          (l) => l.instanceId === conn.from.legoId,
        );
        if (isFromInGroup) {
          legMap.set(`${conn.from.legoId}-${conn.from.legIndex}`, {
            legoId: conn.to.legoId,
            legIndex: conn.to.legIndex,
          });
        } else {
          legMap.set(`${conn.to.legoId}-${conn.to.legIndex}`, {
            legoId: conn.from.legoId,
            legIndex: conn.from.legIndex,
          });
        }
      });

      // Prepare the request payload
      const payload = {
        legos: legosToFuse.reduce(
          (acc, lego) => {
            acc[lego.instanceId] = {
              ...lego,
              name: lego.shortName || "Generic Lego",
            } as LegoServerPayload;
            return acc;
          },
          {} as Record<string, LegoServerPayload>,
        ),
        connections: internalConnections,
      };

      // Call the paritycheck endpoint
      const response = await axios.post(`/api/paritycheck`, payload);
      const { matrix, legs, recognized_type } = response.data;

      // Create a new lego with the calculated parity check matrix
      const type_id = recognized_type || "fused_lego";
      const newLego: DroppedLego = {
        id: type_id,
        // it's important to use the max instance id + 1 to avoid collisions in the history, with connections especially
        instanceId: (
          Math.max(...this.droppedLegos.map((l) => parseInt(l.instanceId))) + 1
        ).toString(),
        shortName: "Fused",
        name: "Fused Lego",
        description: "Fused " + legosToFuse.length + " legos",
        parity_check_matrix: matrix,
        logical_legs: [],
        gauge_legs: [],
        x: legosToFuse.reduce((sum, l) => sum + l.x, 0) / legosToFuse.length, // Center position
        y: legosToFuse.reduce((sum, l) => sum + l.y, 0) / legosToFuse.length,
        style: getLegoStyle(type_id, matrix[0].length / 2),
        selectedMatrixRows: [],
      };

      // Create new connections based on the leg mapping
      const newConnections = externalConnections.map((conn) => {
        const isFromInGroup = legosToFuse.some(
          (l) => l.instanceId === conn.from.legoId,
        );
        if (isFromInGroup) {
          // Find the new leg index from the legs array
          const newLegIndex = legs.findIndex(
            (leg: TensorNetworkLeg) =>
              leg.instanceId === conn.from.legoId &&
              leg.legIndex === conn.from.legIndex,
          );
          return new Connection(
            { legoId: newLego.instanceId, legIndex: newLegIndex },
            conn.to,
          );
        } else {
          const newLegIndex = legs.findIndex(
            (leg: TensorNetworkLeg) =>
              leg.instanceId === conn.to.legoId &&
              leg.legIndex === conn.to.legIndex,
          );
          return new Connection(conn.from, {
            legoId: newLego.instanceId,
            legIndex: newLegIndex,
          });
        }
      });

      // Update state
      const resultingDroppedLegos = [
        ...this.droppedLegos.filter(
          (l) => !legosToFuse.some((fl) => fl.instanceId === l.instanceId),
        ),
        newLego,
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
              ...externalConnections,
            ],
            connectionsToAdd: newConnections,
          },
        },
      };
    } catch (error) {
      console.error("Error fusing legos:", error);
      if (axios.isAxiosError(error)) {
        const message =
          error.response?.data?.message ||
          error.response?.data?.detail ||
          error.message;

        throw new Error(`Failed to fuse legos: ${message}`);
      } else {
        throw new Error("Failed to fuse legos");
      }
    }
  }
}
