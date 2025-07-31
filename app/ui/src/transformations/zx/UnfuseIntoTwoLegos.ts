import { Connection } from "@/stores/connectionStore.ts";
import { DroppedLego } from "@/stores/droppedLegoStore.ts";
import { LogicalPoint } from "@/types/coordinates.ts";
import { Operation } from "@/features/canvas/OperationHistory.ts";
import { Legos } from "@/features/lego/Legos.ts";
import _ from "lodash";

export function canUnfuseInto2Legos(legos: DroppedLego[]): boolean {
  return (
    legos.length === 1 &&
    (legos[0].type_id === "x_rep_code" || legos[0].type_id === "z_rep_code")
  );
}

export function applyUnfuseInto2Legos(
  lego: DroppedLego,
  legPartition: number[],
  droppedLegos: DroppedLego[],
  connections: Connection[]
): {
  connections: Connection[];
  droppedLegos: DroppedLego[];
  operation: Operation;
} {
  // Get max instance ID
  const maxInstanceId = Math.max(
    ...droppedLegos.map((l) => parseInt(l.instance_id))
  );

  // Find any existing connections to the original lego
  const connectionsInvolvingLego = connections.filter((conn) =>
    conn.containsLego(lego.instance_id)
  );

  // Count legs for each new lego
  const lego1Legs = legPartition.filter((x) => !x).length;
  const lego2Legs = legPartition.filter((x) => x).length;

  // Create maps for new leg indices
  const lego1LegMap = new Map<number, number>();
  const lego2LegMap = new Map<number, number>();
  let lego1Count = 0;
  let lego2Count = 0;

  // Build the leg mapping
  legPartition.forEach((isLego2, oldIndex) => {
    if (!isLego2) {
      lego1LegMap.set(oldIndex, lego1Count++);
    } else {
      lego2LegMap.set(oldIndex, lego2Count++);
    }
  });

  const lego1 = Legos.createDynamicLego(
    lego.type_id,
    lego1Legs + 1,
    (maxInstanceId + 1).toString(),
    lego.logicalPosition.plus(new LogicalPoint(-50, 0))
  );
  const lego2 = Legos.createDynamicLego(
    lego.type_id,
    lego2Legs + 1,
    (maxInstanceId + 2).toString(),
    lego.logicalPosition.plus(new LogicalPoint(50, 0))
  );

  // Create connection between the new legos
  const connectionBetweenLegos: Connection = new Connection(
    {
      legoId: lego1.instance_id,
      leg_index: lego1Legs // The last leg is the connecting one
    },
    {
      legoId: lego2.instance_id,
      leg_index: lego2Legs // The last leg is the connecting one
    }
  );

  // Remap existing connections based on leg assignments
  const newConnections = connectionsInvolvingLego.map((conn) => {
    const newConn = new Connection(
      _.cloneDeep(conn.from),
      _.cloneDeep(conn.to)
    );
    if (conn.from.legoId === lego.instance_id) {
      const oldLegIndex = conn.from.leg_index;
      if (!legPartition[oldLegIndex]) {
        // Goes to lego1
        newConn.from.legoId = lego1.instance_id;
        newConn.from.leg_index = lego1LegMap.get(oldLegIndex)!;
      } else {
        // Goes to lego2
        newConn.from.legoId = lego2.instance_id;
        newConn.from.leg_index = lego2LegMap.get(oldLegIndex)!;
      }
    }
    if (conn.to.legoId === lego.instance_id) {
      const oldLegIndex = conn.to.leg_index;
      if (!legPartition[oldLegIndex]) {
        // Goes to lego1
        newConn.to.legoId = lego1.instance_id;
        newConn.to.leg_index = lego1LegMap.get(oldLegIndex)!;
      } else {
        // Goes to lego2
        newConn.to.legoId = lego2.instance_id;
        newConn.to.leg_index = lego2LegMap.get(oldLegIndex)!;
      }
    }
    return newConn;
  });

  // Update the state
  const newLegos = [
    ...droppedLegos.filter((l) => l.instance_id !== lego.instance_id),
    lego1,
    lego2
  ];

  // Only keep connections that don't involve the original lego at all
  const remainingConnections = connections.filter(
    (c) => !c.containsLego(lego.instance_id)
  );

  // Add the remapped connections and the new connection between legos
  const updatedConnections = [
    ...remainingConnections,
    ...newConnections,
    connectionBetweenLegos
  ];

  // Create operation for history
  const operation: Operation = {
    type: "unfuseInto2Legos",
    data: {
      legosToRemove: [lego],
      connectionsToRemove: connectionsInvolvingLego,
      legosToAdd: [lego1, lego2],
      connectionsToAdd: [...newConnections, connectionBetweenLegos]
    }
  };

  return {
    connections: updatedConnections,
    droppedLegos: newLegos,
    operation
  };
}
